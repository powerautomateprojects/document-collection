import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '../types'
import { AUTH_EXPIRED_EVENT } from '../api/authEvents'

interface AuthContextValue {
  user: User | null
  token: string | null
  signIn: (user: User, token: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Restore user profile from localStorage cache (non-sensitive display data only)
    try {
      const raw = localStorage.getItem('dcp-user')
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  })

  // token is always null — auth is handled by HttpOnly cookie
  const token: string | null = null

  const signIn = (u: User, _token: string) => {
    setUser(u)
    localStorage.setItem('dcp-user', JSON.stringify(u))
  }

  const signOut = () => {
    setUser(null)
    localStorage.removeItem('dcp-user')
    // Clear the HttpOnly cookie via the logout endpoint
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
  }

  useEffect(() => {
    const onAuthExpired = () => {
      signOut()
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
  }, [])

  // Validate session with server on startup and refresh the user profile
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => (res.ok ? (res.json() as Promise<User>) : null))
      .then(freshUser => {
        if (freshUser) {
          setUser(freshUser)
          localStorage.setItem('dcp-user', JSON.stringify(freshUser))
        } else {
          // Cookie is expired or invalid — clear stale user cache
          setUser(null)
          localStorage.removeItem('dcp-user')
        }
      })
      .catch(() => { /* silently ignore — stale data is fine */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
