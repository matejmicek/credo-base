import { logger, task, metadata, batchTrigger } from "@trigger.dev/sdk/v3";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { prisma } from "../lib/prisma";
import { evaluateCompetitorTask } from "./evaluateCompetitor";

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
        relevance: z
          .string()
          .nullable()
          .describe("Commentary on why this company is a relevant competitor"),
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

    // Add detailed logging to debug the issue
    logger.log("Deal found with files", {
      dealId: deal.id,
      filesCount: deal.files?.length || 0,
      files: deal.files?.map(f => ({
        id: f.id,
        originalName: f.originalName,
        openaiFileId: f.openaiFileId,
        hasOpenaiId: !!f.openaiFileId
      }))
    });

    const openaiFileIds = (deal.files || [])
      .map((f) => f.openaiFileId)
      .filter((id): id is string => Boolean(id));

    logger.log("Extracted OpenAI file IDs", {
      totalFiles: deal.files?.length || 0,
      validOpenaiIds: openaiFileIds.length,
      openaiFileIds
    });

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

    const systemPrompt =
      "You are a world-class venture capital analyst. Your mission is to conduct deep-dive research on the competitive landscape for the company described in the attached documents. Use file_search to read the docs and web_search to uncover direct, indirect, and emerging competitors. Synthesize both sources. Be thorough and meticulous in your research. For each competitor, provide a concise commentary on their relevance. Return only fields defined by analyze_deal.";

    const userPrompt =
      "Analyze the attached investor materials. Use web_search to identify direct and adjacent competitors (incl. new or less visible players). For each competitor, return their name, a concise description, their website, and a commentary on why they are a relevant competitor. Prefer EU/CEE if relevant.";

      const attachments = (openaiFileIds || [])
      .filter(Boolean)
      .map((fileId) => ({
        type: "input_file" as const,
        file_id: fileId,
      }));


    logger.log("Requesting OpenAI structured competitors analysis", {
      numFiles: openaiFileIds.length,
    });
    metadata.set("status", { label: "Analyzing documents with AI", progress: 40 });

    try {
      const response = await openai.responses.parse({
        // === GPT-5 Thinking ===
        model: "gpt-5",
        reasoning: { effort: "low" }, // “hard thinking”

        // Hosted tools: web + file search
        tools: [
          { type: "web_search" }
        ],


        // Your prompts + (optional) input_file previews
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

        // Let the model decide when to use tools
        tool_choice: "auto",

        // Structured output (Zod)
        text: { format: zodTextFormat(CompetitorsSchema, "competitor_analysis") },
      });


      console.log("Response", response);

      const parsed = response.output_parsed;
      const competitorsResult = parsed ?? { competitors: [] };

      logger.log("Saving competitors back to DB", {
        competitorsCount: competitorsResult.competitors?.length ?? 0,
      });
      metadata.set("status", { label: "Saving results", progress: 80 });

      if (competitorsResult.competitors && competitorsResult.competitors.length > 0) {
        // We need to create competitors one by one to get their IDs
        const createdCompetitors = [];
        for (const c of competitorsResult.competitors) {
          const created = await prisma.competitor.create({
            data: {
              dealId: payload.dealId,
              name: c.name,
              description: c.description,
              website: c.website,
              relevance: c.relevance,
            },
          });
          createdCompetitors.push(created);
        }
        
        // Now, trigger the evaluation task for each competitor
        logger.log("Triggering competitor evaluation tasks", { count: createdCompetitors.length });
        
        await batchTrigger({
          items: createdCompetitors.map(c => ({
            payload: {
              competitorId: c.id
            }
          })),
          task: evaluateCompetitorTask
        });
      }

      metadata.set("status", { label: "Completed", progress: 100 });
      return competitorsResult;
    } catch (error: any) {
      logger.error("OpenAI competitor analysis failed", { error: String(error) });
      metadata.set("status", { label: "AI analysis failed", progress: 100, error: String(error) });

      const fallback = {
        competitors: [],
      } as z.infer<typeof CompetitorsSchema>;

      // No need to update the deal here anymore as competitors are in a separate table
      
      return fallback;
    }
  },
});
