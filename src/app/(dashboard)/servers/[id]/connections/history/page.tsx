'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import ServerSectionNav from '@/components/servers/ServerSectionNav'
import ServerSubpageHeader from '@/components/servers/ServerSubpageHeader'

interface Connection {
  id: string
  commonName: string
  realAddress: string
  vpnAddress: string
  bytesIn: string
  bytesOut: string
  connectedAt: string
  disconnectedAt: string | null
  duration: number | null
}

interface HistoryResponse {
  connections: Connection[]
  total: number
  page: number
  totalPages: number
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '—'
  if (seconds < 60) return `${seconds}s`
  const min = Math.floor(seconds / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  const remainMin = min % 60
  if (hr < 24) return `${hr}h ${remainMin}m`
  const day = Math.floor(hr / 24)
  return `${day}d ${hr % 24}h`
}

function formatBytes(bytesStr: string): string {
  const bytes = parseInt(bytesStr)
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  overflow: 'hidden',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontSize: '11px',
  fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.05em', background: '#0A0A0A',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)',
}

export default function ConnectionHistoryPage() {
  const params = useParams()
  const serverId = params.id as string
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchHistory = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(page), limit: '50' })
    if (search) qs.set('search', search)
    fetch(`/api/servers/${serverId}/connections/history?${qs}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [serverId, page, search])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  return (
    <div>
      <ServerSubpageHeader
        backHref={`/servers/${serverId}/connections`}
        backLabel="← Back to Live Connections"
        title="Connection History"
        rightContent={
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Filter by common name..."
              style={{
                padding: '6px 12px', background: 'var(--elevated)', border: '1px solid var(--border-hover)',
                borderRadius: '8px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none',
                fontFamily: 'inherit', width: '220px',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '6px 14px', background: 'var(--button-primary)', color: 'var(--button-primary-text)',
                fontSize: '13px', fontWeight: 600, borderRadius: '12px', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Filter
            </button>
          </form>
        }
      />

      <div style={{ marginBottom: '16px' }}>
        <ServerSectionNav serverId={serverId} />
      </div>

      {loading ? (
        <div style={{ ...cardStyle, padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : !data || data.connections.length === 0 ? (
        <div style={{ ...cardStyle, padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {search ? `No connections matching "${search}"` : 'No connection history yet'}
        </div>
      ) : (
        <>
          <div style={cardStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>VPN IP</th>
                  <th style={thStyle}>Real IP</th>
                  <th style={thStyle}>Connected</th>
                  <th style={thStyle}>Disconnected</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Duration</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Received</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Sent</th>
                </tr>
              </thead>
              <tbody>
                {data.connections.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, color: 'var(--text-primary)', fontWeight: 500 }}>{c.commonName}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: '#22C55E' }}>{c.vpnAddress || '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{c.realAddress.split(':')[0]}</td>
                    <td style={tdStyle}>{new Date(c.connectedAt).toLocaleString()}</td>
                    <td style={tdStyle}>{c.disconnectedAt ? new Date(c.disconnectedAt).toLocaleString() : '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatDuration(c.duration)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#22C55E', fontFamily: 'var(--font-mono)' }}>{formatBytes(c.bytesIn)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{formatBytes(c.bytesOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)',
          }}>
            <span>
              Showing {((data.page - 1) * 50) + 1}–{Math.min(data.page * 50, data.total)} of {data.total}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={data.page <= 1}
                style={{
                  padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--border-strong)',
                  background: 'transparent', color: data.page <= 1 ? 'var(--border-hover)' : 'var(--text-secondary)',
                  cursor: data.page <= 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '13px',
                }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={data.page >= data.totalPages}
                style={{
                  padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--border-strong)',
                  background: 'transparent', color: data.page >= data.totalPages ? 'var(--border-hover)' : 'var(--text-secondary)',
                  cursor: data.page >= data.totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '13px',
                }}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
