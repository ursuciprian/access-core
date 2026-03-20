'use client'

import { useState, useEffect, useCallback, useMemo, useRef, CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { SkeletonTable, SkeletonLine } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/ToastProvider'

interface VpnUser {
  id: string
  email: string
  commonName: string
  displayName: string | null
  certStatus: string
  isFlagged: boolean
  isEnabled: boolean
}

interface BulkGroup {
  id: string
  name: string
}

interface BulkResult {
  success: number
  failed: number
  errors: Array<{ userId: string; error: string }>
}

const styles = {
  page: {
    padding: 0,
  } as CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  } as CSSProperties,

  title: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--text-primary, var(--text-primary))',
    margin: 0,
  } as CSSProperties,

  primaryButton: {
    padding: '8px 16px',
    background: 'var(--button-primary)',
    color: 'var(--button-primary-text)',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 'var(--radius-lg, 12px)',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as CSSProperties,

  primaryButtonDisabled: {
    padding: '8px 16px',
    background: 'var(--button-primary)',
    color: 'var(--button-primary-text)',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 'var(--radius-lg, 12px)',
    border: 'none',
    cursor: 'not-allowed',
    opacity: 0.5,
    fontFamily: 'inherit',
  } as CSSProperties,

  formContainer: {
    backgroundColor: 'var(--surface, var(--surface))',
    borderRadius: 'var(--radius-xl, 16px)',
    border: '1px solid var(--border, var(--border))',
    padding: 20,
    marginBottom: 24,
  } as CSSProperties,

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginBottom: 16,
  } as CSSProperties,

  label: {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-secondary, var(--text-secondary))',
    marginBottom: 4,
  } as CSSProperties,

  input: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'var(--elevated, var(--elevated))',
    border: '1px solid var(--border-hover)',
    borderRadius: 'var(--radius-md, 8px)',
    fontSize: 14,
    color: 'var(--text-primary, var(--text-primary))',
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as CSSProperties,

  tableWrapper: {
    backgroundColor: 'var(--surface, var(--surface))',
    borderRadius: 'var(--radius-xl, 16px)',
    border: '1px solid var(--border, var(--border))',
    overflow: 'hidden',
  } as CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  } as CSSProperties,

  th: {
    textAlign: 'left' as const,
    padding: '12px 20px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted, var(--text-muted))',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    backgroundColor: 'var(--elevated, var(--elevated))',
    borderBottom: '1px solid var(--border, var(--border))',
  } as CSSProperties,

  tr: {
    borderBottom: '1px solid var(--border, var(--border))',
  } as CSSProperties,

  td: {
    padding: '12px 20px',
    fontSize: 14,
    color: 'var(--text-secondary, var(--text-secondary))',
  } as CSSProperties,

  link: {
    fontSize: 14,
    color: 'var(--accent, var(--accent))',
    fontWeight: 500,
    textDecoration: 'none',
  } as CSSProperties,

  textPrimary: {
    fontSize: 14,
    color: 'var(--text-primary, var(--text-primary))',
  } as CSSProperties,

  badgeActive: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 500,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    color: '#4ADE80',
  } as CSSProperties,

  badgeRevoked: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 500,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#F87171',
  } as CSSProperties,

  badgeNone: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 500,
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    color: 'var(--text-muted, var(--text-muted))',
  } as CSSProperties,

  badgeFlagged: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 500,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#F87171',
  } as CSSProperties,

  emptyText: {
    padding: '32px 20px',
    textAlign: 'center' as const,
    fontSize: 14,
    color: 'var(--text-muted, var(--text-muted))',
  } as CSSProperties,

  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 256,
    color: 'var(--text-muted, var(--text-muted))',
    fontSize: 14,
  } as CSSProperties,

  dashText: {
    fontSize: 14,
    color: 'var(--text-muted, var(--text-muted))',
  } as CSSProperties,

  bulkBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 20px',
    marginBottom: 16,
    backgroundColor: 'rgba(234, 126, 32, 0.1)',
    border: '1px solid rgba(234, 126, 32, 0.3)',
    borderRadius: 'var(--radius-lg, 12px)',
  } as CSSProperties,

  bulkCount: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--accent)',
    marginRight: 8,
  } as CSSProperties,

  bulkButton: {
    padding: '6px 14px',
    background: 'var(--button-primary)',
    color: 'var(--button-primary-text)',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 'var(--radius-md, 8px)',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as CSSProperties,

  bulkButtonDisabled: {
    padding: '6px 14px',
    background: 'var(--button-primary)',
    color: 'var(--button-primary-text)',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 'var(--radius-md, 8px)',
    border: 'none',
    cursor: 'not-allowed',
    opacity: 0.5,
    fontFamily: 'inherit',
  } as CSSProperties,

  bulkSelect: {
    padding: '6px 10px',
    backgroundColor: 'var(--elevated, var(--elevated))',
    color: 'var(--text-primary, var(--text-primary))',
    fontSize: 13,
    border: '1px solid var(--border-hover)',
    borderRadius: 'var(--radius-md, 8px)',
    outline: 'none',
  } as CSSProperties,

  checkbox: {
    width: 16,
    height: 16,
    accentColor: 'var(--accent)',
    cursor: 'pointer',
  } as CSSProperties,

  thCheckbox: {
    textAlign: 'center' as const,
    padding: '12px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted, var(--text-muted))',
    backgroundColor: 'var(--elevated, var(--elevated))',
    borderBottom: '1px solid var(--border, var(--border))',
    width: 44,
  } as CSSProperties,

  tdCheckbox: {
    padding: '12px 12px',
    textAlign: 'center' as const,
    width: 44,
  } as CSSProperties,

  bulkResult: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 20px',
    marginBottom: 16,
    borderRadius: 'var(--radius-lg, 12px)',
    fontSize: 14,
  } as CSSProperties,

  bulkResultSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    color: '#4ADE80',
  } as CSSProperties,

  bulkResultError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#F87171',
  } as CSSProperties,

  clearButton: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    color: 'var(--text-muted, var(--text-muted))',
    fontSize: 12,
    border: '1px solid var(--border-hover)',
    borderRadius: 'var(--radius-md, 8px)',
    cursor: 'pointer',
    marginLeft: 'auto',
  } as CSSProperties,
}

