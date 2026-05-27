import type { Request } from 'express'
import { getDb } from '../database/db'

export interface RequestUserContext {
  id: number
  role: 'super_admin' | 'administrator' | 'team_manager' | 'reviewer' | 'user'
  organizationId: number | null
  organizationName: string | null
}

interface DbUserContext {
  id: number
  role: 'super_admin' | 'administrator' | 'team_manager' | 'reviewer' | 'user'
  organization_id: number | null
  organization_name: string | null
}

/** Returns true only for super_admin — they bypass all org-scoping. */
export function isAdministrator(context: RequestUserContext): boolean {
  return context.role === 'super_admin'
}

/** Returns true for both super_admin and administrator. */
export function isAdminOrSuperAdmin(context: RequestUserContext): boolean {
  return context.role === 'super_admin' || context.role === 'administrator'
}

/** Returns true for roles that can view collection responses (reviewer and above). */
export function canViewResponses(context: RequestUserContext): boolean {
  return context.role !== 'user'
}

/** Returns true for roles that can see all responses without location filtering. */
export function canViewAllResponses(context: RequestUserContext): boolean {
  return context.role === 'super_admin' || context.role === 'administrator' || context.role === 'team_manager'
}

export function loadRequestUserContext(req: Request): RequestUserContext | null {
  const userId = req.user?.sub
  if (!userId) {
    return null
  }

  const db = getDb()
  const user = db
    .prepare(
      `SELECT u.id, u.role, u.organization_id, o.name AS organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = ?`
    )
    .get(userId) as unknown as DbUserContext | undefined

  if (!user) {
    return null
  }

  if (
    req.user &&
    (req.user.organizationId === undefined || req.user.organizationName === undefined)
  ) {
    req.user.organizationId = user.organization_id
    req.user.organizationName = user.organization_name
  }

  return {
    id: user.id,
    role: user.role,
    organizationId: user.organization_id,
    organizationName: user.organization_name,
  }
}

export function buildOrganizationScopeClause(
  context: RequestUserContext,
  qualifiedColumn: string,
): { clause: string; params: Array<number> } {
  if (isAdministrator(context)) {
    return { clause: '', params: [] }
  }

  if (!context.organizationId) {
    return { clause: 'WHERE 1 = 0', params: [] }
  }

  return {
    clause: `WHERE ${qualifiedColumn} = ?`,
    params: [context.organizationId],
  }
}

export function appendOrganizationCondition(
  context: RequestUserContext,
  qualifiedColumn: string,
  existingClause = '',
): { clause: string; params: Array<number> } {
  if (isAdministrator(context)) {
    return { clause: existingClause, params: [] }
  }

  if (!context.organizationId) {
    return {
      clause: existingClause ? `${existingClause} AND 1 = 0` : 'WHERE 1 = 0',
      params: [],
    }
  }

  return {
    clause: existingClause
      ? `${existingClause} AND ${qualifiedColumn} = ?`
      : `WHERE ${qualifiedColumn} = ?`,
    params: [context.organizationId],
  }
}

export function resolveManagedOrganizationId(
  context: RequestUserContext,
  organizationId: number | null | undefined,
): number | null {
  if (isAdministrator(context)) {
    return organizationId ?? null
  }

  return context.organizationId
}