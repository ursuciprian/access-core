'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'

interface AuditEntry {
  id: string
  action: string
  actorEmail: string
  createdAt: string
  targetType: string
  targetId: string
  details?: Record<string, unknown> | null
}

export default function AnalyticsClient({
  initialEntries,
  totalEntries,
}: {
  initialEntries: AuditEntry[]
  totalEntries: number
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [loadingMore, setLoadingMore] = useState(false)

  async function loadMore() {
    if (loadingMore || entries.length >= totalEntries) return

    setLoadingMore(true)
    try {
      const response = await fetch(`/api/audit?take=5&skip=${entries.length}`)
      const data = await response.json()
      const nextEntries = Array.isArray(data?.entries) ? data.entries : []
      setEntries((current) => [...current, ...nextEntries])
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <section style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F0F0F0', margin: 0 }}>
            Recent Administrative Activity
          </h3>
          <p style={{ fontSize: '12px', color: '#666666', margin: '6px 0 0', lineHeight: 1.5 }}>
            Latest 5 events from the audit stream, with load-more pagination for deeper investigation.
          </p>
        </div>
        <span style={metaPillStyle}>{entries.length} of {totalEntries} shown</span>
      </div>

      {entries.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#555555', margin: 0 }}>No administrative activity yet.</p>
      ) : (
        <div style={{ overflowX: 'auto', marginInline: '-4px', paddingInline: '4px' }}>
          <div style={{ border: '1px solid #1E1E1E', borderRadius: '14px', overflow: 'hidden', background: '#0A0A0A', minWidth: '720px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 0.9fr) minmax(220px, 1.1fr) minmax(180px, 0.9fr) minmax(220px, 1.1fr)',
                gap: '16px',
                padding: '12px 14px',
                borderBottom: '1px solid #1E1E1E',
                background: '#101010',
              }}
            >
              <HeaderCell label="Type" />
              <HeaderCell label="User Email" />
              <HeaderCell label="When It Happened" />
              <HeaderCell label="Who Did It" />
            </div>

            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(180px, 0.9fr) minmax(220px, 1.1fr) minmax(180px, 0.9fr) minmax(220px, 1.1fr)',
                  gap: '16px',
                  padding: '12px 14px',
                  borderBottom: '1px solid #1E1E1E',
                  alignItems: 'center',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={actionBadgeStyle(getActionColor(entry.action))}>
                    {formatActionLabel(entry.action)}
                  </span>
                </div>
                <ListValue value={getUserEmail(entry)} muted={!looksLikeEmail(getUserEmail(entry))} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#F0F0F0' }}>{formatTimestamp(entry.createdAt)}</div>
                  <div style={{ fontSize: '11px', color: '#888888', marginTop: '4px' }}>{relativeTime(entry.createdAt)}</div>
                </div>
                <ListValue value={entry.actorEmail} />
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length < totalEntries && (
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            style={{
              minHeight: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              border: '1px solid #2A2A2A',
              background: loadingMore ? '#151515' : '#111111',
              color: loadingMore ? '#555555' : '#F0F0F0',
              cursor: loadingMore ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {loadingMore ? 'Loading...' : 'Load 5 More'}
          </button>
        </div>
      )}
    </section>
  )
}

const cardStyle: CSSProperties = {
  background: '#111111',
  border: '1px solid #1E1E1E',
  borderRadius: '16px',
  padding: '20px',
}

const metaPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: '11px',
  color: '#888888',
  background: '#0A0A0A',
  border: '1px solid #1E1E1E',
  borderRadius: '9999px',
  padding: '4px 8px',
  whiteSpace: 'nowrap',
}

function actionBadgeStyle(color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    fontWeight: 700,
    color,
    background: `${color}18`,
    border: `1px solid ${color}22`,
    borderRadius: '9999px',
    padding: '4px 8px',
    whiteSpace: 'nowrap',
  }
}

function HeaderCell({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: '10px',
        color: '#666666',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  )
}

function ListValue({
  value,
  muted = false,
}: {
  value: string
  muted?: boolean
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: '12px',
          fontWeight: muted ? 500 : 600,
          color: muted ? '#888888' : '#F0F0F0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function formatActionLabel(action: string) {
  return action.replace(/_/g, ' ')
}

function getUserEmail(entry: AuditEntry) {
  const details = entry.details ?? null
  const detailEmail = getDetailEmail(details)
  if (detailEmail) return detailEmail
  if (looksLikeEmail(entry.targetId)) return entry.targetId
  return `${entry.targetType} · ${entry.targetId}`
}

function getDetailEmail(details: Record<string, unknown> | null) {
  if (!details) return null
  const candidates = [details.email, details.userEmail, details.actorEmail]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.includes('@')) return candidate
  }
  return null
}

function looksLikeEmail(value: string) {
  return value.includes('@')
}

function relativeTime(dateStr: string) {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000))
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

function formatTimestamp(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

function getActionColor(action: string) {
  const colors: Record<string, string> = {
    ACCESS_REQUEST_CREATED: '#F59E0B',
    ACCESS_REQUEST_PROVISIONING_STARTED: '#60A5FA',
    ACCESS_REQUEST_APPROVED: '#22C55E',
    ACCESS_REQUEST_PROVISIONING_FAILED: '#F59E0B',
    ACCESS_REQUEST_REJECTED: '#EF4444',
    CERT_GENERATED: '#22C55E',
    CERT_REVOKED: '#EF4444',
    CERT_REGENERATED: '#EA7E20',
    USER_CREATED: '#22C55E',
    USER_UPDATED: '#F59E0B',
    USER_DELETED: '#EF4444',
    SETTINGS_UPDATED: '#8B5CF6',
    SYNC_STARTED: '#3B82F6',
    SYNC_COMPLETED: '#22C55E',
  }

  return colors[action] ?? '#888888'
}
