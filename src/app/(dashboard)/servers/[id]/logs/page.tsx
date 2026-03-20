'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import ServerSectionNav from '@/components/servers/ServerSectionNav'
import ServerSubpageHeader from '@/components/servers/ServerSubpageHeader'

export default function ServerLogsPage() {
  const params = useParams()
  const [statusLog, setStatusLog] = useState('')
  const [openvpnLog, setOpenvpnLog] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'status' | 'openvpn'>('status')
  const [search, setSearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [serverManagementEnabled, setServerManagementEnabled] = useState(true)

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/servers/${params.id}/logs`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to fetch logs')
        return
      }
      const data = await res.json()
      setStatusLog(data.statusLog || '')
      setOpenvpnLog(data.openvpnLog || '')
      setError('')
    } catch {
      setError('Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    fetch('/api/system/status')
      .then((response) => response.json())
      .then((data) => {
        setServerManagementEnabled(data?.featureFlags?.serverManagementEnabled !== false)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchLogs, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchLogs])

  const currentLog = activeTab === 'status' ? statusLog : openvpnLog
  const lines = currentLog.split('\n')
  const filteredLines = search
    ? lines.filter((line) => line.toLowerCase().includes(search.toLowerCase()))
    : lines

  const getLineColor = (line: string): string => {
    const lower = line.toLowerCase()
    if (lower.includes('error')) return '#EF4444'
    if (lower.includes('warn')) return '#F59E0B'
    return 'var(--text-secondary)'
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '20px',
  }

  return (
    <div>
      <ServerSubpageHeader
        backHref={`/servers/${params.id}`}
        backLabel="← Back to Server"
        title="Server Logs"
        rightContent={
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            disabled={!serverManagementEnabled}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '8px',
              border: autoRefresh
                ? '1px solid var(--accent)'
                : '1px solid var(--border-strong)',
              background: autoRefresh
                ? 'rgba(234,126,32,0.15)'
                : 'transparent',
              color: autoRefresh ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: serverManagementEnabled ? 'pointer' : 'not-allowed',
              opacity: serverManagementEnabled ? 1 : 0.5,
              fontFamily: 'inherit',
            }}
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
        }
      />

      <div style={{ marginBottom: '16px' }}>
        <ServerSectionNav
          serverId={params.id as string}
          serverManagementEnabled={serverManagementEnabled}
        />
      </div>

      {!serverManagementEnabled && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: '16px',
            borderRadius: '8px',
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.18)',
            color: '#93C5FD',
            fontSize: '13px',
          }}
        >
          Server management is disabled by environment configuration. Log access is unavailable.
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: '16px',
            borderRadius: '8px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#EF4444',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      <div style={cardStyle}>
        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          {(
            [
              { key: 'status', label: 'Status Log' },
              { key: 'openvpn', label: 'OpenVPN Log' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '8px',
                border:
                  activeTab === tab.key
                    ? '1px solid var(--accent)'
                    : '1px solid var(--border-strong)',
                background:
                  activeTab === tab.key
                    ? 'rgba(234,126,32,0.15)'
                    : 'transparent',
                color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Filter log lines..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: 'var(--elevated)',
            border: '1px solid var(--border-hover)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'var(--font-mono)',
            marginBottom: '16px',
          }}
        />

        {/* Log content */}
        <div
          style={{
            background: '#0A0A0A',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '16px',
            maxHeight: '600px',
            overflowY: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            lineHeight: '1.6',
          }}
        >
          {loading ? (
            <span style={{ color: 'var(--text-muted)' }}>Loading logs...</span>
          ) : filteredLines.length === 0 ||
            (filteredLines.length === 1 && filteredLines[0] === '') ? (
            <span style={{ color: 'var(--text-muted)' }}>No log data available</span>
          ) : (
            filteredLines.map((line, i) => (
              <div key={i} style={{ color: getLineColor(line), whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
