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
    logger.log("Starting deal analysis", {
      fileCount: payload.openaiFileIds?.length || 0,
      hasFreeText: !!payload.freeText,
    });

    metadata.set("status", { label: "Starting deal analysis", progress: 10 });

    // If no files and no free text, return default values
    if ((!payload.openaiFileIds || payload.openaiFileIds.length === 0) && !payload.freeText) {
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

    metadata.set("status", { label: "Analyzing documents with AI", progress: 30 });

    try {
      const systemPrompt =
        "You are a venture capital analyst. Read the attached documents and extract or infer details about the company, deal, and founding team. If information is not available, use 'Unknown' for that field.";

      const userPrompt = payload.freeText
        ? `Please analyze the uploaded documents for a potential investment deal.\n\nAdditional context provided: ${payload.freeText}`
        : 'Please analyze the uploaded documents for a potential investment deal.';

      // Build attachments from OpenAI file IDs
      const attachments = (payload.openaiFileIds || [])
        .filter(Boolean)
        .map((fileId) => ({
          type: "input_file" as const,
          file_id: fileId,
        }));

      logger.log("Requesting OpenAI structured analysis", {
        numFiles: attachments.length,
        hasFreeText: !!payload.freeText,
      });

      metadata.set("status", { label: "Processing with AI model", progress: 60 });

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

      metadata.set("status", { label: "Processing AI response", progress: 85 });

      const analysisResult = response.output_parsed;
      if (analysisResult) {
        logger.log('Deal analysis completed successfully', {
          companyName: analysisResult.deal_name,
          teamMembersCount: analysisResult.deal_founding_team?.length || 0,
        });
        
        metadata.set("status", { label: "Deal analysis completed", progress: 100 });
        return analysisResult;
      }

      // Fallback if parsing failed
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
      logger.error('OpenAI deal analysis failed', { error: String(error) });
      metadata.set("status", { 
        label: "Analysis failed", 
        progress: 100, 
        error: String(error) 
      });

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
