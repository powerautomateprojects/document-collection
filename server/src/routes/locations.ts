import { Router, type Request, type Response } from 'express'
import { getDb } from '../database/db'
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth'
import { loadRequestUserContext } from '../middleware/organizationAccess'

function extractLocationNames(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload
      .map(item => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          const name = record.NAME ?? record.name ?? record.Name
          return typeof name === 'string' ? name : ''
        }
        return ''
      })
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const features = record.features
    if (Array.isArray(features)) {
      return features
        .map(feature => {
          if (feature && typeof feature === 'object') {
            const featureRecord = feature as Record<string, unknown>
            const properties = featureRecord.properties
            if (properties && typeof properties === 'object') {
              const propertyRecord = properties as Record<string, unknown>
              const name = propertyRecord.NAME ?? propertyRecord.name ?? propertyRecord.Name
              return typeof name === 'string' ? name : ''
            }
          }
          return ''
        })
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    }

    const name = record.NAME ?? record.name ?? record.Name
    if (typeof name === 'string' && name.trim()) return [name.trim()]
  }

  return []
}

const router = Router()

interface DbLocation {
  id: number
  name: string
  organization_id: number
  created_at: string
}

// ── GET /api/locations — list / typeahead search (public) ────
router.get('/', optionalAuthenticateToken, (req: Request, res: Response) => {
  const db = getDb()
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

  // If authenticated, scope to the caller's organization (or all orgs for super_admin).
  // If unauthenticated, require a collection slug to determine the organization.
  const context = loadRequestUserContext(req)

  let resolvedOrgId: number | null | 'all' = null

  if (context) {
    // Authenticated — use org scope (null org = super_admin, sees all)
    resolvedOrgId = context.organizationId ?? 'all'
  } else {
    // Unauthenticated — require ?slug= to scope by collection org
    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : ''
    if (!slug) {
      res.status(400).json({ error: 'slug parameter required for unauthenticated access' })
      return
    }
    const col = db
      .prepare('SELECT organization_id FROM collections WHERE slug = ?')
      .get(slug) as unknown as { organization_id: number } | undefined
    if (!col) {
      res.status(404).json({ error: 'Collection not found' })
      return
    }
    resolvedOrgId = col.organization_id
  }

  let rows: DbLocation[]
  if (resolvedOrgId === 'all') {
    rows = q
      ? db
          .prepare(
            `SELECT id, name, organization_id, created_at
             FROM locations
             WHERE lower(name) LIKE lower(?)
             ORDER BY lower(name)
             LIMIT 20`
          )
          .all(`%${q}%`) as unknown as DbLocation[]
      : db
          .prepare(
            `SELECT id, name, organization_id, created_at
             FROM locations
             ORDER BY lower(name)`
          )
          .all() as unknown as DbLocation[]
  } else {
    rows = q
      ? db
          .prepare(
            `SELECT id, name, organization_id, created_at
             FROM locations
             WHERE organization_id = ? AND lower(name) LIKE lower(?)
             ORDER BY lower(name)
             LIMIT 20`
          )
          .all(resolvedOrgId, `%${q}%`) as unknown as DbLocation[]
      : db
          .prepare(
            `SELECT id, name, organization_id, created_at
             FROM locations
             WHERE organization_id = ?
             ORDER BY lower(name)`
          )
          .all(resolvedOrgId) as unknown as DbLocation[]
  }

  res.json(
    rows.map(l => ({
      id: l.id,
      name: l.name,
      organizationId: l.organization_id,
      createdAt: l.created_at,
    }))
  )
})

// ── POST /api/locations — create (admin+) ────────────────────
router.post('/', authenticateToken, (req: Request, res: Response) => {
  const context = loadRequestUserContext(req)
  if (!context) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (context.role !== 'administrator' && context.role !== 'super_admin') {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }

  const { name } = req.body as { name?: unknown }
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  const db = getDb()

  try {
    const r = db
      .prepare(
        `INSERT INTO locations (name, organization_id)
         VALUES (?, ?)`
      )
      .run(name.trim(), context.organizationId)

    const location = db
      .prepare('SELECT id, name, organization_id, created_at FROM locations WHERE id = ?')
      .get(r.lastInsertRowid) as unknown as DbLocation

    res.status(201).json({
      id: location.id,
      name: location.name,
      organizationId: location.organization_id,
      createdAt: location.created_at,
    })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'A location with this name already exists in the organization' })
    } else {
      console.error('[locations] create:', err)
      res.status(500).json({ error: 'Failed to create location' })
    }
  }
})

