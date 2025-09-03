import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { IncomingForm } from 'formidable'
import { uploadOrchestratorTask } from '../../../trigger/uploadOrchestrator'

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
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

    // Validate PDF files and upload to S3
    const s3UploadPromises = uploadedFiles.map(async (file) => {
      // Enforce PDF-only uploads server-side
      const isPdf = file.mimetype === 'application/pdf' || (file.originalFilename || '').toLowerCase().endsWith('.pdf')
      if (!isPdf) {
        throw new Error(`Only PDF files are allowed. Rejected: ${file.originalFilename}`)
      }
      
      const s3Url = await uploadToS3(file)
      return {
        s3Url,
        originalFilename: file.originalFilename,
        mimetype: file.mimetype,
        size: file.size,
      }
    })

    const s3Results = await Promise.all(s3UploadPromises)

    // Create deal immediately with placeholder data
    const deal = await prisma.deal.create({
      data: {
        companyName: 'Processing...',
        description: 'Analyzing documents to extract company information...',
        foundingTeam: [
          {
            name: 'Analyzing...',
            role: 'Processing documents',
            description: 'Extracting team information from uploaded files...',
          },
        ],
        assignedToId: session.user.id,
        deleted: false,
      },
    })

    // Create file records immediately
    if (s3Results.length > 0) {
      const fileRecords = s3Results.map(file => ({
        filename: file.originalFilename,
        originalName: file.originalFilename,
        mimeType: file.mimetype,
        size: file.size,
        url: file.s3Url,
        openaiFileId: null, // Will be updated by the task
        dealId: deal.id,
      }))

      await prisma.dealFile.createMany({
        data: fileRecords,
      })
    }

    // Trigger the upload orchestrator task with the deal ID
    const orchestratorResult = await uploadOrchestratorTask.trigger({
      dealId: deal.id, // Pass the existing deal ID
      userId: session.user.id,
      s3Files: s3Results,
      freeText: freeText || undefined,
    })

    // Get the deal with files for the response
    const dealWithFiles = await prisma.deal.findUnique({
      where: { id: deal.id },
      include: { files: true },
    })

    return res.status(201).json({
      success: true,
      deal: dealWithFiles,
      taskId: orchestratorResult.id,
      message: 'Deal created. Processing in the background.',
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