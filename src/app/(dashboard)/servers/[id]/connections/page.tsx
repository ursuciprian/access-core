'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ServerSectionNav from '@/components/servers/ServerSectionNav'
import ServerSubpageHeader from '@/components/servers/ServerSubpageHeader'

interface Connection {
  commonName: string
  realAddress: string
  vpnAddress: string
  bytesIn: number
  bytesOut: number
  connectedSince: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(1)} ${units[i]}`
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '20px',
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '13px',
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border)',
}

export default function ConnectionsPage() {
  const params = useParams()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchConnections = () => {
    fetch(`/api/servers/${params.id}/connections`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
      })
      .then((data) => {
        setConnections(data)
        setError('')
      })
      .catch(() => setError('Failed to load connections'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchConnections()
    const interval = setInterval(fetchConnections, 30000)
    return () => clearInterval(interval)
  }, [params.id])

  return (
    <div>
      <ServerSubpageHeader
        backHref={`/servers/${params.id}`}
        backLabel="← Back to Server"
        title="Active Connections"
        rightContent={
          <>
            <Link
              href={`/servers/${params.id}/connections/history`}
              style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
            >
              View History
            </Link>
          </>
        }
      />

      <div style={{ marginBottom: '16px' }}>
        <ServerSectionNav serverId={params.id as string} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: 'var(--text-muted)' }}>
          Loading connections...
        </div>
      ) : error ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: '14px', color: '#EF4444' }}>{error}</p>
        </div>
      ) : connections.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>No active connections</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Connected clients will appear here</p>
        </div>
      ) : (
        <div style={cardStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Common Name</th>
                <th style={thStyle}>Real IP</th>
                <th style={thStyle}>VPN IP</th>
                <th style={thStyle}>Connected Since</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Bytes In</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Bytes Out</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((conn, i) => (
                <tr key={`${conn.commonName}-${i}`}>
                  <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--accent)' }}>{conn.commonName}</td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{conn.realAddress}</td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{conn.vpnAddress}</td>
                  <td style={tdStyle}>{conn.connectedSince}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{formatBytes(conn.bytesIn)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{formatBytes(conn.bytesOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
