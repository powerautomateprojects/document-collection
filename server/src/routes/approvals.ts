import { Router, type Request, type Response } from 'express'
import { getDb } from '../database/db'
import { authenticateToken } from '../middleware/auth'
import { loadRequestUserContext } from '../middleware/organizationAccess'

const router = Router()

router.use(authenticateToken)

interface DbPendingApprovalRow {
  response_id: number
  collection_id: number
  collection_title: string
  collection_slug: string
  stage_name: string
  stage_order: number
  submitted_at: string
  respondent_name: string | null
  respondent_email: string | null
}

export interface PendingApprovalItem {
  responseId: number
  collectionId: number
  collectionTitle: string
  collectionSlug: string
  stageName: string
  stageOrder: number
  submittedAt: string
  respondentName: string | null
  respondentEmail: string | null
}

/**
 * GET /api/approvals/pending
 * Returns all responses where the authenticated user has a pending approver assignment.
 */
router.get('/pending', (req: Request, res: Response): void => {
  const context = loadRequestUserContext(req)
  if (!context) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (context.role === 'user') {
    res.json([])
    return
  }

  try {
    const db = getDb()

    const rows = db
      .prepare(
        `
        SELECT
          cr.id          AS response_id,
          c.id           AS collection_id,
          c.title        AS collection_title,
          c.slug         AS collection_slug,
          si.stage_name,
          si.stage_order,
          cr.submitted_at,
          cr.respondent_name,
          cr.respondent_email
        FROM approval_workflow_approver_instances ai
        JOIN approval_workflow_stage_instances si ON si.id = ai.stage_instance_id
        JOIN approval_workflow_instances wi       ON wi.id = si.workflow_instance_id
        JOIN collection_responses cr             ON cr.id = wi.response_id
        JOIN collections c                       ON c.id  = wi.collection_id
        WHERE ai.user_id = ?
          AND ai.status  = 'pending'
          AND si.status  = 'pending'
          AND wi.status  = 'pending'
        ORDER BY cr.submitted_at DESC
        `,
      )
      .all(context.id) as DbPendingApprovalRow[]

    const items: PendingApprovalItem[] = rows.map(row => ({
      responseId: row.response_id,
      collectionId: row.collection_id,
      collectionTitle: row.collection_title,
      collectionSlug: row.collection_slug,
      stageName: row.stage_name,
      stageOrder: row.stage_order,
      submittedAt: row.submitted_at,
      respondentName: row.respondent_name,
      respondentEmail: row.respondent_email,
    }))

    res.json(items)
  } catch (err) {
    console.error('[approvals] GET /pending failed:', (err as Error).message)
    res.status(500).json({ error: 'Failed to fetch pending approvals' })
  }
})

export default router
