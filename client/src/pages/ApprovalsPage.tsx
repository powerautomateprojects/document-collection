import { useEffect, useState } from 'react'
import { CheckSquare, Calendar, User as UserIcon, Mail, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { getPendingApprovals, type PendingApprovalItem } from '../api/approvals'
import { approveResponseWorkflow, rejectResponseWorkflow } from '../api/collections'

function formatSubmittedAt(raw: string): string {
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z'
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

type ActionState = 'idle' | 'saving' | 'error'

export default function ApprovalsPage() {
  const [items, setItems] = useState<PendingApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<number, string>>({})
  const [actionState, setActionState] = useState<Record<number, ActionState>>({})

  useEffect(() => {
    setLoading(true)
    getPendingApprovals()
      .then(data => {
        setItems(data)
        setLoading(false)
      })
      .catch(err => {
        setError((err as Error).message)
        setLoading(false)
      })
  }, [])

  async function handleDecision(item: PendingApprovalItem, decision: 'approve' | 'reject') {
    setActionState(prev => ({ ...prev, [item.responseId]: 'saving' }))
    try {
      const comment = (comments[item.responseId] ?? '').trim()
      if (decision === 'approve') {
        await approveResponseWorkflow(item.collectionId, item.responseId, comment || undefined)
      } else {
        await rejectResponseWorkflow(item.collectionId, item.responseId, comment || undefined)
      }
      setItems(prev => prev.filter(i => i.responseId !== item.responseId))
      setActionState(prev => { const next = { ...prev }; delete next[item.responseId]; return next })
      setComments(prev => { const next = { ...prev }; delete next[item.responseId]; return next })
    } catch {
      setActionState(prev => ({ ...prev, [item.responseId]: 'error' }))
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CheckSquare size={22} className="text-[#2563EB] shrink-0" />
        <div>
          <h1 className="text-xl font-semibold text-[#1E293B] dark:text-[#F1F5F9]">Approvals</h1>
          {!loading && !error && (
            <p className="text-sm text-[#64748B]">
              {items.length === 0
                ? 'No pending approvals'
                : `${items.length} pending approval${items.length !== 1 ? 's' : ''} waiting for your action`}
            </p>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-[#64748B]">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading approvals…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          Failed to load approvals: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <CheckCircle size={40} className="text-[#16A34A] opacity-60" />
          <p className="text-base font-medium text-[#1E293B] dark:text-[#F1F5F9]">All caught up!</p>
          <p className="text-sm text-[#64748B]">You have no pending approvals.</p>
        </div>
      )}

      {/* Approval cards */}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-4">
          {items.map(item => {
            const isSaving = actionState[item.responseId] === 'saving'
            const isError = actionState[item.responseId] === 'error'
            return (
              <div
                key={item.responseId}
                className="rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-5 space-y-4"
              >
                {/* Top row */}
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-[#1E293B] dark:text-[#F1F5F9]">
                      {item.collectionTitle}
                    </p>
                    <p className="text-xs text-[#2563EB] mt-0.5 font-medium uppercase tracking-wide">
                      Stage: {item.stageName}
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 shrink-0">
                    Your approval is required
                  </span>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#64748B]">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {formatSubmittedAt(item.submittedAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <UserIcon size={12} />
                    {item.respondentName ?? 'Anonymous'}
                  </span>
                  {item.respondentEmail && (
                    <span className="flex items-center gap-1">
                      <Mail size={12} />
                      {item.respondentEmail}
                    </span>
                  )}
                  <span className="text-[#94A3B8]">Submission #{item.responseId}</span>
                </div>

                {/* Comment + actions */}
                <div className="space-y-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-4">
                  <textarea
                    rows={2}
                    value={comments[item.responseId] ?? ''}
                    onChange={e => {
                      setComments(prev => ({ ...prev, [item.responseId]: e.target.value }))
                      if (isError) {
                        setActionState(prev => ({ ...prev, [item.responseId]: 'idle' }))
                      }
                    }}
                    placeholder="Optional comment"
                    className="w-full resize-none rounded border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3 py-2 text-sm text-[#1E293B] dark:text-[#F1F5F9] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => void handleDecision(item, 'approve')}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 rounded bg-[#16A34A] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#15803D] disabled:opacity-50"
                    >
                      <CheckCircle size={14} />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDecision(item, 'reject')}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 rounded bg-[#DC2626] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                    {isSaving && (
                      <Loader2 size={14} className="animate-spin text-[#64748B]" />
                    )}
                    {isError && (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        Action failed — please try again.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
