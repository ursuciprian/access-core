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
  background: '#111111',
  border: '1px solid #1E1E1E',
  borderRadius: '16px',
  overflow: 'hidden',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontSize: '11px',
  fontWeight: 600, color: '#555', textTransform: 'uppercase',
  letterSpacing: '0.05em', background: '#0A0A0A',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px', fontSize: '13px', color: '#888',
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
                padding: '6px 12px', background: '#1A1A1A', border: '1px solid #333',
                borderRadius: '8px', fontSize: '13px', color: '#F0F0F0', outline: 'none',
                fontFamily: 'inherit', width: '220px',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '6px 14px', background: '#EA7E20', color: '#FFF',
                fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none',
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
        <div style={{ ...cardStyle, padding: '48px', textAlign: 'center', color: '#555' }}>Loading...</div>
      ) : !data || data.connections.length === 0 ? (
        <div style={{ ...cardStyle, padding: '48px', textAlign: 'center', color: '#555' }}>
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
                  <tr key={c.id} style={{ borderBottom: '1px solid #1E1E1E' }}>
                    <td style={{ ...tdStyle, color: '#F0F0F0', fontWeight: 500 }}>{c.commonName}</td>
                    <td style={{ ...tdStyle, fontFamily: 'ui-monospace, monospace', color: '#22C55E' }}>{c.vpnAddress || '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'ui-monospace, monospace' }}>{c.realAddress.split(':')[0]}</td>
                    <td style={tdStyle}>{new Date(c.connectedAt).toLocaleString()}</td>
                    <td style={tdStyle}>{c.disconnectedAt ? new Date(c.disconnectedAt).toLocaleString() : '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatDuration(c.duration)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#22C55E', fontFamily: 'ui-monospace, monospace' }}>{formatBytes(c.bytesIn)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#EA7E20', fontFamily: 'ui-monospace, monospace' }}>{formatBytes(c.bytesOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: '16px', fontSize: '13px', color: '#888',
          }}>
            <span>
              Showing {((data.page - 1) * 50) + 1}–{Math.min(data.page * 50, data.total)} of {data.total}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={data.page <= 1}
                style={{
                  padding: '4px 12px', borderRadius: '6px', border: '1px solid #2A2A2A',
                  background: 'transparent', color: data.page <= 1 ? '#333' : '#888',
                  cursor: data.page <= 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '13px',
                }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={data.page >= data.totalPages}
                style={{
                  padding: '4px 12px', borderRadius: '6px', border: '1px solid #2A2A2A',
                  background: 'transparent', color: data.page >= data.totalPages ? '#333' : '#888',
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
