import { logger, task, metadata } from "@trigger.dev/sdk/v3";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { prisma } from "../lib/prisma";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Structured output Zod schema for competitor analysis
export const CompetitorsSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().describe("Competitor name or 'Unknown'"),
        description: z
          .string()
          .nullable()
          .describe("Short description of what they do"),
        website: z
          .string()
          .nullable()
          .describe("Official website if known (URL if available)"),
        market: z.string().nullable().describe("Market/segment they operate in"),
        strengths: z
          .array(z.string())
          .nullable()
          .describe("Key strengths or advantages"),
        weaknesses: z
          .array(z.string())
          .nullable()
          .describe("Key weaknesses or gaps"),
      })
    )
    .describe("Array of competitor profiles"),
});

type AnalyzeCompetitorsPayload = {
  dealId: string;
};

export const analyzeCompetitorsTask = task({
  id: "analyze-competitors",
  // Keep generous but bounded runtime
  maxDuration: 600,
  run: async (payload: AnalyzeCompetitorsPayload) => {
    if (!payload?.dealId) {
      throw new Error("dealId is required");
    }

    logger.log("Fetching deal and files", { dealId: payload.dealId });

    metadata.set("status", { label: "Fetching deal and files", progress: 10 });

    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      include: { files: true },
    });

    if (!deal) {
      throw new Error(`Deal not found: ${payload.dealId}`);
    }

    const openaiFileIds = (deal.files || [])
      .map((f) => f.openaiFileId)
      .filter((id): id is string => Boolean(id));

    if (openaiFileIds.length === 0) {
      logger.log("No OpenAI file IDs found for this deal; saving empty competitors.");
      const empty = { competitors: [] };
      metadata.set("status", { label: "No documents found, nothing to analyze", progress: 100 });
      await prisma.deal.update({
        where: { id: payload.dealId },
        data: { competitors: empty },
      });
      return empty;
    }
    console.log("found openai file ids: ", openaiFileIds);

    const systemPrompt =
      "You are a venture capital analyst. Read the attached documents and extract likely competitors to the company described. Prefer concrete named companies. If information is limited, use your best inference based on the documents.";

    const userPrompt =
      "Identify direct competitors and near-adjacent competitors. Return a concise list with name, brief description, optional website, market, and notable strengths/weaknesses where possible.";

    const attachments = openaiFileIds.map((fileId) => ({
      type: "input_file" as const,
      file_id: fileId,
    }));

    logger.log("Requesting OpenAI structured competitors analysis", {
      numFiles: openaiFileIds.length,
    });
    metadata.set("status", { label: "Analyzing documents with AI", progress: 40 });

    try {
      const response = await openai.responses.parse({
        model: "gpt-4o-2024-08-06",
        input: [
          { role: "system", content: systemPrompt },
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
        text: {
          format: zodTextFormat(CompetitorsSchema, "competitor_analysis"),
        },
      });

      const parsed = response.output_parsed;

      const competitorsResult = parsed ?? { competitors: [] };

      logger.log("Saving competitors back to DB", {
        competitorsCount: competitorsResult.competitors?.length ?? 0,
      });
      metadata.set("status", { label: "Saving results", progress: 80 });

      await prisma.deal.update({
        where: { id: payload.dealId },
        data: { competitors: competitorsResult },
      });
      metadata.set("status", { label: "Completed", progress: 100 });

      return competitorsResult;
    } catch (error: any) {
      logger.error("OpenAI competitor analysis failed", { error: String(error) });
      metadata.set("status", { label: "AI analysis failed", progress: 100, error: String(error) });

      const fallback = {
        competitors: [],
      } as z.infer<typeof CompetitorsSchema>;

      await prisma.deal.update({
        where: { id: payload.dealId },
        data: { competitors: fallback },
      });

      return fallback;
    }
  },
});


