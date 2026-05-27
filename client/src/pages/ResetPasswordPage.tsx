import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, Layers } from 'lucide-react'

const INPUT =
  'w-full border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] ' +
  'text-[#1E293B] dark:text-[#F1F5F9] placeholder-[#94A3B8] dark:placeholder-[#475569] ' +
  'px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-[2px]'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json() as { message?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setDone(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0F172A] p-6">
        <div className="w-full max-w-sm text-center space-y-3">
          <p className="text-red-500 text-sm">Invalid reset link — no token found.</p>
          <Link to="/forgot-password" className="text-sm text-[#2563EB] hover:underline block">
            Request a new reset link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel */}
      <div className="flex flex-col justify-between bg-[#0F2942] text-white p-8 md:p-12 md:w-[44%] md:min-h-screen">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <Layers size={22} strokeWidth={2} className="text-white shrink-0" />
            <span className="text-[10px] font-semibold tracking-[0.25em] text-white/50 uppercase">
              Data Collection Pro
            </span>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 border border-white/40 text-[10px] font-semibold tracking-[0.2em] text-white/80 uppercase rounded-[2px] mb-4">
            Password Recovery
          </span>
          <h1 className="text-3xl md:text-[2.5rem] font-bold leading-tight mb-5">
            Choose a new password
          </h1>
          <p className="text-white/70 text-sm leading-relaxed">
            Your new password must be at least 8 characters. After saving, you can sign in immediately.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center bg-white dark:bg-[#0F172A] p-8 md:p-12 lg:p-16">
        <div className="w-full max-w-md mx-auto">
          {done ? (
            <div className="space-y-5 text-center">
              <CheckCircle size={48} className="mx-auto text-green-500" />
              <h2 className="text-2xl font-bold text-[#1E293B] dark:text-[#F1F5F9]">
                Password updated!
              </h2>
              <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                Your password has been changed. You can now sign in with your new password.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full bg-[#1E293B] dark:bg-[#F1F5F9] text-white dark:text-[#0F172A] font-semibold py-2.5 text-sm tracking-wide rounded-[2px] hover:bg-[#0F172A] dark:hover:bg-white transition-colors"
              >
                Go to Login
              </button>
            </div>
          ) : (
            <form onSubmit={e => void handleSubmit(e)} className="space-y-5">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] text-[#64748B] dark:text-[#475569] uppercase mb-3">
                  Reset Password
                </p>
                <h2 className="text-2xl font-bold text-[#1E293B] dark:text-[#F1F5F9] mb-1">
                  Set new password
                </h2>
                <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mb-5">
                  Choose a strong password for your account.
                </p>
              </div>

              {error && (
                <div className="px-3 py-2.5 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}

              <input
                type="password"
                placeholder="New password (min 8 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                className={INPUT}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                className={INPUT}
              />

              <button
                type="submit"
                disabled={submitting || !password || !confirm}
                className="w-full bg-[#2563EB] text-white font-semibold py-2.5 text-sm tracking-wide rounded-[2px] hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Save New Password'}
              </button>

              <p className="text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
                Link expired?{' '}
                <Link to="/forgot-password" className="text-[#2563EB] hover:underline">
                  Request a new one
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
