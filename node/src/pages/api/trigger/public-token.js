import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { auth } from '@trigger.dev/sdk/v3'

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session) return res.status(401).json({ error: 'Unauthorized' })

    const { dealId } = req.query
    if (!dealId) return res.status(400).json({ error: 'Missing dealId' })

    // Ensure the deal belongs to the current user
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, assignedToId: session.user.id, deleted: false },
      select: { id: true },
    })
    if (!deal) return res.status(404).json({ error: 'Deal not found' })

    const token = await auth.createPublicToken({
      scopes: {
        read: {
          tags: [`deal:${dealId}`],
        },
      },
    })

    return res.status(200).json({ token })
  } catch (error) {
    console.error('Public token API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}


