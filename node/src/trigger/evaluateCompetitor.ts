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
    console.log("🚀 Starting competitor evaluation task");
    console.log("📋 Payload received:");
    console.log("  🏢 Competitor ID:", payload?.competitorId);
    
    console.log("🔍 Validating payload...");
    if (!payload?.competitorId) {
      console.error("❌ Missing competitorId in payload");
      throw new Error("competitorId is required");
    }
    console.log("✅ Payload validation successful");

    console.log("📊 Fetching competitor and deal data...");
    logger.log("Evaluating competitor", { competitorId: payload.competitorId });

    console.log("🔍 Querying database for competitor...");
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

    console.log("📥 Database query completed");
    if (!competitor || !competitor.deal) {
      console.error("❌ Competitor or deal not found:", payload.competitorId);
      throw new Error(`Competitor or deal not found: ${payload.competitorId}`);
    }
    
    console.log("✅ Competitor and deal data retrieved successfully!");
    console.log("📊 Retrieved data:");
    console.log("  🏢 Competitor name:", competitor.name);
    console.log("  🎯 Deal ID:", competitor.deal.id);
    console.log("  🏢 Deal company:", competitor.deal.companyName || "Not set");
    console.log("  📁 Deal files:", competitor.deal.files?.length || 0);

    const { deal } = competitor;
    
    console.log("🔄 Extracting OpenAI file IDs from deal files...");
    const openaiFileIds = (deal.files || [])
      .map((f) => f.openaiFileId)
      .filter((id): id is string => Boolean(id));

    console.log("📊 OpenAI file extraction results:");
    console.log("  📁 Total deal files:", deal.files?.length || 0);
    console.log("  ✅ Valid OpenAI file IDs:", openaiFileIds.length);
    console.log("  🔗 File IDs:", openaiFileIds);

    logger.log("Extracted OpenAI file IDs from deal", {
      dealId: deal.id,
      openaiFileIds,
    });

    console.log("🔧 Preparing company comparison data...");
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
    
    console.log("📊 Company comparison setup:");
    console.log("  🏢 Company A (our company):");
    console.log("    📛 Name:", companyA.name || "Not set");
    console.log("    📝 Description length:", companyA.description?.length || 0, "characters");
    console.log("  🏢 Company B (competitor):");
    console.log("    📛 Name:", companyB.name);
    console.log("    📝 Description length:", companyB.description?.length || 0, "characters");
    console.log("    🌐 Website:", companyB.website || "Not provided");

    console.log("📖 Loading competition evaluation prompt template...");
    const competitionPromptTemplate = await fs.readFile(
      path.join(process.cwd(), "prompts", "competition.txt"),
      "utf-8"
    );
    console.log("✅ Prompt template loaded successfully");
    console.log("📏 Template length:", competitionPromptTemplate.length, "characters");
    
    console.log("📝 Building evaluation prompt...");
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
    console.log("✅ Evaluation prompt built successfully");
    console.log("📏 Final prompt length:", userPrompt.length, "characters");

    console.log("📎 Building file attachments for AI evaluation...");
    const attachments = openaiFileIds.map((fileId) => ({
      type: "input_file" as const,
      file_id: fileId,
    }));
    console.log("📊 Attachment setup complete:");
    console.log("  📁 Number of attachments:", attachments.length);
    console.log("  🔗 Attachment file IDs:", attachments.map(a => a.file_id));

    console.log("🚀 Starting AI-powered competitor evaluation...");
    try {
      console.log("📤 Sending evaluation request to OpenAI GPT-5...");
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

      console.log("📥 Received evaluation response from OpenAI");
      console.log("🔍 Parsing evaluation results...");
      const parsed = response.output_parsed;
      
      if (parsed) {
        console.log("✅ Evaluation results parsed successfully!");
        console.log("📊 Evaluation results:");
        console.log("  📈 Score:", parsed.score);
        console.log("  🏢 Category:", parsed.competitor_category);
        console.log("  📝 Short justification length:", parsed.short_justification?.length || 0, "characters");
        console.log("  📖 Detailed justification length:", parsed.detailed_justification?.length || 0, "characters");
        
        console.log("💾 Saving evaluation results to database...");
        await prisma.competitor.update({
          where: { id: payload.competitorId },
          data: {
            score: String(parsed.score),
            competitorCategory: parsed.competitor_category,
            shortJustification: sanitizeCitations(parsed.short_justification) ?? parsed.short_justification,
            detailedJustification: sanitizeCitations(parsed.detailed_justification) ?? parsed.detailed_justification,
          },
        });
        console.log("✅ Evaluation results saved to database successfully!");
        
        logger.log("Saved competitor evaluation to DB", { competitorId: payload.competitorId });
        console.log("🎉 Competitor evaluation completed successfully!");
        return parsed;
      } else {
        console.error("❌ Failed to parse OpenAI evaluation response");
        logger.error("Failed to parse OpenAI response", { competitorId: payload.competitorId });
      }

    } catch (error: any) {
      console.error("❌ Fatal error in competitor evaluation:", error);
      console.error("🔍 Error type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("📚 Error details:", error instanceof Error ? error.message : String(error));
      console.error("🔬 Error stack:", error instanceof Error ? error.stack : "No stack trace");
      
      logger.error("OpenAI competitor evaluation failed", {
        error: String(error),
      });
    }
  },
});
