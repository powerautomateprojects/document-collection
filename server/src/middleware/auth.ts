import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dcp-dev-secret-change-in-production'

export interface JwtPayload {
  sub: number
  role: 'super_admin' | 'administrator' | 'team_manager' | 'reviewer' | 'user'
  organizationId?: number | null
  organizationName?: string | null
}

// Augment Express Request with authenticated user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Prefer HttpOnly cookie; fall back to Authorization header (for Swagger/API tools)
  const cookieToken = (req.cookies as Record<string, string | undefined>)?.['dcp-token']
  const authHeader = req.headers.authorization
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null
  const token = cookieToken ?? bearerToken

  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET) as unknown as JwtPayload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export { JWT_SECRET }
