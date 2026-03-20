'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { OperationsShell } from '../operations-shared'

interface AuditEntry {
  id: string
  action: string
  actorEmail: string
  targetType: string
  targetId: string
  details: Record<string, unknown> | null
  createdAt: string
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '20px',
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid var(--border-hover)',
  borderRadius: '10px',
  fontSize: '13px',
  background: 'var(--elevated)',
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--text-secondary)',
  marginBottom: '6px',
}

function formatLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => formatValue(item)).join(', ') : '[]'
  }
  return JSON.stringify(value)
}

function renderDetails(details: Record<string, unknown> | null) {
  if (!details || Object.keys(details).length === 0) {
    return 'No extra details'
  }

  return Object.entries(details)
    .map(([key, value]) => `${formatLabel(key)}: ${formatValue(value)}`)
    .join(' • ')
}

function summarizeTarget(entry: AuditEntry) {
  const email = typeof entry.details?.email === 'string' ? entry.details.email : null
  const commonName = typeof entry.details?.commonName === 'string' ? entry.details.commonName : null
  const name = typeof entry.details?.name === 'string' ? entry.details.name : null
  if (email) return `${entry.targetType} ${email}`
  if (commonName) return `${entry.targetType} ${commonName}`
  if (name) return `${entry.targetType} ${name}`
  return `${entry.targetType} ${entry.targetId}`
}

function getActionColor(action: string) {
  if (action.includes('FAILED') || action.includes('DELETE') || action.includes('REVOKE')) return '#F87171'
  if (action.includes('CREATE') || action.includes('GENERATE') || action.includes('APPROVED') || action.includes('ENABLED')) return '#4ADE80'
  if (action.includes('UPDATE') || action.includes('PUSH') || action.includes('VERIFIED')) return '#60A5FA'
  if (action.includes('SYNC') || action.includes('MFA')) return '#C084FC'
  return '#B0B0B0'
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 25

  const fetchLogs = useCallback(() => {
    const params = new URLSearchParams()
    if (actionFilter) params.set('action', actionFilter)
    if (actorFilter) params.set('actor', actorFilter)
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))

    setLoading(true)
    fetch(`/api/audit?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.entries)) {
          setLogs(data.entries)
          setTotal(typeof data.total === 'number' ? data.total : 0)
          return
        }
        setLogs([])
        setTotal(0)
      })
      .catch(() => {
        setLogs([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [actionFilter, actorFilter, page])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const summary = useMemo(() => `${total} entr${total === 1 ? 'y' : 'ies'} total`, [total])

  return (
    <OperationsShell
      title="Audit"
      description="Search the AccessCore event stream for access changes, downloads, provisioning, MFA, and server operations."
      actions={<div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{summary}</div>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <section style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Action</label>
              <input
                type="text"
                placeholder="Filter by action..."
                value={actionFilter}
                onChange={(event) => {
                  setActionFilter(event.target.value)
                  setPage(1)
                }}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Actor</label>
              <input
                type="text"
                placeholder="Filter by actor email..."
                value={actorFilter}
                onChange={(event) => {
                  setActorFilter(event.target.value)
                  setPage(1)
                }}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => {
                  setActionFilter('')
                  setActorFilter('')
                  setPage(1)
                }}
                style={{
                  width: '100%',
                  minHeight: '40px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-hover)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </section>

        <section style={{ ...cardStyle, padding: '0' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '180px 180px 220px minmax(0, 1fr)', gap: '16px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <div>When</div>
          <div>Action</div>
          <div>Actor</div>
          <div>Event</div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gap: '8px', padding: '12px' }}>
            <SkeletonCard height="72px" />
            <SkeletonCard height="72px" />
            <SkeletonCard height="72px" />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            No audit entries found.
          </div>
        ) : (
          <div>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'grid',
                  gridTemplateColumns: '180px 180px 220px minmax(0, 1fr)',
                  gap: '16px',
                  alignItems: 'start',
                }}
              >
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {new Date(log.createdAt).toLocaleString()}
                </div>
                <div style={{ fontSize: '13px', color: getActionColor(log.action), fontWeight: 600, wordBreak: 'break-word' }}>
                  {log.action}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.5 }}>
                  {log.actorEmail}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                    {summarizeTarget(log)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#777777', marginTop: '4px', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {renderDetails(log.details)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '14px 16px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: page <= 1 ? '1px solid #222222' : '1px solid var(--border-hover)',
                background: 'transparent',
                color: page <= 1 ? 'var(--text-faint)' : 'var(--text-primary)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontFamily: 'inherit',
              }}
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: page >= totalPages ? '1px solid #222222' : '1px solid var(--border-hover)',
                background: 'transparent',
                color: page >= totalPages ? 'var(--text-faint)' : 'var(--text-primary)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontFamily: 'inherit',
              }}
            >
              Next
            </button>
          </div>
        </div>
        </section>
      </div>
    </OperationsShell>
  )
}
