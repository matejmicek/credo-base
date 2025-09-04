import { logger, task, metadata } from "@trigger.dev/sdk/v3";
import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Structured output Zod schema for deal analysis
const DealAnalysisSchema = z.object({
  deal_name: z.string().describe("The company or deal name, or 'Unknown' if not found"),
  deal_description: z
    .string()
    .describe(
      "A comprehensive description of the company, business model, and value proposition, or 'Unknown' if not found"
    ),
  deal_founding_team: z
    .array(
      z.object({
        name: z
          .string()
          .describe("Founder or team member name, or 'Unknown' if not found"),
        role: z.string().describe("Their role/title, or 'Unknown' if not found"),
        description: z
          .string()
          .describe(
            "Brief description of their background and expertise, or 'Unknown' if not found"
          ),
      })
    )
    .describe('Array of founding team members'),
});

export type AnalyzeDealPayload = {
  openaiFileIds: string[];
  freeText?: string;
};

export const analyzeDealTask = task({
  id: "analyze-deal",
  maxDuration: 300, // 5 minutes
  run: async (payload: AnalyzeDealPayload) => {
    console.log("🚀 Starting deal analysis task");
    console.log("📋 Payload received:");
    console.log("  📁 File count:", payload.openaiFileIds?.length || 0);
    console.log("  📝 Has free text:", !!payload.freeText);
    console.log("  🔗 OpenAI file IDs:", payload.openaiFileIds);
    
    logger.log("Starting deal analysis", {
      fileCount: payload.openaiFileIds?.length || 0,
      hasFreeText: !!payload.freeText,
    });

    metadata.set("status", { label: "Starting deal analysis", progress: 10 });

    // If no files and no free text, return default values
    console.log("🔍 Checking for content to analyze...");
    if ((!payload.openaiFileIds || payload.openaiFileIds.length === 0) && !payload.freeText) {
      console.log("⚠️ No files or text provided for analysis");
      console.log("🔄 Returning default values");
      
      logger.log("No files or text provided for analysis");
      metadata.set("status", { label: "No content to analyze", progress: 100 });
      
      return {
        deal_name: 'Unknown',
        deal_description: 'No documents or text provided for analysis',
        deal_founding_team: [
          {
            name: 'Unknown',
            role: 'Unknown',
            description: 'Unknown',
          },
        ],
      };
    }
    
    console.log("✅ Content found for analysis, proceeding...");

    metadata.set("status", { label: "Analyzing documents with AI", progress: 30 });

    try {
      console.log("🧠 Setting up AI analysis prompts...");
      const systemPrompt =
        "You are a venture capital analyst. Read the attached documents and extract or infer details about the company, deal, and founding team. If information is not available, use 'Unknown' for that field.";

      const userPrompt = payload.freeText
        ? `Please analyze the uploaded documents for a potential investment deal.\n\nAdditional context provided: ${payload.freeText}`
        : 'Please analyze the uploaded documents for a potential investment deal.';

      console.log("📎 Building file attachments for AI...");
      // Build attachments from OpenAI file IDs
      const attachments = (payload.openaiFileIds || [])
        .filter(Boolean)
        .map((fileId) => ({
          type: "input_file" as const,
          file_id: fileId,
        }));

      console.log("📊 AI request configuration:");
      console.log("  📁 Number of attachments:", attachments.length);
      console.log("  📝 Has additional context:", !!payload.freeText);
      console.log("  🔗 File IDs:", attachments.map(a => a.file_id));

      logger.log("Requesting OpenAI structured analysis", {
        numFiles: attachments.length,
        hasFreeText: !!payload.freeText,
      });

      metadata.set("status", { label: "Processing with AI model", progress: 60 });
      console.log("🚀 Sending request to OpenAI GPT-5...");

      const response = await openai.responses.parse({
        model: 'gpt-5',
        input: [
          { role: 'system', content: systemPrompt },
          {
            role: "user",
            content: [
              ...attachments,
              {
                type: "input_text", 
                text: userPrompt
              }
            ]
          }
        ],
        text: {
          format: zodTextFormat(DealAnalysisSchema, 'analyze_deal'),
        },
      });

      console.log("📥 Received response from OpenAI");
      metadata.set("status", { label: "Processing AI response", progress: 85 });

      console.log("🔍 Parsing AI response...");
      const analysisResult = response.output_parsed;
      if (analysisResult) {
        console.log("✅ AI response parsed successfully!");
        console.log("📊 Analysis results:");
        console.log("  🏢 Company name:", analysisResult.deal_name);
        console.log("  📝 Description length:", analysisResult.deal_description?.length || 0, "characters");
        console.log("  👥 Team members found:", analysisResult.deal_founding_team?.length || 0);
        
        if (analysisResult.deal_founding_team?.length > 0) {
          console.log("  👥 Team members:");
          analysisResult.deal_founding_team.forEach((member, index) => {
            console.log(`    ${index + 1}. ${member.name} - ${member.role}`);
          });
        }
        
        logger.log('Deal analysis completed successfully', {
          companyName: analysisResult.deal_name,
          teamMembersCount: analysisResult.deal_founding_team?.length || 0,
        });
        
        metadata.set("status", { label: "Deal analysis completed", progress: 100 });
        console.log("🎉 Deal analysis completed successfully!");
        return analysisResult;
      }

      // Fallback if parsing failed
      console.log("⚠️ AI response parsing failed, using fallback");
      logger.log('AI analysis parsing failed, using fallback');
      metadata.set("status", { label: "Analysis completed with fallback", progress: 100 });
      
      return {
        deal_name: 'AI Analysis Incomplete',
        deal_description: 'Analysis completed but parsing failed',
        deal_founding_team: [
          {
            name: 'Unknown',
            role: 'Unknown',
            description: 'Unknown',
          },
        ],
      };

    } catch (error) {
      console.error("❌ Fatal error in deal analysis:", error);
      console.error("🔍 Error type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("📚 Error details:", error instanceof Error ? error.message : String(error));
      console.error("🔬 Error stack:", error instanceof Error ? error.stack : "No stack trace");
      
      logger.error('OpenAI deal analysis failed', { error: String(error) });
      metadata.set("status", { 
        label: "Analysis failed", 
        progress: 100, 
        error: String(error) 
      });

      console.log("🔄 Returning fallback analysis results");
      return {
        deal_name: 'AI Analysis Failed',
        deal_description: 'Unable to analyze documents at this time',
        deal_founding_team: [
          {
            name: 'Unknown',
            role: 'Unknown',
            description: 'Unknown',
          },
        ],
      };
    }
  },
});
