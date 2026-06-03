import type { GalleryAsset } from '../types'
import { authHeaders, handleUnauthorizedResponse } from './authEvents'

async function handleResponse<T>(res: Response): Promise<T> {
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

export async function listGalleryAssets(organizationId?: number): Promise<GalleryAsset[]> {
  const params = new URLSearchParams()
  if (organizationId) {
    params.set('organizationId', String(organizationId))
  }

  const query = params.size > 0 ? `?${params.toString()}` : ''
  const res = await fetch(`/api/gallery-assets${query}`, {
    headers: authHeaders(),
  })
  return handleResponse<GalleryAsset[]>(res)
}

export async function uploadGalleryAsset(payload: {
  file: File
  name: string
  altText?: string
  tags?: string
  organizationId?: number
}): Promise<GalleryAsset> {
  const formData = new FormData()
  formData.set('file', payload.file)
  formData.set('name', payload.name)
  if (payload.altText?.trim()) formData.set('altText', payload.altText.trim())
  if (payload.tags?.trim()) formData.set('tags', payload.tags.trim())
  if (payload.organizationId) formData.set('organizationId', String(payload.organizationId))

  const res = await fetch('/api/gallery-assets', {
    method: 'POST',
    body: formData,
  })
  return handleResponse<GalleryAsset>(res)
}

export async function deleteGalleryAsset(id: number): Promise<void> {
  const res = await fetch(`/api/gallery-assets/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return handleResponse<void>(res)
}
