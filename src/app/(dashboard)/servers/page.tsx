'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SkeletonCard, SkeletonLine } from '@/components/ui/Skeleton'

interface VpnServer {
  id: string
  name: string
  hostname: string
  transport: string
  clientCertValidityDays: number
  isActive: boolean
  _count?: { users: number; groups: number }
}

type ConnStatus = 'checking' | 'online' | 'offline'

interface LiveServerStatus {
  id: string
  online: boolean
  uptimeSeconds?: number | null
}

const defaultForm = {
  name: '',
  hostname: '',
  transport: 'SSH',
  sshHost: '',
  sshPort: '22',
  sshUser: 'root',
  instanceId: '',
  region: 'us-east-1',
  agentUrl: '',
  ccdPath: '/etc/openvpn/ccd',
  easyRsaPath: '/etc/openvpn/easy-rsa',
  serverConf: '/etc/openvpn/server.conf',
  clientCertValidityDays: '825',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: 'var(--elevated)',
  border: '1px solid var(--border-hover)',
  borderRadius: '8px',
  fontSize: '13px',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '4px',
}

export default function ServersPage() {
  const [servers, setServers] = useState<VpnServer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [connStatus, setConnStatus] = useState<Record<string, ConnStatus>>({})
  const [uptimeByServer, setUptimeByServer] = useState<Record<string, number | null>>({})
  const [serverManagementEnabled, setServerManagementEnabled] = useState(true)

  function formatUptime(seconds: number | null | undefined) {
    if (seconds == null || seconds < 0) return '—'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${Math.max(minutes, 1)}m`
  }

  const fetchServers = () => {
    fetch('/api/servers')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setServers(list)
        // Check connectivity for each active server
        list.filter((s: VpnServer) => s.isActive).forEach((s: VpnServer) => {
          setConnStatus((prev) => ({ ...prev, [s.id]: 'checking' }))
          fetch(`/api/servers/${s.id}/status`)
            .then((r) => r.json())
            .then((d: LiveServerStatus) => {
              setConnStatus((prev) => ({ ...prev, [s.id]: d.online ? 'online' : 'offline' }))
              setUptimeByServer((prev) => ({ ...prev, [s.id]: d.uptimeSeconds ?? null }))
            })
            .catch(() => {
              setConnStatus((prev) => ({ ...prev, [s.id]: 'offline' }))
              setUptimeByServer((prev) => ({ ...prev, [s.id]: null }))
            })
        })
      })
      .catch(() => setServers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchServers()
    const interval = setInterval(fetchServers, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetch('/api/system/status')
      .then((response) => response.json())
      .then((data) => {
        setServerManagementEnabled(data?.featureFlags?.serverManagementEnabled !== false)
      })
      .catch(() => {})
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        hostname: form.hostname,
        transport: form.transport,
        ccdPath: form.ccdPath,
        easyRsaPath: form.easyRsaPath,
        serverConf: form.serverConf,
        clientCertValidityDays: parseInt(form.clientCertValidityDays, 10) || 825,
      }
      if (form.transport === 'SSH') {
        payload.sshHost = form.sshHost
        payload.sshPort = parseInt(form.sshPort) || 22
        payload.sshUser = form.sshUser
      } else if (form.transport === 'SSM') {
        payload.instanceId = form.instanceId
        payload.region = form.region
      } else if (form.transport === 'AGENT') {
        payload.agentUrl = form.agentUrl
      }
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setShowForm(false)
        setForm(defaultForm)
        fetchServers()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create server')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const set = (key: string, value: string) => setForm({ ...form, [key]: value })

  const transportColors: Record<string, { bg: string; text: string }> = {
    SSM: { bg: 'rgba(168,85,247,0.15)', text: '#c084fc' },
    SSH: { bg: 'rgba(234,126,32,0.15)', text: '#60a5fa' },
    AGENT: { bg: 'rgba(20,184,166,0.15)', text: '#2dd4bf' },
  }

  if (loading) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <SkeletonLine width="80px" height="20px" />
          <SkeletonLine width="110px" height="36px" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          <SkeletonCard height="140px" />
          <SkeletonCard height="140px" />
          <SkeletonCard height="140px" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Servers</h2>
        {serverManagementEnabled && (
          <button
            onClick={() => { setShowForm(!showForm); setError('') }}
            style={{
              padding: '8px 16px',
              background: showForm ? 'transparent' : 'linear-gradient(to bottom, var(--accent), var(--accent-strong))',
              color: showForm ? 'var(--text-primary)' : '#0A0A0A',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '12px',
              border: showForm ? '1px solid var(--border-strong)' : 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {showForm ? 'Cancel' : 'New Server'}
          </button>
        )}
      </div>

      {!serverManagementEnabled && (
        <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', color: '#93C5FD', fontSize: '13px' }}>
          Server management is disabled by environment configuration. You can still review server inventory and status, but create and edit actions are unavailable.
        </div>
      )}

      {showForm && serverManagementEnabled && (
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
          {error && (
            <div style={{ padding: '8px 12px', marginBottom: '16px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {/* Row 1: Name, Hostname, Transport */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Server Name</label>
              <input type="text" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Production VPN" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Hostname / IP</label>
              <input type="text" required value={form.hostname} onChange={(e) => set('hostname', e.target.value)} placeholder="vpn.example.com" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Transport</label>
              <select
                value={form.transport}
                onChange={(e) => set('transport', e.target.value)}
                style={{ ...inputStyle, minWidth: '120px' }}
              >
                <option value="SSH">SSH</option>
                <option value="SSM">AWS SSM</option>
                <option value="AGENT">Agent</option>
              </select>
            </div>
          </div>

          {/* Transport-specific fields */}
          {form.transport === 'SSH' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>SSH Host</label>
                <input type="text" value={form.sshHost} onChange={(e) => set('sshHost', e.target.value)} placeholder="Same as hostname" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Port</label>
                <input type="text" value={form.sshPort} onChange={(e) => set('sshPort', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>SSH User</label>
                <input type="text" value={form.sshUser} onChange={(e) => set('sshUser', e.target.value)} style={inputStyle} />
              </div>
            </div>
          )}

          {form.transport === 'SSM' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Instance ID</label>
                <input type="text" value={form.instanceId} onChange={(e) => set('instanceId', e.target.value)} placeholder="i-0123456789abcdef0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>AWS Region</label>
                <input type="text" value={form.region} onChange={(e) => set('region', e.target.value)} style={inputStyle} />
              </div>
            </div>
          )}

          {form.transport === 'AGENT' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Agent URL</label>
              <input type="text" value={form.agentUrl} onChange={(e) => set('agentUrl', e.target.value)} placeholder="https://vpn-agent.example.com:8443" style={inputStyle} />
            </div>
          )}

          {/* Separator */}
          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0 16px' }} />

          {/* Row 3: Paths */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>CCD Path</label>
              <input type="text" required value={form.ccdPath} onChange={(e) => set('ccdPath', e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '12px' }} />
            </div>
            <div>
              <label style={labelStyle}>EasyRSA Path</label>
              <input type="text" required value={form.easyRsaPath} onChange={(e) => set('easyRsaPath', e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '12px' }} />
            </div>
            <div>
              <label style={labelStyle}>Server Config</label>
              <input type="text" required value={form.serverConf} onChange={(e) => set('serverConf', e.target.value)} style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '12px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px)', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Client Certificate Validity (Days)</label>
              <input type="number" min="1" max="3650" required value={form.clientCertValidityDays} onChange={(e) => set('clientCertValidityDays', e.target.value)} style={inputStyle} />
              <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>Applies to new and regenerated client certificates on this server.</p>
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
              fontFamily: 'inherit',
            }}
          >
            {submitting ? 'Creating...' : 'Create Server'}
          </button>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {servers.map((server) => {
          const isHovered = hoveredId === server.id
          const tc = transportColors[server.transport] || { bg: 'rgba(136,136,136,0.15)', text: 'var(--text-secondary)' }
          return (
            <Link
              key={server.id}
              href={`/servers/${server.id}`}
              style={{ textDecoration: 'none' }}
              onMouseEnter={() => setHoveredId(server.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div
                style={{
                  backgroundColor: isHovered ? 'var(--elevated)' : 'var(--surface)',
                  borderRadius: '20px',
                  border: `1px solid ${isHovered ? 'var(--border-strong)' : 'var(--border)'}`,
                  padding: '20px',
                  transition: 'background-color 0.15s, border-color 0.15s',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{server.name}</h3>
                      {(() => {
                        const status = connStatus[server.id]
                        const dotColor = status === 'online' ? '#22c55e' : status === 'offline' ? '#ef4444' : 'var(--text-secondary)'
                        const label = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Checking...'
                        return (
                          <span title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: dotColor,
                              boxShadow: status === 'online' ? '0 0 6px rgba(34,197,94,0.5)' : undefined,
                              animation: status === 'checking' ? 'pulse 1.5s infinite' : undefined,
                            }} />
                            <span style={{ fontSize: '11px', color: dotColor, fontWeight: 500 }}>{label}</span>
                          </span>
                        )
                      })()}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{server.hostname}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                      Uptime: {connStatus[server.id] === 'online' ? formatUptime(uptimeByServer[server.id]) : '—'}
                    </p>
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: 500,
                      backgroundColor: server.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(136,136,136,0.15)',
                      color: server.isActive ? '#4ade80' : 'var(--text-muted)',
                    }}
                  >
                    {server.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500, backgroundColor: tc.bg, color: tc.text }}>{server.transport}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{server._count?.users ?? 0} users</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{server._count?.groups ?? 0} groups</span>
                </div>
              </div>
            </Link>
          )
        })}
        {servers.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
            No servers configured. Click &quot;New Server&quot; to add one.
          </div>
        )}
      </div>
    </div>
  )
}
