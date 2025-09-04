import { logger, task, metadata, batch } from "@trigger.dev/sdk/v3";
import { prisma } from "../lib/prisma";
import { uploadToOpenAITask } from "./uploadToOpenAI";
import { analyzeDealTask } from "./analyzeDeal";
import { analyzeCompetitorsTask } from "./analyzeCompetitors";
import { ALL_COMPETITOR_TYPES } from "./utils/sanitize";
import { evaluateCompetitorTask } from "./evaluateCompetitor";

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
    console.log("🚀 Starting upload orchestration process");
    console.log("📋 Payload received:", {
      dealId: payload.dealId,
      userId: payload.userId,
      fileCount: payload.s3Files?.length || 0,
      hasFreeText: !!payload.freeText
    });
    
    console.log("🔍 Validating payload requirements...");
    if (!payload.dealId) {
      console.error("❌ Missing dealId in payload");
      throw new Error("dealId is required");
    }
    if (!payload.userId) {
      console.error("❌ Missing userId in payload");
      throw new Error("userId is required");
    }

    if (!payload.s3Files || payload.s3Files.length === 0) {
      if (!payload.freeText) {
        console.error("❌ Neither s3Files nor freeText provided");
        throw new Error("Either s3Files or freeText must be provided");
      }
    }

    console.log("✅ Payload validation successful");
    console.log("📊 Processing details:");
    console.log("  🎯 Deal ID:", payload.dealId);
    console.log("  👤 User ID:", payload.userId);
    console.log("  📁 File count:", payload.s3Files?.length || 0);
    console.log("  📝 Has free text:", !!payload.freeText);

    logger.log("Starting upload orchestration", {
      dealId: payload.dealId,
      userId: payload.userId,
      fileCount: payload.s3Files?.length || 0,
      hasFreeText: !!payload.freeText,
    });

    metadata.set("status", { label: "Initializing upload process", progress: 5 });

    // Step 1: Upload files to OpenAI (S3 upload already done in API)
    console.log("📤 Step 1: Preparing OpenAI file uploads...");
    let openaiResults: any[] = [];

    if (payload.s3Files && payload.s3Files.length > 0) {
      console.log("🔄 Files detected, starting OpenAI upload process");
      console.log("📊 Files to upload:", payload.s3Files.map(f => f.originalFilename));
      metadata.set("status", { label: "Uploading files to OpenAI", progress: 15 });

      console.log("🚀 Triggering OpenAI upload task...");
      const uploadResults = await batch.triggerByTaskAndWait([
        {
          task: uploadToOpenAITask,
          payload: { s3Files: payload.s3Files },
        },
      ]);

      console.log("📥 OpenAI upload task completed, checking results...");
      const [openaiRun] = uploadResults.runs;

      if (!openaiRun.ok) {
        console.error("❌ OpenAI upload task failed");
        logger.error("OpenAI upload failed", { error: (openaiRun as any).error });
        throw new Error(`OpenAI upload failed: ${(openaiRun as any).error}`);
      }

      openaiResults = openaiRun.output;
      console.log("✅ OpenAI upload successful!");
      console.log("📋 Upload results summary:");
      console.log("  📁 Total results:", openaiResults.length);
      console.log("  ✅ Successful uploads:", openaiResults.filter(r => r.openaiFileId).length);
      console.log("  ❌ Failed uploads:", openaiResults.filter(r => !r.openaiFileId).length);

      logger.log("OpenAI upload completed", {
        openaiCount: openaiResults.length,
      });
    } else {
      console.log("ℹ️ No files to upload to OpenAI, skipping upload step");
    }

    metadata.set("status", { label: "Processing uploaded files", progress: 40 });

    // Step 2: Update file records with OpenAI file IDs FIRST
    console.log("🔄 Step 2: Processing OpenAI upload results...");
    const openaiFileIds = openaiResults.map(result => result.openaiFileId).filter(Boolean);
    
    console.log("📊 OpenAI file ID extraction complete:");
    console.log("  📁 Total upload results:", openaiResults.length);
    console.log("  ✅ Valid file IDs:", openaiFileIds.length);
    console.log("  🔗 File IDs:", openaiFileIds);
    
    logger.log("Prepared OpenAI file IDs for analysis", {
      totalResults: openaiResults.length,
      validFileIds: openaiFileIds.length,
      fileIds: openaiFileIds
    });

    if (payload.s3Files && payload.s3Files.length > 0 && openaiResults.length > 0) {
      console.log("💾 Updating database records with OpenAI file IDs...");
      let updatedCount = 0;
      
      for (let i = 0; i < payload.s3Files.length; i++) {
        const file = payload.s3Files[i];
        const openaiResult = openaiResults[i];
        
        if (openaiResult?.openaiFileId) {
          console.log(`🔗 Updating file record: ${file.originalFilename} -> ${openaiResult.openaiFileId}`);
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
          updatedCount++;
        } else {
          console.log(`⚠️ No OpenAI file ID for: ${file.originalFilename}`);
        }
      }

      console.log("✅ Database update complete!");
      console.log(`📊 Updated ${updatedCount} file records with OpenAI IDs`);
      
      logger.log("File records updated with OpenAI file IDs", { 
        count: openaiResults.filter(r => r.openaiFileId).length 
      });
    } else {
      console.log("ℹ️ No file records to update, skipping database update step");
    }

    metadata.set("status", { label: "Starting document analysis", progress: 50 });

    // Step 3: Analyze deal documents and competitors in parallel
    console.log("🔍 Step 3: Starting comprehensive document analysis...");
    console.log("📊 Analysis tasks to run:");
    console.log("  📝 Deal analysis task");
    console.log("  🏢 Competitor analysis tasks:", ALL_COMPETITOR_TYPES.length);
    console.log("  🎯 Competitor types:", ALL_COMPETITOR_TYPES);
    
    console.log("🚀 Triggering parallel analysis tasks...");
    const analysisResults = await batch.triggerByTaskAndWait([
      {
        task: analyzeDealTask,
        payload: {
          openaiFileIds,
          freeText: payload.freeText,
        },
      },
      ...ALL_COMPETITOR_TYPES.map((competitorType) => ({
        task: analyzeCompetitorsTask,
        payload: {
          dealId: payload.dealId,
          competitorType,
        },
      })),
    ]);

    console.log("📥 Analysis tasks completed, processing results...");
    const [dealAnalysisRun, ...competitorAnalysisRuns] = analysisResults.runs;

    console.log("🔍 Checking deal analysis results...");
    if (!dealAnalysisRun.ok) {
      console.error("❌ Deal analysis task failed");
      logger.error("Deal analysis failed", { error: (dealAnalysisRun as any).error });
      throw new Error(`Deal analysis failed: ${(dealAnalysisRun as any).error}`);
    }
    console.log("✅ Deal analysis completed successfully");

    console.log("🏢 Processing competitor analysis results...");
    const competitorIds: string[] = [];
    let successfulCompetitorRuns = 0;
    let failedCompetitorRuns = 0;
    
    for (const run of competitorAnalysisRuns) {
      if (!run.ok) {
        console.error("❌ Competitor analysis run failed:", (run as any).error);
        logger.error("Competitor analysis failed", { error: (run as any).error });
        failedCompetitorRuns++;
        continue;
      }
      const out = run.output as any;
      if (out?.competitorIds && Array.isArray(out.competitorIds)) {
        console.log(`✅ Found ${out.competitorIds.length} competitors from this analysis`);
        competitorIds.push(...out.competitorIds);
        successfulCompetitorRuns++;
      } else {
        console.log("ℹ️ No competitors found in this analysis run");
        successfulCompetitorRuns++;
      }
    }
    
    console.log("📊 Competitor analysis summary:");
    console.log("  ✅ Successful runs:", successfulCompetitorRuns);
    console.log("  ❌ Failed runs:", failedCompetitorRuns);
    console.log("  🏢 Total competitors found:", competitorIds.length);

    const dealAnalysis = dealAnalysisRun.output;
    const competitorAnalysis = null; // Results are saved directly per-competitor; nothing to aggregate here

    // Step 4: Evaluate all created competitors in parallel
    console.log("⚖️ Step 4: Starting competitor evaluations...");
    if (competitorIds.length > 0) {
      console.log(`🚀 Triggering ${competitorIds.length} competitor evaluation tasks`);
      console.log("🏢 Competitor IDs to evaluate:", competitorIds);
      
      logger.log("Triggering competitor evaluations", { count: competitorIds.length });
      await batch.triggerByTaskAndWait(
        competitorIds.map((competitorId) => ({
          task: evaluateCompetitorTask,
          payload: { competitorId },
        }))
      );
      console.log("✅ All competitor evaluations completed");
    } else {
      console.log("ℹ️ No competitors found to evaluate, skipping evaluation step");
    }

    metadata.set("status", { label: "Updating deal with extracted information", progress: 80 });

    // Step 5: Update existing deal record with extracted data
    console.log("💾 Step 5: Updating deal record with extracted information...");
    console.log("📊 Deal analysis results to save:");
    console.log("  🏢 Company name:", dealAnalysis.deal_name);
    console.log("  📝 Description length:", dealAnalysis.deal_description?.length || 0, "characters");
    console.log("  👥 Founding team members:", dealAnalysis.deal_founding_team?.length || 0);
    
    const deal = await prisma.deal.update({
      where: { id: payload.dealId },
      data: {
        companyName: dealAnalysis.deal_name,
        description: dealAnalysis.deal_description,
        foundingTeam: dealAnalysis.deal_founding_team,
      },
    });

    console.log("✅ Deal record updated successfully!");
    console.log("🎯 Updated deal ID:", deal.id);
    
    logger.log("Deal updated with extracted information", { dealId: deal.id });

    metadata.set("status", { label: "Upload orchestration completed", progress: 100 });

    // Return the updated deal with files
    console.log("📋 Fetching final deal data with files...");
    const dealWithFiles = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      include: { files: true },
    });

    console.log("🎉 Upload orchestration completed successfully!");
    console.log("📊 Final summary:");
    console.log("  🎯 Deal ID:", dealWithFiles?.id);
    console.log("  📁 Files attached:", dealWithFiles?.files?.length || 0);
    console.log("  🏢 Competitors found:", competitorIds.length);

    return {
      success: true,
      deal: dealWithFiles,
    };
  },
});
