'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui/ToastProvider'
import { OperationsShell } from '../operations-shared'

interface FlaggedUser {
  id: string
  email: string
  commonName: string
  flagReason: string | null
  flaggedAt: string | null
  server: { id: string; name: string }
}

export default function FlaggedPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<FlaggedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)

  const fetchFlagged = () => {
    fetch('/api/flagged')
      .then((res) => res.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchFlagged() }, [])

  const handleResolve = async (userId: string) => {
    setResolving(userId)
    try {
      const res = await fetch(`/api/users/${userId}/resolve-flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok) toast('Flag resolved', 'success')
      else toast((data as Record<string, string>).error ?? 'Failed to resolve flag', 'error')
      fetchFlagged()
    } finally {
      setResolving(null)
    }
  }

  return (
    <OperationsShell
      title="Flags"
      description="Review users that need admin follow-up after sync changes, provisioning issues, or policy review."
      actions={<div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{users.length} flagged user{users.length === 1 ? '' : 's'}</div>}
    >
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '16rem', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
          Loading flagged users...
        </div>
      ) : (
      <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--elevated)' }}>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Common Name</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Server</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flagged At</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--elevated)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '12px 20px' }}>
                  <Link href={`/users/${user.id}`} style={{ fontSize: '0.875rem', color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>
                    {user.email}
                  </Link>
                </td>
                <td style={{ padding: '12px 20px', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{user.commonName}</td>
                <td style={{ padding: '12px 20px', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{user.server.name}</td>
                <td style={{ padding: '12px 20px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500, background: 'rgba(239, 68, 68, 0.15)', color: '#F87171' }}>
                    {user.flagReason || 'Unknown'}
                  </span>
                </td>
                <td style={{ padding: '12px 20px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {user.flaggedAt ? new Date(user.flaggedAt).toLocaleString() : '-'}
                </td>
                <td style={{ padding: '12px 20px' }}>
                  <button
                    onClick={() => handleResolve(user.id)}
                    disabled={resolving === user.id}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: 'var(--button-primary)',
                      color: 'var(--button-primary-text)',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: resolving === user.id ? 'not-allowed' : 'pointer',
                      opacity: resolving === user.id ? 0.5 : 1,
                      transition: 'opacity 0.15s',
                      fontFamily: 'inherit',
                    }}
                  >
                    {resolving === user.id ? 'Resolving...' : 'Resolve'}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px 20px', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  No flagged users
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </OperationsShell>
  )
}