// ── POST /api/locations/import — bulk import from configured JSON URL (admin+) ───────────────
router.post('/import', authenticateToken, async (req: Request, res: Response) => {
  const context = loadRequestUserContext(req)
  if (!context) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (context.role !== 'administrator' && context.role !== 'super_admin') {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }

  const body = req.body as { url?: unknown }
  const providedUrl = typeof body?.url === 'string' ? body.url.trim() : ''
  const importUrl = providedUrl || process.env.IMPORT_JSON_URL?.trim()
  if (!importUrl) {
    res.status(400).json({ error: 'An import URL is required' })
    return
  }

  let payload: unknown
  try {
    const response = await fetch(importUrl)
    if (!response.ok) {
      res.status(502).json({ error: `Failed to fetch import data (${response.status})` })
      return
    }

    payload = await response.json()
  } catch (err) {
    console.error('[locations] import fetch:', err)
    res.status(502).json({ error: 'Failed to read import data from the provided URL' })
    return
  }

  const names = extractLocationNames(payload)
  const normalizedNames = names
    .map(name => name.trim())
    .filter(name => name.length > 0)

  const dedupedNames: string[] = []
  const seen = new Set<string>()
  for (const name of normalizedNames) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    dedupedNames.push(name)
  }

  const db = getDb()
  const existingRows = context.organizationId === null
    ? db.prepare('SELECT lower(name) AS name_key FROM locations WHERE organization_id IS NULL').all() as Array<{ name_key: string }>
    : db.prepare('SELECT lower(name) AS name_key FROM locations WHERE organization_id = ?').all(context.organizationId) as Array<{ name_key: string }>
  const existingNames = new Set(existingRows.map(row => row.name_key.toLowerCase()))

  const createdNames: string[] = []
  const skippedNames: string[] = []

  for (const name of dedupedNames) {
    if (existingNames.has(name.toLowerCase())) {
      skippedNames.push(name)
      continue
    }

    try {
      db.prepare('INSERT INTO locations (name, organization_id) VALUES (?, ?)').run(name, context.organizationId)
      existingNames.add(name.toLowerCase())
      createdNames.push(name)
    } catch (err) {
      console.error('[locations] import create failed:', err)
      skippedNames.push(name)
    }
  }

  res.json({
    imported: createdNames.length,
    skipped: skippedNames.length,
    total: dedupedNames.length,
    names: createdNames,
  })
})

// ── PATCH /api/locations/:id — rename (admin+) ───────────────
router.patch('/:id', authenticateToken, (req: Request, res: Response) => {
  const context = loadRequestUserContext(req)
  if (!context) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (context.role !== 'administrator' && context.role !== 'super_admin') {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }

  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid location ID' })
    return
  }

  const { name } = req.body as { name?: unknown }
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  const db = getDb()
  const existing = db
    .prepare('SELECT id, organization_id FROM locations WHERE id = ?')
    .get(id) as unknown as { id: number; organization_id: number } | undefined

  if (!existing) {
    res.status(404).json({ error: 'Location not found' })
    return
  }

  if (context.role === 'administrator' && existing.organization_id !== context.organizationId) {
    res.status(403).json({ error: 'You can only update locations within your own organization' })
    return
  }

  try {
    db.prepare('UPDATE locations SET name = ? WHERE id = ?').run(name.trim(), id)
    const updated = db
      .prepare('SELECT id, name, organization_id, created_at FROM locations WHERE id = ?')
      .get(id) as unknown as DbLocation
    res.json({
      id: updated.id,
      name: updated.name,
      organizationId: updated.organization_id,
      createdAt: updated.created_at,
    })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'A location with this name already exists in the organization' })
    } else {
      console.error('[locations] update:', err)
      res.status(500).json({ error: 'Failed to update location' })
    }
  }
})

// ── DELETE /api/locations/:id — delete (admin+) ──────────────
router.delete('/:id', authenticateToken, (req: Request, res: Response) => {
  const context = loadRequestUserContext(req)
  if (!context) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (context.role !== 'administrator' && context.role !== 'super_admin') {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }

  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid location ID' })
    return
  }

  const db = getDb()
  const location = db
    .prepare('SELECT id, organization_id FROM locations WHERE id = ?')
    .get(id) as unknown as { id: number; organization_id: number } | undefined

  if (!location) {
    res.status(404).json({ error: 'Location not found' })
    return
  }

  // org-scoped admins can only delete their own org's locations
  if (context.role === 'administrator' && location.organization_id !== context.organizationId) {
    res.status(403).json({ error: 'You can only delete locations within your own organization' })
    return
  }

  db.prepare('DELETE FROM locations WHERE id = ?').run(id)
  res.status(204).end()
})

export default router
