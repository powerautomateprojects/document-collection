import { useEffect, useState } from 'react'
import { Bell, CheckCheck, X } from 'lucide-react'
import {
  archiveNotification,
  listNotificationRecipients,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  sendManualNotification,
} from '../api/notifications'
import { useToast } from '../contexts/ToastContext'
import type { AppNotification } from '../types'
import { timeAgo } from '../utils/timeAgo'

export default function NotificationsPage() {
  const { showToast } = useToast()
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [recipients, setRecipients] = useState<Array<{ id: number; name: string; email: string }>>([])
  const [recipientId, setRecipientId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function loadNotifications() {
    setLoading(true)
    setError(null)
    try {
      setItems(await listNotifications())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadNotifications()
    void listNotificationRecipients().then(setRecipients).catch(() => setRecipients([]))
  }, [])

  const unreadCount = items.filter(n => !n.isRead).length

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1E293B] dark:text-[#F1F5F9]">Notifications</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Due date reminders and late notices for collections.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={unreadCount === 0 || markingAll}
            onClick={async () => {
              setMarkingAll(true)
              try {
                await markAllNotificationsRead()
                setItems(prev => prev.map(item => ({ ...item, isRead: true, readAt: item.readAt ?? new Date().toISOString() })))
              } catch {
                // Keep current list state if update fails.
              } finally {
                setMarkingAll(false)
              }
            }}
            className="inline-flex items-center gap-1.5 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded transition-colors"
          >
            <CheckCheck size={14} />
            {markingAll ? 'Updating…' : 'Mark All Read'}
          </button>
          <button
            type="button"
            onClick={() => setIsComposeOpen(true)}
            className="inline-flex items-center gap-1.5 border border-[#2563EB] text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-medium px-3 py-2 rounded transition-colors"
          >
            + Send Notification
          </button>
        </div>
      </div>

      <div className="fixed inset-0 z-40 bg-black/25 transition-opacity" aria-hidden={!isComposeOpen} style={{ display: isComposeOpen ? 'block' : 'none' }} onClick={() => setIsComposeOpen(false)} />
      <aside className={`fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] shadow-2xl transition-transform duration-300 ${isComposeOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#334155] px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-[#1E293B] dark:text-[#F1F5F9]">Send Notification</h2>
              <p className="text-xs text-[#64748B]">Send a manual in-app message to a staff member.</p>
            </div>
            <button type="button" onClick={() => setIsComposeOpen(false)} className="rounded p-1 text-[#64748B] hover:bg-[#F8FAFC] dark:hover:bg-[#111827]" aria-label="Close send notification panel">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]">Recipient</label>
              <select value={recipientId} onChange={e => setRecipientId(e.target.value)} className="w-full rounded border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#1E293B] dark:border-[#475569] dark:bg-[#111827] dark:text-[#F1F5F9]">
                <option value="">Select a staff member</option>
                {recipients.map(item => (
                  <option key={item.id} value={item.id}>{item.name} ({item.email})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full rounded border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#1E293B] dark:border-[#475569] dark:bg-[#111827] dark:text-[#F1F5F9]" placeholder="Notification subject" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]">Body</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} className="w-full rounded border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#1E293B] dark:border-[#475569] dark:bg-[#111827] dark:text-[#F1F5F9]" placeholder="Write the message to send to the recipient" />
            </div>
          </div>

          <div className="border-t border-[#E2E8F0] dark:border-[#334155] p-4">
            <button
              type="button"
              onClick={async () => {
                if (!recipientId || !subject.trim() || !body.trim()) {
                  showToast('Please select a recipient and enter both subject and body.', 'error')
                  return
                }

                setSending(true)
                try {
                  await sendManualNotification({ recipientId: Number(recipientId), subject: subject.trim(), body: body.trim() })
                  showToast('Notification sent successfully.', 'success')
                  setRecipientId('')
                  setSubject('')
                  setBody('')
                  setIsComposeOpen(false)
                  await loadNotifications()
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Unable to send the notification.', 'error')
                } finally {
                  setSending(false)
                }
              }}
              disabled={sending}
              className="w-full rounded bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {sending ? 'Sending…' : '+ Send Notification'}
            </button>
          </div>
        </div>
      </aside>

      {loading && (
        <div className="rounded border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4 text-sm text-[#64748B]">
          Loading notifications...
        </div>
      )}

      {!loading && error && (
        <div className="rounded border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-6 text-center text-sm text-[#64748B]">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#EFF6FF] dark:bg-[#1E293B] mb-2">
            <Bell size={14} className="text-[#2563EB]" />
          </div>
          <p>No notifications yet.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-lg divide-y divide-[#E2E8F0] dark:divide-[#334155] overflow-hidden">
          {items.map(item => (
            <div key={item.id} className={`p-4 ${item.isRead ? '' : 'bg-blue-50/40 dark:bg-blue-900/10'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  {!item.isRead && (
                    <span className="mt-1 w-2 h-2 rounded-full bg-[#DC2626] shrink-0" />
                  )}
                  <div>
                  <p className="text-sm font-semibold text-[#1E293B] dark:text-[#F1F5F9]">{item.title}</p>
                  {item.targetType === 'submission' && item.targetId !== null && (
                    <p className="text-xs font-medium uppercase tracking-wide text-[#2563EB] dark:text-[#93C5FD] mt-1">
                      Submission #{item.targetId}
                    </p>
                  )}
                  <p className="text-sm text-[#475569] dark:text-[#94A3B8] mt-1">{item.message}</p>
                  {item.dueDate && (
                    <p className="text-xs text-[#64748B] mt-1">Due: {item.dueDate}</p>
                  )}
                  <p className="text-xs text-[#94A3B8] mt-0.5">{timeAgo(item.createdAt)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await markNotificationRead(item.id)
                          setItems(prev => prev.map(n => (n.id === item.id ? { ...n, isRead: true, readAt: n.readAt ?? new Date().toISOString() } : n)))
                        } catch {
                          // Ignore single-item read errors in list UX.
                        }
                      }}
                      className="text-xs text-[#2563EB] hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await archiveNotification(item.id)
                        setItems(prev => prev.filter(n => n.id !== item.id))
                      } catch {
                        // Ignore archive errors in the list UX.
                      }
                    }}
                    className="text-xs text-[#2563EB] hover:underline"
                  >
                    Archive
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
