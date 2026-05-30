import { Router, type Request, type Response } from 'express'
import crypto from 'crypto'
import { getDb } from '../database/db'
import { authenticateToken } from '../middleware/auth'
import { loadRequestUserContext, isAdministrator, type RequestUserContext } from '../middleware/organizationAccess'

const router = Router()

type FieldType =
  | 'short_text' | 'date' | 'long_text' | 'single_choice' | 'multiple_choice'
  | 'attachment' | 'signature' | 'confirmation' | 'custom_table' | 'rating' | 'comment' | 'matrix_likert_scale'
  | 'location'

type ColType = 'text' | 'number' | 'date' | 'checkbox' | 'list'

interface TableColumnInput {
  name: string
  colType: ColType
  listOptions?: string[]
  sortOrder?: number
}

interface FieldInput {
  fieldKey?: string
  type: FieldType
  label: string
  subtitle?: string | null
  page?: number
  required?: boolean
  options?: string[]
  displayStyle?: string
  sortOrder?: number
  tableColumns?: TableColumnInput[]
}

interface DbTicketTemplate {
  id: number
  organization_id: number | null
  organization_name: string | null
  title: string
  description: string | null
  created_by: number | null
  is_active: number
  created_at: string
  updated_at: string
  field_count?: number
  assignment_count?: number
}

function canManageTicketTemplates(context: RequestUserContext): boolean {
  return context.role === 'super_admin' || context.role === 'administrator' || context.role === 'team_manager'
}

function resolveFieldDisplayStyle(type: FieldType, displayStyle?: string): string {
  if (type === 'single_choice') {
    return displayStyle === 'dropdown' ? 'dropdown' : 'radio'
  }

  if (type === 'rating') {
    return displayStyle === 'numbers' ? 'numbers' : 'stars'
  }

  return 'radio'
}

function shouldUseOrganizationTemplateScope(req: Request): boolean {
  return req.query.scope === 'organization'
}

function shouldCreateOrganizationTemplate(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    return false
  }

  return (body as { organizationOnly?: unknown }).organizationOnly === true
}

function buildTemplateScope(
  context: RequestUserContext,
  options: { forceOrganizationScope?: boolean } = {},
): { clause: string; params: Array<number> } {
  if (isAdministrator(context) && !options.forceOrganizationScope) {
    return { clause: '', params: [] }
  }

  if (!context.organizationId) {
    return { clause: 'WHERE 1 = 0', params: [] }
  }

  return { clause: 'WHERE tt.organization_id = ?', params: [context.organizationId] }
}

function fetchAccessibleTemplate(
  templateId: number,
  context: RequestUserContext,
  options: { forceOrganizationScope?: boolean } = {},
): DbTicketTemplate | undefined {
  const db = getDb()
  const scope = buildTemplateScope(context, options)
  const whereClause = scope.clause ? `${scope.clause} AND tt.id = ?` : 'WHERE tt.id = ?'
  return db.prepare(`
    SELECT
      tt.*, 
      o.name AS organization_name,
      (SELECT COUNT(*) FROM ticket_fields tf WHERE tf.ticket_template_id = tt.id) AS field_count,
      (SELECT COUNT(*) FROM collection_ticket_templates ctt WHERE ctt.ticket_template_id = tt.id AND ctt.is_active = 1) AS assignment_count
    FROM ticket_templates tt
    LEFT JOIN organizations o ON o.id = tt.organization_id
    ${whereClause}
    LIMIT 1
  `).get(...scope.params, templateId) as DbTicketTemplate | undefined
}

function toApiTemplate(row: DbTicketTemplate) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    title: row.title,
    description: row.description,
    createdBy: row.created_by,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fieldCount: row.field_count ?? 0,
    assignmentCount: row.assignment_count ?? 0,
  }
}

router.get('/', authenticateToken, (req: Request, res: Response): void => {
  const context = loadRequestUserContext(req)
  if (!context || !canManageTicketTemplates(context)) {
    res.status(403).json({ error: 'Manager access required' })
    return
  }

  const db = getDb()
  const scope = buildTemplateScope(context, {
    forceOrganizationScope: shouldUseOrganizationTemplateScope(req),
  })
  const rows = db.prepare(`
    SELECT
      tt.*, 
      o.name AS organization_name,
      (SELECT COUNT(*) FROM ticket_fields tf WHERE tf.ticket_template_id = tt.id) AS field_count,
      (SELECT COUNT(*) FROM collection_ticket_templates ctt WHERE ctt.ticket_template_id = tt.id AND ctt.is_active = 1) AS assignment_count
    FROM ticket_templates tt
    LEFT JOIN organizations o ON o.id = tt.organization_id
    ${scope.clause}
    ORDER BY lower(tt.title) ASC, tt.id ASC
  `).all(...scope.params) as DbTicketTemplate[]

  res.json(rows.map(toApiTemplate))
})

