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
    if (!payload.s3Files || payload.s3Files.length === 0) {
      throw new Error("No S3 files provided for OpenAI upload");
    }

    logger.log("Starting OpenAI upload from S3", { fileCount: payload.s3Files.length });
    metadata.set("status", { label: "Starting OpenAI upload", progress: 5 });

    const results = [];
    const totalFiles = payload.s3Files.length;

    for (let i = 0; i < payload.s3Files.length; i++) {
      const file = payload.s3Files[i];
      const progressPercent = Math.round(((i + 1) / totalFiles) * 100);
      
      metadata.set("status", { 
        label: `Uploading ${file.originalFilename} to OpenAI`, 
        progress: progressPercent,
        currentFile: i + 1,
        totalFiles: totalFiles
      });

      try {
        logger.log(`Downloading file from S3 and uploading to OpenAI`, {
          s3Url: file.s3Url,
          originalFilename: file.originalFilename,
          size: file.size,
          mimetype: file.mimetype,
        });

        // Download file from S3
        const response = await fetch(file.s3Url);
        if (!response.ok) {
          throw new Error(`Failed to download file from S3: ${response.statusText}`);
        }

        const openaiFile = await openai.files.create({
          file: response,
          purpose: 'assistants',
        });

        results.push({
          originalFilename: file.originalFilename,
          openaiFileId: openaiFile.id,
          size: file.size,
          mimetype: file.mimetype,
        });

        logger.log(`Successfully uploaded ${file.originalFilename} to OpenAI`, { 
          openaiFileId: openaiFile.id 
        });

      } catch (error) {
        logger.error(`Failed to upload ${file.originalFilename} to OpenAI`, { 
          error: String(error),
          filename: file.originalFilename 
        });
        
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
      }
    }

    metadata.set("status", { label: "OpenAI upload completed", progress: 100 });
    
    const successfulUploads = results.filter(r => r.openaiFileId !== null).length;
    const failedUploads = results.filter(r => r.openaiFileId === null).length;
    
    logger.log("OpenAI upload process completed", { 
      total: results.length,
      successful: successfulUploads,
      failed: failedUploads 
    });

    return results;
  },
});
