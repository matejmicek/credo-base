import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions)

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.query

    if (req.method === 'GET') {
      // Fetch single deal with files
      const deal = await prisma.deal.findFirst({
        where: {
          id: id,
          assignedToId: session.user.id,
          deleted: false
        },
        include: {
          files: true,
          assignedTo: {
            select: {
              name: true,
              email: true
            }
          }
        }
      })

      if (!deal) {
        return res.status(404).json({ error: 'Deal not found' })
      }

      return res.status(200).json(deal)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Deal API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
