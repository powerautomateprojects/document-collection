import type { AttachmentReference } from '../types'
import { handleUnauthorizedResponse } from './authEvents'

async function handleAttachmentResponse<T>(res: Response): Promise<T> {
  handleUnauthorizedResponse(res)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

export async function uploadAttachment(
  slug: string,
  fieldId: number,
  file: File,
): Promise<AttachmentReference> {
  const formData = new FormData()
  formData.append('fieldId', String(fieldId))
  formData.append('file', file)

  const res = await fetch(`/api/collections/public/${slug}/attachments`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })

  return handleAttachmentResponse<AttachmentReference>(res)
}

export async function deletePendingAttachment(
  slug: string,
  attachmentId: number,
  uploadToken: string,
): Promise<void> {
  const res = await fetch(`/api/collections/public/${slug}/attachments/${attachmentId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uploadToken }),
  })

  return handleAttachmentResponse<void>(res)
}