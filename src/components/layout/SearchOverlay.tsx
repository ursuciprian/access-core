'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

interface SearchResults {
  users: { id: string; email: string; commonName: string; displayName: string | null }[]
  servers: { id: string; name: string; hostname: string }[]
  groups: { id: string; name: string; description: string | null }[]
}

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { data: session } = useSession()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const isAdmin = ((session?.user as Record<string, unknown> | undefined)?.role as string | undefined) === 'ADMIN'

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const search = useCallback((q: string) => {
    if (q.length < 2) { setResults(null); return }
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => { setResults(data); setSelectedIndex(0) })
      .catch(() => setResults(null))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }

  const allItems = results ? [
    ...results.users.map(u => ({ type: 'user' as const, id: u.id, label: u.displayName || u.email, sub: u.commonName, href: `/users/${u.id}` })),
    ...results.servers.map(s => ({ type: 'server' as const, id: s.id, label: s.name, sub: s.hostname, href: `/servers/${s.id}` })),
    ...results.groups.map(g => ({ type: 'group' as const, id: g.id, label: g.name, sub: g.description || '', href: `/groups/${g.id}` })),
  ] : []

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, allItems.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && allItems[selectedIndex]) {
      router.push(allItems[selectedIndex].href)
      onClose()
    }
  }

  const navigate = (href: string) => { router.push(href); onClose() }

  if (!open || !isAdmin) return null

  const typeLabel: Record<string, string> = { user: 'Users', server: 'Servers', group: 'Groups' }
  const typeIcon: Record<string, string> = { user: '👤', server: '🖥', group: '👥' }
  let lastType = ''
  let globalIdx = -1

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh', zIndex: 10000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(18,18,18,0.98)', border: '1px solid var(--border)', borderRadius: '18px',
          width: '100%', maxWidth: '520px', overflow: 'hidden',
          boxShadow: '0 16px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search users, servers, groups..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />
          <kbd style={{
            padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--border-hover)',
            fontSize: '11px', color: 'var(--text-muted)', background: 'var(--elevated)',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Searching...
            </div>
          )}

          {!loading && results && allItems.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && allItems.length > 0 && (
            <div style={{ padding: '8px' }}>
              {allItems.map(item => {
                globalIdx++
                const idx = globalIdx
                const showHeader = item.type !== lastType
                lastType = item.type
                return (
                  <div key={`${item.type}-${item.id}`}>
                    {showHeader && (
                      <div style={{
                        padding: '8px 8px 4px', fontSize: '11px', fontWeight: 600,
                        color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em',
                      }}>
                        {typeLabel[item.type]}
                      </div>
                    )}
                    <button
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 10px', borderRadius: '8px', border: 'none',
                        background: idx === selectedIndex ? 'rgba(255,255,255,0.05)' : 'transparent',
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ fontSize: '14px', flexShrink: 0, width: '20px', textAlign: 'center' }}>
                        {typeIcon[item.type]}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {item.label}
                        </div>
                        {item.sub && (
                          <div style={{
                            fontSize: '11px', color: 'var(--text-muted)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {item.sub}
                          </div>
                        )}
                      </div>
                      {idx === selectedIndex && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>↵</span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && !results && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              Type at least 2 characters to search
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
