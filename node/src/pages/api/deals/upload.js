import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import OpenAI from 'openai'
import { z } from 'zod'
import { zodTextFormat } from 'openai/helpers/zod'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { IncomingForm } from 'formidable'
import { analyzeCompetitorsTask } from '../../../trigger/analyzeCompetitors'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

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
})

export const config = {
  api: {
    bodyParser: false,
  },
}

async function parseForm(req, uploadDir) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      maxFileSize: 150 * 1024 * 1024, // 150MB
      uploadDir,
      keepExtensions: true,
      filename: (name, ext, part) => {
        return part.originalFilename
      },
    })
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err)
      resolve({ fields, files })
    })
  })
}

async function uploadToS3(file) {
  const fileStream = fs.createReadStream(file.filepath)
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
  const key = `${uniqueSuffix}-${file.originalFilename}`

  console.log(`Attempting to upload to bucket: ${process.env.S3_BUCKET_NAME}`)

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: fileStream,
    ContentType: file.mimetype,
  })


  await s3Client.send(command)

  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}

async function uploadToOpenAI(file) {
  console.log(`Uploading file ${file.filepath} to OpenAI`)
  try {
    const openaiFile = await openai.files.create({
      file: fs.createReadStream(file.filepath),
      purpose: 'assistants',
    })
    console.log(
      `Uploaded file ${file.originalFilename} with OpenAI ID: ${openaiFile.id}`,
    )
    return openaiFile.id
  } catch (fileError) {
    console.error(`Error uploading file ${file.originalFilename} to OpenAI:`, fileError)
    return null
  }
}

async function analyzeDealDocuments(openaiFileIds, freeText) {
  try {
    const systemPrompt =
      "You are a venture capital analyst. Read the attached documents and extract or infer details about the company, deal, and founding team. If information is not available, use 'Unknown' for that field."

    const userPrompt = freeText
      ? `Please analyze the uploaded documents for a potential investment deal.\n\nAdditional context provided: ${freeText}`
      : 'Please analyze the uploaded documents for a potential investment deal.'
    const attachments = (openaiFileIds || []).map((fileId) => ({
      type: "input_file",
      file_id: fileId
    }))

    const response = await openai.responses.parse({
      model: 'gpt-4o-2024-08-06',
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
    })

    const analysisResult = response.output_parsed
    if (analysisResult) {
      console.log('Analysis result:', analysisResult)
      return analysisResult
    }

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
    }
  } catch (error) {
    console.error('OpenAI analysis error:', error)
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
    }
  }
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (!session.user?.id) {
    return res.status(401).json({ error: 'User ID not found in session' })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let uploadDir
  try {
    uploadDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'credo-upload-'))
    const { fields, files } = await parseForm(req, uploadDir)
    const freeText = fields.freeText?.[0] || ''
    const uploadedFiles = Array.isArray(files.files)
      ? files.files
      : [files.files].filter((f) => f && f.size > 0)

    if (uploadedFiles.length === 0 && !freeText) {
      return res.status(400).json({ error: 'No files or text provided.' })
    }

    const fileProcessingPromises = uploadedFiles.map(async (file) => {
      // Enforce PDF-only uploads server-side
      const isPdf = file.mimetype === 'application/pdf' || (file.originalFilename || '').toLowerCase().endsWith('.pdf')
      if (!isPdf) {
        throw new Error(`Only PDF files are allowed. Rejected: ${file.originalFilename}`)
      }
      const s3Url = await uploadToS3(file)
      const openaiFileId = await uploadToOpenAI(file)
      return {
        s3Url,
        openaiFileId,
        originalFile: file,
      }
    })

    const processedFiles = await Promise.all(fileProcessingPromises)
    const openaiFileIds = processedFiles.map(f => f.openaiFileId).filter(Boolean)

    const analysisResult = await analyzeDealDocuments(openaiFileIds, freeText)

    const aiGeneratedData = {
      companyName: analysisResult.deal_name,
      description: analysisResult.deal_description,
      foundingTeam: analysisResult.deal_founding_team,
    }

    const deal = await prisma.deal.create({
      data: {
        ...aiGeneratedData,
        assignedToId: session.user.id,
        deleted: false,
      },
    })

    const fileRecords = processedFiles.map(file => ({
      filename: file.originalFile.newFilename,
      originalName: file.originalFile.originalFilename,
      mimeType: file.originalFile.mimetype,
      size: file.originalFile.size,
      url: file.s3Url,
      openaiFileId: file.openaiFileId,
      dealId: deal.id,
    }))

    if (fileRecords.length > 0) {
      await prisma.dealFile.createMany({
        data: fileRecords,
      })
    }

    const dealWithFiles = await prisma.deal.findUnique({
      where: { id: deal.id },
      include: { files: true },
    })

    try {
      await analyzeCompetitorsTask.trigger(
        { dealId: deal.id },
        { tags: [`deal:${deal.id}`] }
      )
    } catch (e) {
      console.error('Failed to trigger competitors analysis task', e)
    }

    return res.status(201).json({
      success: true,
      deal: dealWithFiles,
    })
  } catch (error) {
    console.error('Upload API error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  } finally {
    if (uploadDir) {
      await fs.promises.rm(uploadDir, { recursive: true, force: true })
    }
  }
}