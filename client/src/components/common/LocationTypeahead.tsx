import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { searchLocations } from '../../api/locations'
import type { Location } from '../../types'

interface LocationTypeaheadProps {
  value: Location | null
  onChange: (location: Location | null) => void
  placeholder?: string
  className?: string
}

export function LocationTypeahead({
  value,
  onChange,
  placeholder = 'Search locations…',
  className = '',
}: LocationTypeaheadProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Location[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const data = await searchLocations(q)
      setResults(data)
      setOpen(data.length > 0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void search(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  // Reposition portal dropdown whenever it opens or results change
  useEffect(() => {
    if (open && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      })
    }
  }, [open, results])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close on scroll (position would be stale)
  useEffect(() => {
    if (!open) return
    function handleScroll() { setOpen(false) }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [open])

  function select(loc: Location) {
    onChange(loc)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setQuery('')
  }

  const dropdown = open && results.length > 0
    ? createPortal(
        <ul
          style={dropdownStyle}
          className="max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
        >
          {results.map(loc => (
            <li key={loc.id}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); select(loc) }}
                className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {loc.name}
              </button>
            </li>
          ))}
        </ul>,
        document.body
      )
    : null

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800">
          <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{value.name}</span>
          <button
            type="button"
            onClick={clear}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Clear location"
          >
            ×
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.trim() && results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {loading && (
        <div className="absolute right-3 top-2.5 text-gray-400 text-xs">…</div>
      )}

      {dropdown}
    </div>
  )
}
