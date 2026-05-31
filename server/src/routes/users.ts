import { Router, type Request, type Response } from 'express'
import { getDb } from '../database/db'
import { authenticateToken } from '../middleware/auth'
import { loadRequestUserContext } from '../middleware/organizationAccess'
import { loadUserAccessProfile, toApiUser, type MembershipRole, type UserAccessProfile, type UserRole, type UserOrganizationMembership } from '../lib/userAccess'

const router = Router()

interface MembershipInput {
  organizationId: number
  role: MembershipRole
  isDefault: boolean
}

function isMembershipRole(value: unknown): value is MembershipRole {
  return value === 'administrator' || value === 'team_manager' || value === 'reviewer' || value === 'user'
}

function normalizeMemberships(inputs: MembershipInput[]): MembershipInput[] {
  if (inputs.length === 0) {
    return []
  }

  const byOrg = new Map<number, MembershipInput>()
  inputs.forEach((input, index) => {
    byOrg.set(input.organizationId, {
      organizationId: input.organizationId,
      role: input.role,
      isDefault: input.isDefault || index === 0,
    })
  })

  const normalized = Array.from(byOrg.values())
  if (!normalized.some(item => item.isDefault)) {
    normalized[0].isDefault = true
  }

  let defaultAssigned = false
  return normalized.map(item => {
    if (item.isDefault && !defaultAssigned) {
      defaultAssigned = true
      return item
    }
    return { ...item, isDefault: false }
  })
}

function sanitizeProfileForContext(profile: UserAccessProfile, viewer: ReturnType<typeof loadRequestUserContext>): UserAccessProfile | null {
  if (!viewer) {
    return null
  }

  if (viewer.role === 'super_admin') {
    return profile
  }

  const visibleMemberships = profile.organizations.filter(org => org.organizationId === viewer.organizationId)
  if (visibleMemberships.length === 0) {
    return null
  }

  const activeMembership = visibleMemberships.find(org => org.organizationId === viewer.organizationId) ?? visibleMemberships[0]
  return {
    ...profile,
    role: activeMembership.role,
    activeOrganizationId: activeMembership.organizationId,
    activeOrganizationName: activeMembership.organizationName,
    activeOrganizationSlug: activeMembership.organizationSlug,
    activeOrganizationDescription: activeMembership.organizationDescription,
    organizationId: activeMembership.organizationId,
    organizationName: activeMembership.organizationName,
    organizationSlug: activeMembership.organizationSlug,
    organizationDescription: activeMembership.organizationDescription,
    organization: activeMembership.organizationName,
    organizations: visibleMemberships,
  }
}

function parseMembershipPayload(
  body: { role?: unknown; organizationId?: unknown; memberships?: unknown },
  currentUser: NonNullable<ReturnType<typeof loadRequestUserContext>>,
): { systemRole: UserRole; memberships: MembershipInput[] } | { error: string } {
  const requestedRole = typeof body.role === 'string' ? body.role : 'user'
  const validRoles: UserRole[] = ['super_admin', 'administrator', 'team_manager', 'reviewer', 'user']
  if (!validRoles.includes(requestedRole as UserRole)) {
    return { error: 'Invalid role' }
  }

  const rawMemberships = Array.isArray(body.memberships)
    ? body.memberships
        .map(item => {
          if (!item || typeof item !== 'object') return null
          const value = item as { organizationId?: unknown; role?: unknown; isDefault?: unknown }
          if (typeof value.organizationId !== 'number' || !Number.isInteger(value.organizationId) || value.organizationId < 1) {
            return null
          }
          if (!isMembershipRole(value.role)) {
            return null
          }
          return {
            organizationId: value.organizationId,
            role: value.role,
            isDefault: value.isDefault === true,
          }
        })
        .filter((item): item is MembershipInput => Boolean(item))
    : []

  const legacyOrganizationId = typeof body.organizationId === 'number' && Number.isInteger(body.organizationId) && body.organizationId > 0
    ? body.organizationId
    : null

  const memberships = normalizeMemberships(
    rawMemberships.length > 0
      ? rawMemberships
      : legacyOrganizationId && isMembershipRole(requestedRole)
        ? [{ organizationId: legacyOrganizationId, role: requestedRole, isDefault: true }]
        : []
  )

  if (currentUser.role !== 'super_admin' && requestedRole === 'super_admin') {
    return { error: 'You cannot assign the super_admin role' }
  }

  if (currentUser.role !== 'super_admin') {
    const viewerOrgId = currentUser.organizationId
    if (!viewerOrgId) {
      return { error: 'Your account does not have an active organization' }
    }

    const scopedRole = isMembershipRole(requestedRole) ? requestedRole : 'user'
    return {
      systemRole: scopedRole,
      memberships: [{ organizationId: viewerOrgId, role: scopedRole, isDefault: true }],
    }
  }

  if (requestedRole !== 'super_admin' && memberships.length === 0) {
    return { error: 'At least one organization membership is required' }
  }

  return {
    systemRole: requestedRole as UserRole,
    memberships,
  }
}

