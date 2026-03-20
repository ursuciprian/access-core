'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { SkeletonTable, SkeletonLine } from '@/components/ui/Skeleton'

interface VpnGroup {
  id: string
  name: string
  description: string | null
  _count?: { users: number; cidrBlocks: number }
  temporaryMemberCount?: number
  server: { id: string; name: string }
}

interface VpnServer {
  id: string
  name: string
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<VpnGroup[]>([])
  const [servers, setServers] = useState<VpnServer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', serverId: '' })
  const [submitting, setSubmitting] = useState(false)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [serverFilter, setServerFilter] = useState('')

  const fetchGroups = () => {
    fetch('/api/groups')
      .then((res) => res.json())
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchGroups()
    fetch('/api/servers')
      .then((res) => res.json())
      .then((data) => setServers(Array.isArray(data) ? data : []))
      .catch(() => setServers([]))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ name: '', description: '', serverId: '' })
        fetchGroups()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const filteredGroups = useMemo(() => {
    let result = groups
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((g) => g.name.toLowerCase().includes(q))
    }
    if (serverFilter) {
      result = result.filter((g) => g.server.id === serverFilter)
    }
    return result
  }, [groups, searchQuery, serverFilter])

  if (loading) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <SkeletonLine width="80px" height="20px" />
          <SkeletonLine width="100px" height="36px" />
        </div>
        <SkeletonTable rows={5} columns={6} />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div />
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '8px 16px',
            background: showForm ? 'transparent' : 'linear-gradient(to bottom, var(--accent), var(--accent-strong))',
            color: showForm ? 'var(--text-primary)' : '#0A0A0A',
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: '12px',
            border: showForm ? '1px solid var(--border-strong)' : 'none',
            cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancel' : 'New Group'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: '20px',
            border: '1px solid var(--border)',
            padding: '20px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'var(--elevated)',
                  border: '1px solid var(--border-hover)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'var(--elevated)',
                  border: '1px solid var(--border-hover)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Server</label>
              <select
                required
                value={form.serverId}
                onChange={(e) => setForm({ ...form, serverId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'var(--elevated)',
                  border: '1px solid var(--border-hover)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              >
                <option value="">Select a server...</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '8px 16px',
              background: 'linear-gradient(to bottom, var(--accent), var(--accent-strong))',
              color: '#0A0A0A',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '12px',
              border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(180px, 240px)', gap: 12, marginBottom: 16, alignItems: 'end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1 }}>Search</span>
          <input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--elevated)',
              border: '1px solid var(--border-hover)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1 }}>Server</span>
          <select
            value={serverFilter}
            onChange={(e) => setServerFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--elevated)',
              border: '1px solid var(--border-hover)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          >
            <option value="">All Servers</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--elevated)' }}>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Description</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Server</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>CIDR Blocks</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Members</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Temporary Members</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((group) => (
              <tr key={group.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 20px' }}>
                  <Link href={`/groups/${group.id}`} style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                    {group.name}
                  </Link>
                </td>
                <td style={{ padding: '12px 20px', fontSize: '14px', color: 'var(--text-secondary)' }}>{group.description || '-'}</td>
                <td style={{ padding: '12px 20px', fontSize: '14px', color: 'var(--text-primary)' }}>{group.server.name}</td>
                <td style={{ padding: '12px 20px', fontSize: '14px', color: 'var(--text-primary)' }}>{group._count?.cidrBlocks ?? 0}</td>
                <td style={{ padding: '12px 20px', fontSize: '14px', color: 'var(--text-primary)' }}>{group._count?.users ?? 0}</td>
                <td style={{ padding: '12px 20px', fontSize: '14px', color: 'var(--text-primary)' }}>{group.temporaryMemberCount ?? 0}</td>
              </tr>
            ))}
            {filteredGroups.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '20px 32px', textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)' }}>No groups found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
