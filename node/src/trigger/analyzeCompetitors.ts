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
    console.log("🚀 Starting competitor analysis task");
    console.log("📋 Payload received:");
    console.log("  🎯 Deal ID:", payload?.dealId);
    console.log("  🏢 Competitor type:", payload?.competitorType);
    
    console.log("🔍 Validating payload...");
    if (!payload?.dealId) {
      console.error("❌ Missing dealId in payload");
      throw new Error("dealId is required");
    }
    if (!payload?.competitorType) {
      console.error("❌ Missing competitorType in payload");
      throw new Error("competitorType is required");
    }
    console.log("✅ Payload validation successful");

    console.log("📊 Starting data fetch for deal:", payload.dealId);
    logger.log("Fetching deal and files", { dealId: payload.dealId });

    metadata.set("status", { label: `Fetching deal and files (${payload.competitorType})`, progress: 10 });

    console.log("🔍 Querying database for deal...");
    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      include: { files: true },
    });

    console.log("📥 Database query completed");
    if (!deal) {
      console.error("❌ Deal not found in database:", payload.dealId);
      throw new Error(`Deal not found: ${payload.dealId}`);
    }
    console.log("✅ Deal found successfully!");

    console.log("📊 Deal details:");
    console.log("  🎯 Deal ID:", deal.id);
    console.log("  🏢 Company name:", deal.companyName || "Not set");
    console.log("  📁 Files attached:", deal.files?.length || 0);
    
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

    if (deal.files && deal.files.length > 0) {
      console.log("📋 File details:");
      deal.files.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.originalName}`);
        console.log(`     🔗 OpenAI ID: ${file.openaiFileId || 'Not set'}`);
        console.log(`     ✅ Has OpenAI ID: ${!!file.openaiFileId}`);
      });
    }

    console.log("🔄 Extracting OpenAI file IDs...");
    const openaiFileIds = (deal.files || [])
      .map((f) => f.openaiFileId)
      .filter((id): id is string => Boolean(id));

    console.log("📊 OpenAI file ID extraction results:");
    console.log("  📁 Total files:", deal.files?.length || 0);
    console.log("  ✅ Valid OpenAI IDs:", openaiFileIds.length);
    console.log("  🔗 File IDs:", openaiFileIds);

    logger.log("Extracted OpenAI file IDs", {
      totalFiles: deal.files?.length || 0,
      validOpenaiIds: openaiFileIds.length,
      openaiFileIds
    });

    if (openaiFileIds.length === 0) {
      console.log("⚠️ No OpenAI file IDs found for this deal");
      console.log("🔄 Saving empty competitor results and exiting early");
      
      logger.log("No OpenAI file IDs found for this deal; saving empty competitors.");
      const empty = { competitors: [] };
      metadata.set("status", { label: "No documents found, nothing to analyze", progress: 100 });
      
      console.log("💾 Updating deal record with empty competitors...");
      await prisma.deal.update({
        where: { id: payload.dealId },
        data: { competitors: empty },
      });
      console.log("✅ Empty competitor results saved");
      return empty;
    }

    console.log("🔧 Setting up competitor analysis configuration...");
    // Get competitor type configuration
    const competitorConfig = COMPETITOR_TYPE_CONFIGS[payload.competitorType];
    const categoryFocus = competitorConfig.name;
    const categoryDescription = competitorConfig.description;
    
    console.log("📊 Competitor analysis configuration:");
    console.log("  🎯 Category focus:", categoryFocus);
    console.log("  📝 Category description:", categoryDescription);

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

      console.log("📎 Building file attachments for AI analysis...");
      const attachments = (openaiFileIds || [])
      .filter(Boolean)
      .map((fileId) => ({
        type: "input_file" as const,
        file_id: fileId,
      }));

    console.log("📊 AI request setup complete:");
    console.log("  📁 Number of file attachments:", openaiFileIds.length);
    console.log("  🏢 Competitor type:", payload.competitorType);
    console.log("  🔗 File IDs for analysis:", openaiFileIds);

    logger.log("Requesting OpenAI structured competitors analysis", {
      numFiles: openaiFileIds.length,
      competitorType: payload.competitorType,
    });
    metadata.set("status", { label: `Analyzing competitors (${payload.competitorType})`, progress: 40 });

    console.log("🚀 Sending competitor analysis request to OpenAI GPT-5...");
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


      console.log("📥 Received response from OpenAI");
      console.log("🔍 Processing AI response...");

      const parsed = response.output_parsed;
      console.log("✅ AI response parsed successfully");
      const competitorsResult = parsed ?? { competitors: [] };

      console.log("📊 Competitor analysis results:");
      console.log("  🏢 Competitors found:", competitorsResult.competitors?.length ?? 0);
      
      if (competitorsResult.competitors && competitorsResult.competitors.length > 0) {
        console.log("  📋 Competitor details:");
        competitorsResult.competitors.forEach((competitor, index) => {
          console.log(`    ${index + 1}. ${competitor.name}`);
          console.log(`       🌐 Website: ${competitor.website || 'Not provided'}`);
          console.log(`       📝 Description: ${competitor.description?.substring(0, 100) || 'Not provided'}...`);
        });
      }

      console.log("💾 Saving competitor results to database...");
      logger.log("Saving competitors back to DB", {
        competitorsCount: competitorsResult.competitors?.length ?? 0,
      });
      metadata.set("status", { label: "Saving results", progress: 80 });

      const createdCompetitorIds: string[] = [];
      if (competitorsResult.competitors && competitorsResult.competitors.length > 0) {
        console.log(`🔄 Creating ${competitorsResult.competitors.length} competitor records...`);
        let createdCount = 0;
        
        for (const c of competitorsResult.competitors) {
          console.log(`💾 Creating competitor record: ${c.name}`);
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
          createdCount++;
          console.log(`✅ Created competitor: ${c.name} (ID: ${competitor.id})`);
        }
        
        console.log(`🎉 Successfully created ${createdCount} competitor records`);
      } else {
        console.log("ℹ️ No competitors to save to database");
      }

      console.log("📊 Final competitor analysis summary:");
      console.log("  🏢 Competitors analyzed:", competitorsResult.competitors?.length ?? 0);
      console.log("  💾 Records created:", createdCompetitorIds.length);
      console.log("  🆔 Created IDs:", createdCompetitorIds);

      metadata.set("status", { label: "Completed", progress: 100 });
      console.log("🎉 Competitor analysis completed successfully!");
      return { ...competitorsResult, competitorIds: createdCompetitorIds } as any;
    } catch (error: any) {
      console.error("❌ Fatal error in competitor analysis:", error);
      console.error("🔍 Error type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("📚 Error details:", error instanceof Error ? error.message : String(error));
      console.error("🔬 Error stack:", error instanceof Error ? error.stack : "No stack trace");
      
      logger.error("OpenAI competitor analysis failed", { error: String(error) });
      metadata.set("status", { label: "AI analysis failed", progress: 100, error: String(error) });

      const fallback = {
        competitors: [],
      } as z.infer<typeof CompetitorsSchema>;

      console.log("🔄 Returning empty competitor results due to error");
      return fallback;
    }
  },
});
