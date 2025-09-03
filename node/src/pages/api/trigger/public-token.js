import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import { auth } from '@trigger.dev/sdk/v3'

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session) return res.status(401).json({ error: 'Unauthorized' })

    const { dealId, runId } = req.query
    if (!dealId && !runId) {
      return res.status(400).json({ error: 'Missing dealId or runId' })
    }

    // If a runId is provided, we can create a token scoped to just that run.
    // We still check for the deal to ensure the user has permission.
    if (runId) {
      const runDeal = await prisma.deal.findFirst({
        where: { id: dealId, assignedToId: session.user.id, deleted: false },
        select: { id: true },
      })
      if (!runDeal) return res.status(404).json({ error: 'Deal not found for run' })
      
      const token = await auth.createPublicToken({
        scopes: {
          read: {
            runs: [runId],
          },
        },
      })
      return res.status(200).json({ token })
    }

    // Ensure the deal belongs to the current user for tag-based tokens
    if (dealId) {
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
    }

    return res.status(400).json({ error: 'Invalid request' })
  } catch (error) {
    console.error('Public token API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}


