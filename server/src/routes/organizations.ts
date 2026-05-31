import { Router, type Request, type Response } from 'express'
import { getDb } from '../database/db'
import { authenticateToken } from '../middleware/auth'

const router = Router()

interface DbOrganization {
  id: number
  name: string
  slug: string | null
  description: string | null
  is_active: number
  created_at: string
  updated_at: string
  user_count?: number
  collection_count?: number
}

function toApiOrganization(row: DbOrganization) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userCount: row.user_count ?? 0,
    collectionCount: row.collection_count ?? 0,
  }
}

function requireAdministrator(req: Request, res: Response): boolean {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'Super admin access required' })
    return false
  }

  return true
}

router.get('/', authenticateToken, (req: Request, res: Response) => {
  if (!requireAdministrator(req, res)) {
    return
  }

  const db = getDb()
  const rows = db
    .prepare(
      `SELECT o.*, 
              (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) AS user_count,
              (SELECT COUNT(*) FROM collections c WHERE c.organization_id = o.id) AS collection_count
       FROM organizations o
       ORDER BY lower(o.name) ASC`
    )
    .all() as unknown as DbOrganization[]

  res.json(rows.map(toApiOrganization))
})

router.get('/:id', authenticateToken, (req: Request, res: Response) => {
  if (!requireAdministrator(req, res)) {
    return
  }

  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid organization ID' })
    return
  }

  const db = getDb()
  const row = db
    .prepare(
      `SELECT o.*, 
              (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) AS user_count,
              (SELECT COUNT(*) FROM collections c WHERE c.organization_id = o.id) AS collection_count
       FROM organizations o
       WHERE o.id = ?`
    )
    .get(id) as unknown as DbOrganization | undefined

  if (!row) {
    res.status(404).json({ error: 'Organization not found' })
    return
  }

  res.json(toApiOrganization(row))
})

router.post('/', authenticateToken, (req: Request, res: Response) => {
  if (!requireAdministrator(req, res)) {
    return
  }

  const body = req.body as {
    name?: unknown
    slug?: unknown
    description?: unknown
    isActive?: unknown
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  const slug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : null
  const description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null
  const isActive = body.isActive === false ? 0 : 1

  const db = getDb()

  const duplicate = db
    .prepare('SELECT id FROM organizations WHERE lower(name) = lower(?)')
    .get(name) as unknown as { id: number } | undefined
  if (duplicate) {
    res.status(409).json({ error: 'Organization name already exists' })
    return
  }

  if (slug) {
    const slugDuplicate = db
      .prepare('SELECT id FROM organizations WHERE slug = ?')
      .get(slug) as unknown as { id: number } | undefined
    if (slugDuplicate) {
      res.status(409).json({ error: 'Organization slug already exists' })
      return
    }
  }

  const inserted = db
    .prepare(
      `INSERT INTO organizations (name, slug, description, is_active)
       VALUES (?, ?, ?, ?)`
    )
    .run(name, slug, description, isActive)

  const created = db
    .prepare('SELECT * FROM organizations WHERE id = ?')
    .get(Number(inserted.lastInsertRowid)) as unknown as DbOrganization

  res.status(201).json(toApiOrganization(created))
})

router.patch('/:id', authenticateToken, (req: Request, res: Response) => {
  if (!requireAdministrator(req, res)) {
    return
  }

  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid organization ID' })
    return
  }

  const body = req.body as {
    name?: unknown
    slug?: unknown
    description?: unknown
    isActive?: unknown
  }

  const db = getDb()
  const existing = db
    .prepare('SELECT * FROM organizations WHERE id = ?')
    .get(id) as unknown as DbOrganization | undefined

  if (!existing) {
    res.status(404).json({ error: 'Organization not found' })
    return
  }

  const name = typeof body.name === 'string' ? body.name.trim() : existing.name
  if (!name) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  const slug = typeof body.slug === 'string'
    ? (body.slug.trim() || null)
    : existing.slug
  const description = typeof body.description === 'string'
    ? (body.description.trim() || null)
    : existing.description
  const isActive = typeof body.isActive === 'boolean'
    ? (body.isActive ? 1 : 0)
    : existing.is_active

  const duplicate = db
    .prepare('SELECT id FROM organizations WHERE lower(name) = lower(?) AND id != ?')
    .get(name, id) as unknown as { id: number } | undefined
  if (duplicate) {
    res.status(409).json({ error: 'Organization name already exists' })
    return
  }

  if (slug) {
    const slugDuplicate = db
      .prepare('SELECT id FROM organizations WHERE slug = ? AND id != ?')
      .get(slug, id) as unknown as { id: number } | undefined
    if (slugDuplicate) {
      res.status(409).json({ error: 'Organization slug already exists' })
      return
    }
  }

  db.prepare(
    `UPDATE organizations
     SET name = ?, slug = ?, description = ?, is_active = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(name, slug, description, isActive, id)

  const updated = db
    .prepare('SELECT * FROM organizations WHERE id = ?')
    .get(id) as unknown as DbOrganization

  res.json(toApiOrganization(updated))
})

router.delete('/:id', authenticateToken, (req: Request, res: Response) => {
  if (!requireAdministrator(req, res)) {
    return
  }

  const body = req.body as { confirmationText?: unknown }
  const confirmationText = typeof body.confirmationText === 'string' ? body.confirmationText.trim() : ''
  if (confirmationText !== 'DELETE') {
    res.status(400).json({ error: 'Type DELETE to confirm organization removal' })
    return
  }

  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid organization ID' })
    return
  }

  const db = getDb()
  const existing = db
    .prepare('SELECT id FROM organizations WHERE id = ?')
    .get(id) as unknown as { id: number } | undefined

  if (!existing) {
    res.status(404).json({ error: 'Organization not found' })
    return
  }

  const userRef = db
    .prepare('SELECT COUNT(*) AS count FROM users WHERE organization_id = ?')
    .get(id) as unknown as { count: number }
  const collectionRef = db
    .prepare('SELECT COUNT(*) AS count FROM collections WHERE organization_id = ?')
    .get(id) as unknown as { count: number }

  const categoryRef = db
    .prepare('SELECT COUNT(*) AS count FROM categories WHERE organization_id = ?')
    .get(id) as unknown as { count: number }

  if (userRef.count > 0 || collectionRef.count > 0) {
    res.status(409).json({ error: 'Organization cannot be deleted while users or collections are assigned to it' })
    return
  }

  try {
    db.transaction(() => {
      if (categoryRef.count > 0) {
        db.prepare('DELETE FROM categories WHERE organization_id = ?').run(id)
      }
      db.prepare('DELETE FROM organizations WHERE id = ?').run(id)
    })()
    res.status(204).end()
  } catch (err) {
    console.error('[organizations] delete:', err)
    res.status(500).json({ error: 'Failed to delete organization' })
  }
})

export default router