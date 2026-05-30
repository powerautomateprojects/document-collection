import type {
  TicketField,
  TicketResponse,
  CollectionTicketRow,
  TicketHistoryEntry,
  CollectionTicketTemplate,
  ResponseTicketSummary,
} from '../types'
import { authHeaders, handleUnauthorizedResponse } from './authEvents'

async function handleResponse<T>(res: Response): Promise<T> {
  handleUnauthorizedResponse(res)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  // 204 No Content — return undefined cast as T
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

export async function getTicketFields(collectionId: number): Promise<TicketField[]> {
  const res = await fetch(`/api/collections/${collectionId}/ticket`, {
    headers: authHeaders(),
  })
  return handleResponse<TicketField[]>(res)
}

export async function saveTicketFields(
  collectionId: number,
  fields: Omit<TicketField, 'id'>[],
): Promise<void> {
  const res = await fetch(`/api/collections/${collectionId}/ticket`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ fields }),
  })
  return handleResponse<void>(res)
}

export async function getTicket(
  collectionId: number,
  responseId: number,
): Promise<TicketResponse | null> {
  const res = await fetch(`/api/collections/${collectionId}/responses/${responseId}/ticket`, {
    headers: authHeaders(),
  })
  return handleResponse<TicketResponse | null>(res)
}

export async function saveTicket(
  collectionId: number,
  responseId: number,
  values: { fieldId: number; value: string }[],
): Promise<TicketResponse> {
  const res = await fetch(`/api/collections/${collectionId}/responses/${responseId}/ticket`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ values }),
  })
  return handleResponse<TicketResponse>(res)
}

export async function finalizeTicket(
  collectionId: number,
  responseId: number,
): Promise<TicketResponse> {
  const res = await fetch(
    `/api/collections/${collectionId}/responses/${responseId}/ticket/finalize`,
    { method: 'POST', headers: authHeaders() },
  )
  return handleResponse<TicketResponse>(res)
}

export async function getCollectionTickets(collectionId: number): Promise<CollectionTicketRow[]> {
  const res = await fetch(`/api/collections/${collectionId}/tickets`, {
    headers: authHeaders(),
  })
  return handleResponse<CollectionTicketRow[]>(res)
}

export async function getCollectionTicketTemplates(collectionId: number): Promise<CollectionTicketTemplate[]> {
  const res = await fetch(`/api/collections/${collectionId}/ticket-templates`, {
    headers: authHeaders(),
  })
  return handleResponse<CollectionTicketTemplate[]>(res)
}

export async function saveCollectionTicketTemplates(
  collectionId: number,
  templateIds: number[],
): Promise<CollectionTicketTemplate[]> {
  const res = await fetch(`/api/collections/${collectionId}/ticket-templates`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ templateIds }),
  })
  return handleResponse<CollectionTicketTemplate[]>(res)
}

export async function getResponseTickets(
  collectionId: number,
  responseId: number,
): Promise<ResponseTicketSummary[]> {
  const res = await fetch(`/api/collections/${collectionId}/responses/${responseId}/tickets`, {
    headers: authHeaders(),
  })
  return handleResponse<ResponseTicketSummary[]>(res)
}

export async function getTemplateTicket(
  collectionId: number,
  responseId: number,
  templateId: number,
): Promise<TicketResponse | null> {
  const res = await fetch(`/api/collections/${collectionId}/responses/${responseId}/tickets/${templateId}`, {
    headers: authHeaders(),
  })
  return handleResponse<TicketResponse | null>(res)
}

export async function saveTemplateTicket(
  collectionId: number,
  responseId: number,
  templateId: number,
  values: { fieldId: number; value: string }[],
): Promise<TicketResponse> {
  const res = await fetch(`/api/collections/${collectionId}/responses/${responseId}/tickets/${templateId}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ values }),
  })
  return handleResponse<TicketResponse>(res)
}

export async function finalizeTemplateTicket(
  collectionId: number,
  responseId: number,
  templateId: number,
): Promise<TicketResponse> {
  const res = await fetch(
    `/api/collections/${collectionId}/responses/${responseId}/tickets/${templateId}/finalize`,
    { method: 'POST', headers: authHeaders() },
  )
  return handleResponse<TicketResponse>(res)
}

export async function getTemplateTicketHistory(
  collectionId: number,
  responseId: number,
  templateId: number,
): Promise<TicketHistoryEntry[]> {
  const res = await fetch(`/api/collections/${collectionId}/responses/${responseId}/tickets/${templateId}/history`, {
    headers: authHeaders(),
  })
  return handleResponse<TicketHistoryEntry[]>(res)
}

export async function getTicketHistory(
  collectionId: number,
  responseId: number,
): Promise<TicketHistoryEntry[]> {
  const res = await fetch(`/api/collections/${collectionId}/responses/${responseId}/ticket/history`, {
    headers: authHeaders(),
  })
  return handleResponse<TicketHistoryEntry[]>(res)
}
