import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions)
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'GET') {
      // Fetch all non-deleted deals for the user
      const deals = await prisma.deal.findMany({
        where: {
          assignedToId: session.user.id,
          deleted: false
        },
        include: {
          files: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return res.status(200).json(deals)
    }

    if (req.method === 'POST') {
      const {
        companyName,
        description,
      } = req.body

      // Create new deal
      const deal = await prisma.deal.create({
        data: {
          companyName,
          description,
          assignedToId: session.user.id,
          deleted: false
        },
        include: {
          files: true
        }
      })

      return res.status(201).json(deal)
    }

    if (req.method === 'DELETE') {
      const { id } = req.query

      if (!id) {
        return res.status(400).json({ error: 'Deal ID is required' })
      }

      // First check if deal exists and belongs to user
      const existingDeal = await prisma.deal.findFirst({
        where: {
          id: id,
          assignedToId: session.user.id
        }
      })

      if (!existingDeal) {
        return res.status(404).json({ error: 'Deal not found' })
      }

      // Soft delete the deal
      const deal = await prisma.deal.update({
        where: {
          id: id,
          assignedToId: session.user.id
        },
        data: {
          deleted: true
        }
      })

      return res.status(200).json({ success: true, deal })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Deal API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}