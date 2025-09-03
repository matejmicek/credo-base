import { logger, task } from "@trigger.dev/sdk/v3";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { prisma } from "../lib/prisma";
import { sanitizeCitations } from "./utils/sanitize";
import fs from "fs/promises";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60*60*1000 // 1 hour
});

export const EvaluationSchema = z.object({
  score: z.union([z.number(), z.literal("UNCERTAIN")]),
  competitor_category: z.enum(["early-stage", "well-funded", "incumbent"]),
  short_justification: z.string(),
  detailed_justification: z.string(),
});

type EvaluateCompetitorPayload = {
  competitorId: string;
};

export const evaluateCompetitorTask = task({
  id: "evaluate-competitor",
  maxDuration: 300,
  run: async (payload: EvaluateCompetitorPayload, { ctx }) => {
    if (!payload?.competitorId) {
      throw new Error("competitorId is required");
    }

    logger.log("Evaluating competitor", { competitorId: payload.competitorId });

    const competitor = await prisma.competitor.findUnique({
      where: { id: payload.competitorId },
      include: {
        deal: {
          include: {
            files: true,
          },
        },
      },
    });

    if (!competitor || !competitor.deal) {
      throw new Error(`Competitor or deal not found: ${payload.competitorId}`);
    }

    const { deal } = competitor;
    const openaiFileIds = (deal.files || [])
      .map((f) => f.openaiFileId)
      .filter((id): id is string => Boolean(id));

    logger.log("Extracted OpenAI file IDs from deal", {
      dealId: deal.id,
      openaiFileIds,
    });

    const companyADescription = [deal.description, deal.uploadedText]
      .filter(Boolean)
      .join("\\n\\n");

    const companyA = {
      name: deal.companyName,
      description: companyADescription,
    };

    const companyB = {
      name: competitor.name,
      description: competitor.description,
      website: competitor.website,
    };

    const competitionPromptTemplate = await fs.readFile(
      path.join(process.cwd(), "prompts", "competition.txt"),
      "utf-8"
    );
    
    const userPrompt = `
You are comparing two companies.

${companyA.name} (the one we are evaluating):
Name: ${companyA.name}
Description: ${companyA.description}

${companyB.name} (the competitor):
Name: ${companyB.name}
Description: ${companyB.description}
Website: ${companyB.website}

Please evaluate the competition between them using the following rules:
---
${competitionPromptTemplate}
---
`;
    const attachments = openaiFileIds.map((fileId) => ({
      type: "input_file" as const,
      file_id: fileId,
    }));

    try {
      const response = await openai.responses.parse({
        model: "gpt-5",
        reasoning: { effort: "low" },
        tools: [{ type: "web_search_preview" }],
        input: [
          {
            role: "system",
            content:
              `You are a world-class venture capital analyst. Your mission is to evaluate the competitive landscape between two companies. Use file_search to read the attached documents about ${companyA.name}, and use web_search to find information about the competitor (${companyB.name}). Be thorough and meticulous in your research. Do not include citation markers (e.g., cite, turnXsearchY, turnXnewsY, [1]) in your prose. Return clean text only.`,
          },
          {
            role: "user",
            content: [
              ...attachments,
              {
                type: "input_text",
                text: userPrompt,
              },
            ],
          },
        ],
        tool_choice: "auto",
        text: {
          format: zodTextFormat(EvaluationSchema, "competitor_evaluation"),
        },
      });

      const parsed = response.output_parsed;
      
      if (parsed) {
        await prisma.competitor.update({
          where: { id: payload.competitorId },
          data: {
            score: String(parsed.score),
            competitorCategory: parsed.competitor_category,
            shortJustification: sanitizeCitations(parsed.short_justification) ?? parsed.short_justification,
            detailedJustification: sanitizeCitations(parsed.detailed_justification) ?? parsed.detailed_justification,
          },
        });
        logger.log("Saved competitor evaluation to DB", { competitorId: payload.competitorId });
        return parsed;
      } else {
         logger.error("Failed to parse OpenAI response", { competitorId: payload.competitorId });
      }

    } catch (error: any) {
      logger.error("OpenAI competitor evaluation failed", {
        error: String(error),
      });
    }
  },
});