interface VpnServer {
  id: string
  name: string
}

export default function UsersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [users, setUsers] = useState<VpnUser[]>([])
  const [servers, setServers] = useState<VpnServer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', commonName: '', serverId: '' })
  const [submitting, setSubmitting] = useState(false)

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkGroups, setBulkGroups] = useState<BulkGroup[]>([])
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState('')

  // Read filters from URL search params
  const search = searchParams.get('search') || ''
  const serverFilter = searchParams.get('server') || ''
  const certStatus = searchParams.get('certStatus') || ''
  const flagged = searchParams.get('flagged') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = 25

  const [searchInput, setSearchInput] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    if (!('page' in updates)) {
      params.delete('page')
    }
    router.push(`/users?${params.toString()}`)
  }, [searchParams, router])

  const fetchUsers = useCallback(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (serverFilter) params.set('server', serverFilter)
    if (certStatus) params.set('certStatus', certStatus)
    if (flagged) params.set('flagged', flagged)
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))

    setLoading(true)
    fetch(`/api/users?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.users)) {
          setUsers(data.users)
          setTotal(typeof data.total === 'number' ? data.total : 0)
        } else if (Array.isArray(data)) {
          setUsers(data)
          setTotal(data.length)
        } else {
          setUsers([])
          setTotal(0)
        }
      })
      .catch(() => { setUsers([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [search, serverFilter, certStatus, flagged, page, pageSize])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    fetch('/api/servers')
      .then((res) => res.json())
      .then((data) => setServers(Array.isArray(data) ? data : []))
      .catch(() => setServers([]))
    fetch('/api/groups')
      .then((res) => res.json())
      .then((data) => setBulkGroups(Array.isArray(data) ? data : []))
      .catch(() => setBulkGroups([]))
  }, [])

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateParams({ search: value })
    }, 300)
  }

  const toggleSelect = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === users.length && users.length > 0) {
        return new Set()
      }
      return new Set(users.map((u) => u.id))
    })
  }, [users])

  const executeBulkAction = useCallback(async (action: string, groupId?: string) => {
    const userIds = Array.from(selectedIds)
    if (userIds.length === 0) return

    setBulkRunning(true)
    setBulkResult(null)
    setShowGroupDropdown(false)

    try {
      const res = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userIds, groupId }),
      })
      const data: BulkResult = await res.json()
      setBulkResult(data)
      if (data.success > 0) {
        toast(`Bulk action: ${data.success} succeeded${data.failed > 0 ? `, ${data.failed} failed` : ''}`, data.failed > 0 ? 'error' : 'success')
        fetchUsers()
      } else {
        toast('Bulk action failed', 'error')
      }
    } catch {
      setBulkResult({ success: 0, failed: userIds.length, errors: [{ userId: '', error: 'Network error' }] })
    } finally {
      setBulkRunning(false)
    }
  }, [selectedIds, fetchUsers])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ email: '', commonName: '', serverId: '' })
        toast('User created', 'success')
        fetchUsers()
      } else {
        const data = await res.json().catch(() => ({}))
        toast((data as Record<string, string>).error || 'Failed to create user', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const certBadge = (status: string) => {
    const badgeStyles: Record<string, CSSProperties> = {
      ACTIVE: styles.badgeActive,
      REVOKED: styles.badgeRevoked,
      NONE: styles.badgeNone,
    }
    return (
      <span style={badgeStyles[status] || badgeStyles.NONE}>
        {status}
      </span>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (loading && users.length === 0) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <SkeletonLine width="80px" height="20px" />
          <SkeletonLine width="90px" height="36px" />
        </div>
        <SkeletonTable rows={5} columns={4} />
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div />
        <button
          onClick={() => setShowForm(!showForm)}
          style={styles.primaryButton}
        >
          {showForm ? 'Cancel' : 'New User'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={styles.formContainer}>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Common Name</label>
              <input
                type="text"
                required
                value={form.commonName}
                onChange={(e) => setForm({ ...form, commonName: e.target.value })}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Server</label>
              <select
                required
                value={form.serverId}
                onChange={(e) => setForm({ ...form, serverId: e.target.value })}
                style={styles.input}
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
            style={submitting ? styles.primaryButtonDisabled : styles.primaryButton}
          >
            {submitting ? 'Creating...' : 'Create User'}
          </button>
        </form>
      )}

      {selectedIds.size > 0 && (
        <div style={styles.bulkBar}>
          <span style={styles.bulkCount}>{selectedIds.size} user{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <button
            style={bulkRunning ? styles.bulkButtonDisabled : styles.bulkButton}
            disabled={bulkRunning}
            onClick={() => executeBulkAction('push-ccd')}
          >
            {bulkRunning ? 'Running...' : 'Push CCD'}
          </button>
          <button
            style={bulkRunning ? styles.bulkButtonDisabled : styles.bulkButton}
            disabled={bulkRunning}
            onClick={() => executeBulkAction('generate-cert')}
          >
            {bulkRunning ? 'Running...' : 'Generate Certs'}
          </button>
          {showGroupDropdown ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                style={styles.bulkSelect}
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                <option value="">Pick a group...</option>
                {bulkGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <button
                style={!selectedGroupId || bulkRunning ? styles.bulkButtonDisabled : styles.bulkButton}
                disabled={!selectedGroupId || bulkRunning}
                onClick={() => {
                  if (selectedGroupId) executeBulkAction('add-to-group', selectedGroupId)
                }}
              >
                Confirm
              </button>
              <button
                style={{ ...styles.clearButton, marginLeft: 0 }}
                onClick={() => { setShowGroupDropdown(false); setSelectedGroupId('') }}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              style={bulkRunning ? styles.bulkButtonDisabled : styles.bulkButton}
              disabled={bulkRunning}
              onClick={() => setShowGroupDropdown(true)}
            >
              Add to Group
            </button>
          )}
          <button
            style={styles.clearButton}
            onClick={() => { setSelectedIds(new Set()); setBulkResult(null) }}
          >
            Clear selection
          </button>
        </div>
      )}

      {bulkResult && (
        <div style={{
          ...styles.bulkResult,
          ...(bulkResult.failed === 0 ? styles.bulkResultSuccess : styles.bulkResultError),
        }}>
          <span>
            Bulk operation complete: {bulkResult.success} succeeded, {bulkResult.failed} failed.
            {bulkResult.errors.length > 0 && (
              <span> Errors: {bulkResult.errors.map((e) => e.error).join('; ')}</span>
            )}
          </span>
          <button
            style={{ ...styles.clearButton, marginLeft: 'auto', color: 'inherit', borderColor: 'currentColor' }}
            onClick={() => setBulkResult(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search users..."
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value)
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => updateParams({ search: e.target.value }), 300)
          }}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: 'var(--elevated)',
            border: '1px solid var(--border-hover)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>Server</span>
          <select
            value={serverFilter}
            onChange={(e) => updateParams({ server: e.target.value })}
            style={{
              padding: '8px 12px',
              background: 'var(--elevated)',
              border: '1px solid var(--border-hover)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              minWidth: 140,
            }}
          >
            <option value="">All Servers</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>Cert Status</span>
          <select
            value={certStatus}
            onChange={(e) => updateParams({ certStatus: e.target.value })}
            style={{
              padding: '8px 12px',
              background: 'var(--elevated)',
              border: '1px solid var(--border-hover)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              minWidth: 130,
            }}
          >
            <option value="">All Statuses</option>
            <option value="NONE">NONE</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="REVOKED">REVOKED</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>Flagged</span>
          <button
            onClick={() => updateParams({ flagged: flagged ? '' : 'true' })}
            style={{
              padding: '8px 12px',
              background: flagged ? 'rgba(234, 126, 32, 0.15)' : 'var(--elevated)',
              border: flagged ? '1px solid var(--accent)' : '1px solid var(--border-hover)',
              borderRadius: 8,
              color: flagged ? 'var(--accent)' : 'var(--text-primary)',
              fontSize: 14,
              cursor: 'pointer',
              outline: 'none',
              minWidth: 100,
              fontWeight: flagged ? 600 : 400,
            }}
          >
            {flagged ? 'Flagged' : 'Any'}
          </button>
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thCheckbox}>
                <input
                  type="checkbox"
                  checked={users.length > 0 && selectedIds.size === users.length}
                  onChange={toggleSelectAll}
                  style={styles.checkbox}
                />
              </th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Common Name</th>
              <th style={styles.th}>Cert Status</th>
              <th style={styles.th}>Flagged</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={styles.tr}>
                <td style={styles.tdCheckbox}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(user.id)}
                    onChange={() => toggleSelect(user.id)}
                    style={styles.checkbox}
                  />
                </td>
                <td style={styles.td}>
                  <Link href={`/users/${user.id}`} style={styles.link}>
                    {user.email}
                  </Link>
                </td>
                <td style={{ ...styles.td, color: 'var(--text-primary, var(--text-primary))' }}>{user.commonName}</td>
                <td style={styles.td}>{certBadge(user.certStatus)}</td>
                <td style={styles.td}>
                  {user.isFlagged ? (
                    <span style={styles.badgeFlagged}>Flagged</span>
                  ) : (
                    <span style={styles.dashText}>-</span>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} style={styles.emptyText}>No users found</td>
              </tr>
            )}
          </tbody>
        </table>
        {/* Pagination */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          backgroundColor: 'var(--elevated, var(--elevated))',
          borderTop: '1px solid var(--border, var(--border))',
          fontSize: 14,
          color: 'var(--text-secondary, var(--text-secondary))',
        }}>
          <span>{total} user{total !== 1 ? 's' : ''} total</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              disabled={page <= 1}
              onClick={() => updateParams({ page: String(page - 1) })}
              style={{
                padding: '6px 14px',
                backgroundColor: 'transparent',
                border: page <= 1 ? '1px solid #222' : '1px solid var(--border-hover)',
                borderRadius: 'var(--radius-md, 8px)',
                fontSize: 13,
                color: page <= 1 ? 'var(--text-faint)' : 'var(--text-primary, var(--text-primary))',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => updateParams({ page: String(page + 1) })}
              style={{
                padding: '6px 14px',
                backgroundColor: 'transparent',
                border: page >= totalPages ? '1px solid #222' : '1px solid var(--border-hover)',
                borderRadius: 'var(--radius-md, 8px)',
                fontSize: 13,
                color: page >= totalPages ? 'var(--text-faint)' : 'var(--text-primary, var(--text-primary))',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
