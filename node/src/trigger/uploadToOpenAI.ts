import { logger, task, metadata } from "@trigger.dev/sdk/v3";
import OpenAI from 'openai';


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type UploadToOpenAIPayload = {
  s3Files: Array<{
    s3Url: string;
    originalFilename: string;
    mimetype: string;
    size: number;
  }>;
};

export const uploadToOpenAITask = task({
  id: "upload-to-openai",
  maxDuration: 300, // 5 minutes
  run: async (payload: UploadToOpenAIPayload) => {
    console.log("🚀 Starting OpenAI upload task");
    console.log("📋 Payload received:");
    console.log("  📁 File count:", payload.s3Files?.length || 0);
    
    console.log("🔍 Validating payload...");
    if (!payload.s3Files || payload.s3Files.length === 0) {
      console.error("❌ No S3 files provided for OpenAI upload");
      throw new Error("No S3 files provided for OpenAI upload");
    }
    console.log("✅ Payload validation successful");

    console.log("📊 Upload preparation:");
    console.log("  📁 Files to upload:", payload.s3Files.length);
    payload.s3Files.forEach((file, index) => {
      console.log(`    ${index + 1}. ${file.originalFilename} (${file.size} bytes, ${file.mimetype})`);
    });

    logger.log("Starting OpenAI upload from S3", { fileCount: payload.s3Files.length });
    metadata.set("status", { label: "Starting OpenAI upload", progress: 5 });

    console.log("🔄 Initializing upload process...");
    const results = [];
    const totalFiles = payload.s3Files.length;

    console.log("🔄 Starting file-by-file upload process...");
    for (let i = 0; i < payload.s3Files.length; i++) {
      const file = payload.s3Files[i];
      const progressPercent = Math.round(((i + 1) / totalFiles) * 100);
      
      console.log(`📤 Processing file ${i + 1}/${totalFiles}: ${file.originalFilename}`);
      metadata.set("status", { 
        label: `Uploading ${file.originalFilename} to OpenAI`, 
        progress: progressPercent,
        currentFile: i + 1,
        totalFiles: totalFiles
      });

      try {
        console.log("📊 File details:");
        console.log("  📛 Filename:", file.originalFilename);
        console.log("  📏 Size:", file.size, "bytes");
        console.log("  📄 MIME type:", file.mimetype);
        console.log("  🔗 S3 URL:", file.s3Url);
        
        logger.log(`Downloading file from S3 and uploading to OpenAI`, {
          s3Url: file.s3Url,
          originalFilename: file.originalFilename,
          size: file.size,
          mimetype: file.mimetype,
        });

        console.log("📥 Downloading file from S3...");
        // Download file from S3
        const response = await fetch(file.s3Url);
        console.log("📊 S3 download response status:", response.status);
        
        if (!response.ok) {
          console.error("❌ S3 download failed with status:", response.status);
          throw new Error(`Failed to download file from S3: ${response.statusText}`);
        }
        console.log("✅ File downloaded from S3 successfully");

        console.log("📤 Uploading file to OpenAI...");
        const openaiFile = await openai.files.create({
          file: response,
          purpose: 'assistants',
        });
        console.log("✅ File uploaded to OpenAI successfully!");
        console.log("🆔 OpenAI file ID:", openaiFile.id);

        results.push({
          originalFilename: file.originalFilename,
          openaiFileId: openaiFile.id,
          size: file.size,
          mimetype: file.mimetype,
        });

        logger.log(`Successfully uploaded ${file.originalFilename} to OpenAI`, { 
          openaiFileId: openaiFile.id 
        });
        console.log(`🎉 File ${i + 1}/${totalFiles} uploaded successfully: ${file.originalFilename}`);

      } catch (error) {
        console.error(`❌ Failed to upload file ${i + 1}/${totalFiles}: ${file.originalFilename}`);
        console.error("🔍 Error type:", error instanceof Error ? error.constructor.name : typeof error);
        console.error("📚 Error details:", error instanceof Error ? error.message : String(error));
        console.error("🔬 Error stack:", error instanceof Error ? error.stack : "No stack trace");
        
        logger.error(`Failed to upload ${file.originalFilename} to OpenAI`, { 
          error: String(error),
          filename: file.originalFilename 
        });
        
        console.log("🔄 Adding null result and continuing with remaining files...");
        // For OpenAI uploads, we'll add a null result instead of failing entirely
        // This allows the process to continue even if some files fail to upload to OpenAI
        results.push({
          originalFilename: file.originalFilename,
          openaiFileId: null,
          size: file.size,
          mimetype: file.mimetype,
          error: String(error),
        });

        logger.log(`Continuing with null OpenAI file ID for ${file.originalFilename}`);
        console.log(`⚠️ File ${i + 1}/${totalFiles} failed, but continuing process`);
      }
    }

    console.log("📊 Upload process completed, generating summary...");
    metadata.set("status", { label: "OpenAI upload completed", progress: 100 });
    
    const successfulUploads = results.filter(r => r.openaiFileId !== null).length;
    const failedUploads = results.filter(r => r.openaiFileId === null).length;
    
    console.log("🎉 OpenAI upload process completed!");
    console.log("📊 Final upload summary:");
    console.log("  📁 Total files processed:", results.length);
    console.log("  ✅ Successful uploads:", successfulUploads);
    console.log("  ❌ Failed uploads:", failedUploads);
    console.log("  📈 Success rate:", Math.round((successfulUploads / results.length) * 100) + "%");
    
    if (successfulUploads > 0) {
      console.log("  🆔 Successful OpenAI file IDs:");
      results.filter(r => r.openaiFileId).forEach((result, index) => {
        console.log(`    ${index + 1}. ${result.originalFilename} -> ${result.openaiFileId}`);
      });
    }
    
    if (failedUploads > 0) {
      console.log("  ⚠️ Failed uploads:");
      results.filter(r => !r.openaiFileId).forEach((result, index) => {
        console.log(`    ${index + 1}. ${result.originalFilename} - Error: ${(result as any).error}`);
      });
    }
    
    logger.log("OpenAI upload process completed", { 
      total: results.length,
      successful: successfulUploads,
      failed: failedUploads 
    });

    console.log("🔄 Returning upload results to orchestrator...");
    return results;
  },
});
