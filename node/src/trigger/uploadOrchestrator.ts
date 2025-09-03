import { logger, task, metadata, batch } from "@trigger.dev/sdk/v3";
import { prisma } from "../lib/prisma";
import { uploadToOpenAITask } from "./uploadToOpenAI";
import { analyzeDealTask } from "./analyzeDeal";
import { analyzeCompetitorsTask } from "./analyzeCompetitors";

export type UploadOrchestratorPayload = {
  dealId: string; // Now we work with an existing deal
  userId: string;
  s3Files: Array<{
    s3Url: string;
    originalFilename: string;
    mimetype: string;
    size: number;
  }>;
  freeText?: string;
};

export const uploadOrchestratorTask = task({
  id: "upload-orchestrator",
  maxDuration: 1800, // 30 minutes
  run: async (payload: UploadOrchestratorPayload) => {
    if (!payload.dealId) {
      throw new Error("dealId is required");
    }
    if (!payload.userId) {
      throw new Error("userId is required");
    }

    if (!payload.s3Files || payload.s3Files.length === 0) {
      if (!payload.freeText) {
        throw new Error("Either s3Files or freeText must be provided");
      }
    }

    logger.log("Starting upload orchestration", {
      dealId: payload.dealId,
      userId: payload.userId,
      fileCount: payload.s3Files?.length || 0,
      hasFreeText: !!payload.freeText,
    });

    metadata.set("status", { label: "Initializing upload process", progress: 5 });

    // Step 1: Upload files to OpenAI (S3 upload already done in API)
    let openaiResults: any[] = [];

    if (payload.s3Files && payload.s3Files.length > 0) {
      metadata.set("status", { label: "Uploading files to OpenAI", progress: 15 });

      const uploadResults = await batch.triggerByTaskAndWait([
        {
          task: uploadToOpenAITask,
          payload: { s3Files: payload.s3Files },
        },
      ]);

      const [openaiRun] = uploadResults.runs;

      if (!openaiRun.ok) {
        logger.error("OpenAI upload failed", { error: openaiRun.error });
        throw new Error(`OpenAI upload failed: ${openaiRun.error}`);
      }

      openaiResults = openaiRun.output;

      logger.log("OpenAI upload completed", {
        openaiCount: openaiResults.length,
      });
    }

    metadata.set("status", { label: "Processing uploaded files", progress: 40 });

    // Step 2: Analyze deal documents and competitors in parallel
    const openaiFileIds = openaiResults.map(result => result.openaiFileId).filter(Boolean);

    const analysisResults = await batch.triggerByTaskAndWait([
      {
        task: analyzeDealTask,
        payload: {
          openaiFileIds,
          freeText: payload.freeText,
        },
      },
    ]);

    const [dealAnalysisRun] = analysisResults.runs;

    if (!dealAnalysisRun.ok) {
      logger.error("Deal analysis failed", { error: dealAnalysisRun.error });
      throw new Error(`Deal analysis failed: ${dealAnalysisRun.error}`);
    }

    const dealAnalysis = dealAnalysisRun.output;

    metadata.set("status", { label: "Updating deal with extracted information", progress: 70 });

    // Step 3: Update existing deal record with extracted data
    const deal = await prisma.deal.update({
      where: { id: payload.dealId },
      data: {
        companyName: dealAnalysis.deal_name,
        description: dealAnalysis.deal_description,
        foundingTeam: dealAnalysis.deal_founding_team,
      },
    });

    logger.log("Deal updated with extracted information", { dealId: deal.id });

    // Step 4: Update file records with OpenAI file IDs
    if (payload.s3Files && payload.s3Files.length > 0 && openaiResults.length > 0) {
      for (let i = 0; i < payload.s3Files.length; i++) {
        const file = payload.s3Files[i];
        const openaiResult = openaiResults[i];
        
        if (openaiResult?.openaiFileId) {
          await prisma.dealFile.updateMany({
            where: {
              dealId: payload.dealId,
              originalName: file.originalFilename,
              url: file.s3Url,
            },
            data: {
              openaiFileId: openaiResult.openaiFileId,
            },
          });
        }
      }

      logger.log("File records updated with OpenAI file IDs", { 
        count: openaiResults.filter(r => r.openaiFileId).length 
      });
    }

    metadata.set("status", { label: "Starting competitor analysis", progress: 85 });

    // Step 5: Trigger competitor analysis (async, don't wait)
    try {
      await analyzeCompetitorsTask.trigger(
        { dealId: payload.dealId },
        { tags: [`deal:${payload.dealId}`] }
      );
      logger.log("Competitor analysis triggered", { dealId: payload.dealId });
    } catch (error) {
      logger.error("Failed to trigger competitor analysis", { error: String(error) });
      // Don't fail the entire process if competitor analysis fails to trigger
    }

    metadata.set("status", { label: "Upload orchestration completed", progress: 100 });

    // Return the updated deal with files
    const dealWithFiles = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      include: { files: true },
    });

    return {
      success: true,
      deal: dealWithFiles,
    };
  },
});
