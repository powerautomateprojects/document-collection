const AUTH_EXPIRED_EVENT = 'dcp-auth-expired'

export function authHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' }
}

export function handleUnauthorizedResponse(res: Response): void {
  if (res.status !== 401) return

  localStorage.removeItem('dcp-user')
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
}

export { AUTH_EXPIRED_EVENT }