router.post('/', authenticateToken, (req: Request, res: Response): void => {
  const context = loadRequestUserContext(req)
  if (!context || !canManageTicketTemplates(context)) {
    res.status(403).json({ error: 'Manager access required' })
    return
  }

  const body = req.body as { title?: unknown; description?: unknown; organizationOnly?: unknown }
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const organizationOnly = shouldCreateOrganizationTemplate(body)
  if (!title) {
    res.status(400).json({ error: 'Template title is required' })
    return
  }

  if (organizationOnly && !context.organizationId) {
    res.status(400).json({ error: 'Organization is required to create an organization-scoped template' })
    return
  }

  const db = getDb()
  const inserted = db.prepare(`
    INSERT INTO ticket_templates (organization_id, title, description, created_by)
    VALUES (?, ?, ?, ?)
  `).run(
    organizationOnly ? context.organizationId : (isAdministrator(context) ? null : context.organizationId),
    title,
    description || null,
    context.id,
  )

  const created = fetchAccessibleTemplate(Number(inserted.lastInsertRowid), context, {
    forceOrganizationScope: organizationOnly,
  })
  if (!created) {
    res.status(500).json({ error: 'Failed to create template' })
    return
  }

  res.status(201).json(toApiTemplate(created))
})

router.patch('/:id', authenticateToken, (req: Request, res: Response): void => {
  const context = loadRequestUserContext(req)
  const id = Number(req.params.id)
  if (!context || !canManageTicketTemplates(context) || !Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  const existing = fetchAccessibleTemplate(id, context)
  if (!existing) {
    res.status(404).json({ error: 'Ticket template not found' })
    return
  }

  const body = req.body as { title?: unknown; description?: unknown; isActive?: unknown }
  const title = typeof body.title === 'string' ? body.title.trim() : existing.title
  const description = typeof body.description === 'string'
    ? (body.description.trim() || null)
    : existing.description
  const isActive = typeof body.isActive === 'boolean' ? (body.isActive ? 1 : 0) : existing.is_active

  if (!title) {
    res.status(400).json({ error: 'Template title is required' })
    return
  }

  const db = getDb()
  db.prepare(`
    UPDATE ticket_templates
    SET title = ?, description = ?, is_active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(title, description, isActive, id)

  const updated = fetchAccessibleTemplate(id, context)
  if (!updated) {
    res.status(500).json({ error: 'Failed to update template' })
    return
  }

  res.json(toApiTemplate(updated))
})

router.get('/:id/fields', authenticateToken, (req: Request, res: Response): void => {
  const context = loadRequestUserContext(req)
  const id = Number(req.params.id)
  if (!context || !canManageTicketTemplates(context) || !Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  const template = fetchAccessibleTemplate(id, context)
  if (!template) {
    res.status(404).json({ error: 'Ticket template not found' })
    return
  }

  const db = getDb()
  const fields = db.prepare(`
    SELECT * FROM ticket_fields
    WHERE ticket_template_id = ?
    ORDER BY page_number ASC, sort_order ASC, id ASC
  `).all(id) as Array<{
    id: number
    field_key: string | null
    type: string
    label: string
    subtitle: string | null
    page_number: number
    required: number
    options: string | null
    display_style: string
    sort_order: number
  }>

  const fieldIds = fields.map(field => field.id)
  const cols = fieldIds.length > 0
    ? db.prepare(`
        SELECT * FROM ticket_table_columns
        WHERE ticket_field_id IN (${fieldIds.map(() => '?').join(',')})
        ORDER BY sort_order ASC, id ASC
      `).all(...fieldIds) as Array<{
        id: number
        ticket_field_id: number
        name: string
        col_type: string
        list_options: string | null
        sort_order: number
      }>
    : []

  const colsByField = new Map<number, typeof cols>()
  cols.forEach(col => {
    const group = colsByField.get(col.ticket_field_id) ?? []
    group.push(col)
    colsByField.set(col.ticket_field_id, group)
  })

  res.json(fields.map(field => ({
    id: field.id,
    fieldKey: field.field_key ?? `tf-${field.id}`,
    type: field.type,
    label: field.label,
    subtitle: field.subtitle,
    page: field.page_number,
    required: field.required === 1,
    options: field.options ? (JSON.parse(field.options) as string[]) : null,
    displayStyle: resolveFieldDisplayStyle(field.type as FieldType, field.display_style),
    sortOrder: field.sort_order,
    tableColumns: field.type === 'custom_table'
      ? (colsByField.get(field.id) ?? []).map(col => ({
          id: col.id,
          name: col.name,
          colType: col.col_type,
          listOptions: col.col_type === 'list' && col.list_options ? (JSON.parse(col.list_options) as string[]) : null,
          sortOrder: col.sort_order,
        }))
      : null,
  })))
})

router.put('/:id/fields', authenticateToken, (req: Request, res: Response): void => {
  const context = loadRequestUserContext(req)
  const id = Number(req.params.id)
  if (!context || !canManageTicketTemplates(context) || !Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  const template = fetchAccessibleTemplate(id, context)
  if (!template) {
    res.status(404).json({ error: 'Ticket template not found' })
    return
  }

  const body = req.body as { fields?: FieldInput[] }
  const fields = Array.isArray(body.fields) ? body.fields : []
  const db = getDb()
  const existingFields = db.prepare(`
    SELECT id, field_key FROM ticket_fields WHERE ticket_template_id = ?
  `).all(id) as Array<{ id: number; field_key: string | null }>
  const oldFieldIds = existingFields.map(field => field.id)
  const existingFieldKeyById = new Map(existingFields.map(field => [field.id, field.field_key?.trim() || `tf-${field.id}`]))

  try { db.exec('PRAGMA foreign_keys = OFF') } catch { /* Turso */ }

  db.prepare('DELETE FROM ticket_fields WHERE ticket_template_id = ?').run(id)

  const newFieldIdByKey = new Map<string, number>()
  fields.forEach((field, index) => {
    const normalizedFieldKey = field.fieldKey?.trim() || crypto.randomUUID()
    const inserted = db.prepare(`
      INSERT INTO ticket_fields (
        collection_id,
        ticket_template_id,
        field_key,
        type,
        label,
        subtitle,
        page_number,
        required,
        options,
        display_style,
        sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      null,
      id,
      normalizedFieldKey,
      field.type,
      field.label,
      field.subtitle?.trim() || null,
      Math.max(1, Math.floor(field.page ?? 1)),
      field.required ? 1 : 0,
      field.options?.length ? JSON.stringify(field.options) : null,
      resolveFieldDisplayStyle(field.type, field.displayStyle),
      field.sortOrder ?? index,
    )

    const fieldId = Number(inserted.lastInsertRowid)
    newFieldIdByKey.set(normalizedFieldKey, fieldId)

    if (field.type === 'custom_table' && field.tableColumns?.length) {
      field.tableColumns.forEach((column, columnIndex) => {
        db.prepare(`
          INSERT INTO ticket_table_columns (ticket_field_id, name, col_type, list_options, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          fieldId,
          column.name,
          column.colType,
          column.colType === 'list'
            ? JSON.stringify((column.listOptions ?? []).map(option => option.trim()).filter(Boolean))
            : null,
          column.sortOrder ?? columnIndex,
        )
      })
    }
  })

  if (oldFieldIds.length > 0) {
    const remapValueField = db.prepare('UPDATE ticket_response_values SET ticket_field_id = ? WHERE ticket_field_id = ?')
    const obsoleteFieldIds: number[] = []

    oldFieldIds.forEach(oldFieldId => {
      const fieldKey = existingFieldKeyById.get(oldFieldId)
      const replacementFieldId = fieldKey ? newFieldIdByKey.get(fieldKey) : undefined
      if (replacementFieldId) {
        remapValueField.run(replacementFieldId, oldFieldId)
      } else {
        obsoleteFieldIds.push(oldFieldId)
      }
    })

    if (obsoleteFieldIds.length > 0) {
      db.prepare(`DELETE FROM ticket_response_values WHERE ticket_field_id IN (${obsoleteFieldIds.map(() => '?').join(',')})`).run(...obsoleteFieldIds)
    }
  }

  try { db.exec('PRAGMA foreign_keys = ON') } catch { /* Turso */ }
  res.json({ ok: true })
})

export default router