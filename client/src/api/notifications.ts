import type { AppNotification } from '../types'
import { authHeaders, handleUnauthorizedResponse } from './authEvents'

export interface NotificationRecipientOption {
  id: number
  name: string
  email: string
  role: string
  organizationId: number | null
}

async function handleResponse<T>(res: Response): Promise<T> {
  handleUnauthorizedResponse(res)

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }

  return res.json() as Promise<T>
}

export async function listNotifications(): Promise<AppNotification[]> {
  const res = await fetch('/api/notifications', { headers: authHeaders() })
  return handleResponse<AppNotification[]>(res)
}

export async function getUnreadNotificationCount(): Promise<number> {
  const res = await fetch('/api/notifications/unread-count', { headers: authHeaders() })
  const data = await handleResponse<{ count: number }>(res)
  return data.count
}

export async function markNotificationRead(id: number): Promise<AppNotification> {
  const res = await fetch(`/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: authHeaders(),
  })
  return handleResponse<AppNotification>(res)
}

export async function markAllNotificationsRead(): Promise<number> {
  const res = await fetch('/api/notifications/read-all', {
    method: 'PATCH',
    headers: authHeaders(),
  })
  const data = await handleResponse<{ updated: number }>(res)
  return data.updated
}

export async function archiveNotification(id: number): Promise<AppNotification> {
  const res = await fetch(`/api/notifications/${id}/archive`, {
    method: 'PATCH',
    headers: authHeaders(),
  })
  return handleResponse<AppNotification>(res)
}

export async function listNotificationRecipients(): Promise<NotificationRecipientOption[]> {
  const res = await fetch('/api/notifications/recipients', { headers: authHeaders() })
  return handleResponse<NotificationRecipientOption[]>(res)
}

export async function sendManualNotification(payload: {
  recipientId: number
  subject: string
  body: string
}): Promise<{ ok: true; recipientId: number; subject: string }> {
  const res = await fetch('/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  return handleResponse<{ ok: true; recipientId: number; subject: string }>(res)
}
