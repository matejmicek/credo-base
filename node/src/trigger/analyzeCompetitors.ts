import { logger, task, metadata } from "@trigger.dev/sdk/v3";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { prisma } from "../lib/prisma";
import { evaluateCompetitorTask } from "./evaluateCompetitor";
import { sanitizeCitations, CompetitorType, COMPETITOR_TYPE_CONFIGS } from "./utils/sanitize";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60*60*1000 // 1 hour
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
  competitorType: CompetitorType; // Target competitor type to search for
};

export const analyzeCompetitorsTask = task({
  id: "analyze-competitors",
  // Keep generous but bounded runtime
  maxDuration: 10000,
  run: async (payload: AnalyzeCompetitorsPayload) => {
    if (!payload?.dealId) {
      throw new Error("dealId is required");
    }
    if (!payload?.competitorType) {
      throw new Error("competitorType is required");
    }

    logger.log("Fetching deal and files", { dealId: payload.dealId });

    metadata.set("status", { label: `Fetching deal and files (${payload.competitorType})`, progress: 10 });

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

    // Get competitor type configuration
    const competitorConfig = COMPETITOR_TYPE_CONFIGS[payload.competitorType];
    const categoryFocus = competitorConfig.name;
    const categoryDescription = competitorConfig.description;

    const systemPrompt = `You are a world-class venture capital analyst. Your mission is to conduct deep-dive competitive research for the company described in the attached documents.

Use file_search to read the company's materials and web_search to find relevant competitors. Be exhaustive but precise.

STRICT INSTRUCTIONS:
- Focus ONLY on competitors that match this category: "${categoryFocus}".
- Category definition: ${categoryDescription}
- If unsure whether a company fits this category, prefer precision over recall and exclude ambiguous companies.
- Exclude companies that do not clearly fit the "${categoryFocus}" category definition.
- Prefer US/EU/CEE competitors when quality is comparable.
- Do not include citation markers (e.g., cite, turnXsearchY, turnXnewsY, [1]); return clean prose only.

OUTPUT: Return only the fields described by the structured schema.`;

    const userPrompt = `Analyze the attached investor materials and identify competitors that CLEARLY fit the "${categoryFocus}" category (${categoryDescription}). For each qualified competitor, return:
- name
- a concise description of what they do
- website (if available)
- relevance: why they are a meaningful competitor to the company in the documents

Favor up-to-date sources and practical operator relevance over superficial overlaps.`;

      const attachments = (openaiFileIds || [])
      .filter(Boolean)
      .map((fileId) => ({
        type: "input_file" as const,
        file_id: fileId,
      }));


    logger.log("Requesting OpenAI structured competitors analysis", {
      numFiles: openaiFileIds.length,
      competitorType: payload.competitorType,
    });
    metadata.set("status", { label: `Analyzing competitors (${payload.competitorType})`, progress: 40 });

    try {
      const response = await openai.responses.parse({
        // === GPT-5 Thinking ===
        model: "gpt-5",
        reasoning: { effort: "medium" }, // “hard thinking”

        // Hosted tools: web + file search
        tools: [
          { type: "web_search_preview" }
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
      console.log("Response parsed", parsed);
      const competitorsResult = parsed ?? { competitors: [] };

      logger.log("Saving competitors back to DB", {
        competitorsCount: competitorsResult.competitors?.length ?? 0,
      });
      metadata.set("status", { label: "Saving results", progress: 80 });

      const createdCompetitorIds: string[] = [];
      if (competitorsResult.competitors && competitorsResult.competitors.length > 0) {
        for (const c of competitorsResult.competitors) {
          const competitor = await prisma.competitor.create({
            data: {
              dealId: payload.dealId,
              name: c.name,
              description: sanitizeCitations(c.description) ?? c.description,
              website: c.website,
              relevance: sanitizeCitations(c.relevance) ?? c.relevance,
              competitorSource: payload.competitorType,
            },
          });
          createdCompetitorIds.push(competitor.id);
        }
      }

      metadata.set("status", { label: "Completed", progress: 100 });
      return { ...competitorsResult, competitorIds: createdCompetitorIds } as any;
    } catch (error: any) {
      logger.error("OpenAI competitor analysis failed", { error: String(error) });
      metadata.set("status", { label: "AI analysis failed", progress: 100, error: String(error) });
      console.log("Error", error);

      const fallback = {
        competitors: [],
      } as z.infer<typeof CompetitorsSchema>;

      // No need to update the deal here anymore as competitors are in a separate table
      
      return fallback;
    }
  },
});