function loadAccessibleUserProfile(
  id: number,
  currentUser: NonNullable<ReturnType<typeof loadRequestUserContext>>,
): UserAccessProfile | null {
  const profile = loadUserAccessProfile(id)
  if (!profile) {
    return null
  }

  return sanitizeProfileForContext(profile, currentUser)
}

function persistMemberships(
  userId: number,
  systemRole: UserRole,
  memberships: MembershipInput[],
): void {
  const db = getDb()
  const defaultMembership = memberships.find(item => item.isDefault) ?? memberships[0] ?? null

  const defaultOrganization = defaultMembership
    ? db.prepare('SELECT id, name FROM organizations WHERE id = ? AND is_active = 1').get(defaultMembership.organizationId) as { id: number; name: string } | undefined
    : undefined

  db.transaction(() => {
    db.prepare(
      `UPDATE users SET role = ?, organization = ?, organization_id = ? WHERE id = ?`
    ).run(
      systemRole === 'super_admin' ? 'super_admin' : (defaultMembership?.role ?? 'user'),
      defaultOrganization?.name ?? null,
      defaultOrganization?.id ?? null,
      userId,
    )

    db.prepare('DELETE FROM user_organizations WHERE user_id = ?').run(userId)
    memberships.forEach(membership => {
      db.prepare(
        `INSERT INTO user_organizations (user_id, organization_id, role, is_default, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).run(userId, membership.organizationId, membership.role, membership.isDefault ? 1 : 0)
    })
  })()
}

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of user objects
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateToken, (_req: Request, res: Response) => {
  const currentUser = loadRequestUserContext(_req)
  if (!currentUser || (currentUser.role !== 'administrator' && currentUser.role !== 'super_admin')) {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }

  const db = getDb()
  const userIds = currentUser.role === 'super_admin'
    ? db
        .prepare('SELECT id FROM users ORDER BY id')
        .all() as Array<{ id: number }>
    : db
        .prepare(
          `SELECT DISTINCT user_id AS id
           FROM user_organizations
           WHERE organization_id = ?
           ORDER BY user_id`
        )
        .all(currentUser.organizationId) as Array<{ id: number }>

  const users = userIds
    .map(row => loadAccessibleUserProfile(row.id, currentUser))
    .filter((user): user is UserAccessProfile => Boolean(user))

  res.json(users.map(toApiUser))
})

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get a single user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User object
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/:id', authenticateToken, (req: Request, res: Response) => {
  const currentUser = loadRequestUserContext(req)
  if (!currentUser || (currentUser.role !== 'administrator' && currentUser.role !== 'super_admin')) {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }

  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid user ID' })
    return
  }

  const user = loadAccessibleUserProfile(id, currentUser)

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.json(toApiUser(user))
})

router.post('/', authenticateToken, (req: Request, res: Response) => {
  const currentUser = loadRequestUserContext(req)
  if (!currentUser || (currentUser.role !== 'administrator' && currentUser.role !== 'super_admin')) {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }

  const { name, email } = req.body as {
    name: unknown
    email: unknown
  }

  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  if (typeof email !== 'string' || !email.trim()) {
    res.status(400).json({ error: 'email is required' })
    return
  }

  const parsedPayload = parseMembershipPayload(req.body as {
    role?: unknown
    organizationId?: unknown
    memberships?: unknown
  }, currentUser)
  if ('error' in parsedPayload) {
    res.status(400).json({ error: parsedPayload.error })
    return
  }

  const db = getDb()
  const existingEmail = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email.trim()) as unknown as { id: number } | undefined

  if (existingEmail) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }

  for (const membership of parsedPayload.memberships) {
    const organization = db
      .prepare('SELECT id FROM organizations WHERE id = ? AND is_active = 1')
      .get(membership.organizationId) as { id: number } | undefined
    if (!organization) {
      res.status(400).json({ error: 'Selected organization does not exist' })
      return
    }
  }

  const inserted = db
    .prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)')
    .run(name.trim(), email.trim(), parsedPayload.systemRole === 'super_admin' ? 'super_admin' : 'user')

  const createdUserId = Number(inserted.lastInsertRowid)
  persistMemberships(createdUserId, parsedPayload.systemRole, parsedPayload.memberships)

  const created = loadAccessibleUserProfile(createdUserId, currentUser)
  if (!created) {
    res.status(500).json({ error: 'Failed to load created user' })
    return
  }

  res.status(201).json(toApiUser(created))
})

router.patch('/:id', authenticateToken, (req: Request, res: Response) => {
  const currentUser = loadRequestUserContext(req)
  if (!currentUser || (currentUser.role !== 'administrator' && currentUser.role !== 'super_admin')) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid user ID' })
    return
  }

  const { name, email } = req.body as {
    name: unknown
    email: unknown
  }

  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  if (typeof email !== 'string' || !email.trim()) {
    res.status(400).json({ error: 'email is required' })
    return
  }

  const parsedPayload = parseMembershipPayload(req.body as {
    role?: unknown
    organizationId?: unknown
    memberships?: unknown
  }, currentUser)
  if ('error' in parsedPayload) {
    res.status(400).json({ error: parsedPayload.error })
    return
  }

  const db = getDb()

  const existingUser = loadUserAccessProfile(id)
  if (!existingUser) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  if (currentUser.role !== 'super_admin' && !existingUser.organizations.some(org => org.organizationId === currentUser.organizationId)) {
    res.status(403).json({ error: 'You can only edit users within your own organization' })
    return
  }

  const existingEmail = db
    .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
    .get(email.trim(), id) as unknown as { id: number } | undefined

  if (existingEmail) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }

  for (const membership of parsedPayload.memberships) {
    const organization = db
      .prepare('SELECT id FROM organizations WHERE id = ? AND is_active = 1')
      .get(membership.organizationId) as { id: number } | undefined
    if (!organization) {
      res.status(400).json({ error: 'Selected organization does not exist' })
      return
    }
  }

  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name.trim(), email.trim(), id)
  persistMemberships(id, parsedPayload.systemRole, parsedPayload.memberships)

  const updated = loadAccessibleUserProfile(id, currentUser)
  if (!updated) {
    res.status(500).json({ error: 'Failed to load updated user' })
    return
  }

  res.json(toApiUser(updated))
})

router.delete('/:id', authenticateToken, (req: Request, res: Response) => {
  const currentUser = loadRequestUserContext(req)
  if (!currentUser || (currentUser.role !== 'administrator' && currentUser.role !== 'super_admin')) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid user ID' })
    return
  }

  // Prevent self-deletion
  if (currentUser.id === id) {
    res.status(400).json({ error: 'You cannot delete your own account.' })
    return
  }

  const db = getDb()
  const user = loadUserAccessProfile(id)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  if (currentUser.role === 'administrator' && !user.organizations.some(org => org.organizationId === currentUser.organizationId)) {
    res.status(403).json({ error: 'You can only delete users within your own organization' })
    return
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  res.status(204).end()
})

// ── User location assignment ──────────────────────────────────

router.get('/:id/locations', authenticateToken, (req: Request, res: Response) => {
  const currentUser = loadRequestUserContext(req)
  if (!currentUser || (currentUser.role !== 'administrator' && currentUser.role !== 'super_admin')) {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }

  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid user ID' })
    return
  }

  const db = getDb()
  const locations = db
    .prepare(
      `SELECT l.id, l.name FROM user_locations ul
       JOIN locations l ON l.id = ul.location_id
       WHERE ul.user_id = ?
       ORDER BY lower(l.name)`
    )
    .all(id) as unknown as Array<{ id: number; name: string }>

  res.json(locations)
})

router.put('/:id/locations', authenticateToken, (req: Request, res: Response) => {
  const currentUser = loadRequestUserContext(req)
  if (!currentUser || (currentUser.role !== 'administrator' && currentUser.role !== 'super_admin')) {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }

  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid user ID' })
    return
  }

  const { locationIds } = req.body as { locationIds: unknown }
  if (!Array.isArray(locationIds) || locationIds.some(x => typeof x !== 'number')) {
    res.status(400).json({ error: 'locationIds must be an array of numbers' })
    return
  }

  const db = getDb()
  const user = loadUserAccessProfile(id)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  if (currentUser.role === 'administrator' && !user.organizations.some(org => org.organizationId === currentUser.organizationId)) {
    res.status(403).json({ error: 'You can only manage users within your own organization' })
    return
  }

  try {
    db.prepare('DELETE FROM user_locations WHERE user_id = ?').run(id)
    for (const locId of locationIds as number[]) {
      db.prepare('INSERT OR IGNORE INTO user_locations (user_id, location_id) VALUES (?, ?)').run(id, locId)
    }
    res.status(204).end()
  } catch (err) {
    console.error('[users] update locations error:', err)
    res.status(500).json({ error: (err as Error).message ?? 'Failed to update user locations' })
  }
})

export default router
