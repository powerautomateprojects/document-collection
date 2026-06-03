import { authHeaders, handleUnauthorizedResponse } from './authEvents'

export interface PendingApprovalItem {
  responseId: number
  collectionId: number
  collectionTitle: string
  collectionSlug: string
  stageName: string
  stageOrder: number
  submittedAt: string
  respondentName: string | null
  respondentEmail: string | null
}

async function handleResponse<T>(res: Response): Promise<T> {
  handleUnauthorizedResponse(res)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function getPendingApprovals(): Promise<PendingApprovalItem[]> {
  const res = await fetch('/api/approvals/pending', { headers: authHeaders() })
  return handleResponse<PendingApprovalItem[]>(res)
}
