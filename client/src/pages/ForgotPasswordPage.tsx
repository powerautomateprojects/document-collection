import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Layers } from 'lucide-react'

const INPUT =
  'w-full border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] ' +
  'text-[#1E293B] dark:text-[#F1F5F9] placeholder-[#94A3B8] dark:placeholder-[#475569] ' +
  'px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-[2px]'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [devLink, setDevLink] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json() as { message?: string; resetLink?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      if (data.resetLink) setDevLink(data.resetLink)
      setDone(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
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
            Forgot your password?
          </h1>
          <p className="text-white/70 text-sm leading-relaxed">
            Enter your email address and we'll send you a link to reset your password.
            The link is valid for 1 hour.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center bg-white dark:bg-[#0F172A] p-8 md:p-12 lg:p-16">
        <div className="w-full max-w-md mx-auto">
          {done ? (
            <div className="space-y-5">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-[#64748B] dark:text-[#475569] uppercase">
                Check your inbox
              </p>
              <h2 className="text-2xl font-bold text-[#1E293B] dark:text-[#F1F5F9]">
                Reset link sent
              </h2>
              <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                If <span className="font-medium text-[#1E293B] dark:text-[#F1F5F9]">{email}</span> is
                associated with an account, you'll receive a reset link shortly.
              </p>

              {devLink && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-[2px] space-y-1.5">
                  <p className="text-[10px] font-semibold tracking-[0.15em] text-blue-600 dark:text-blue-400 uppercase">
                    Dev mode — reset link
                  </p>
                  <a
                    href={devLink}
                    className="block text-xs text-blue-700 dark:text-blue-300 break-all hover:underline"
                  >
                    {devLink}
                  </a>
                </div>
              )}

              <Link
                to="/login"
                className="inline-block w-full text-center bg-[#1E293B] dark:bg-[#F1F5F9] text-white dark:text-[#0F172A] font-semibold py-2.5 text-sm tracking-wide rounded-[2px] hover:bg-[#0F172A] dark:hover:bg-white transition-colors"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={e => void handleSubmit(e)} className="space-y-5">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] text-[#64748B] dark:text-[#475569] uppercase mb-3">
                  Reset Password
                </p>
                <h2 className="text-2xl font-bold text-[#1E293B] dark:text-[#F1F5F9] mb-1">
                  Enter your email
                </h2>
                <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mb-5">
                  We'll send a password reset link to this address.
                </p>
              </div>

              {error && (
                <div className="px-3 py-2.5 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}

              <input
                type="email"
                placeholder="Work email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
                className={INPUT}
              />

              <button
                type="submit"
                disabled={submitting || !email}
                className="w-full bg-[#2563EB] text-white font-semibold py-2.5 text-sm tracking-wide rounded-[2px] hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send Reset Link'}
              </button>

              <p className="text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
                Remember your password?{' '}
                <Link to="/login" className="text-[#2563EB] hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
