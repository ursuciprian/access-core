'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ui/ToastProvider'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { SkeletonLine, SkeletonCard, SkeletonStatCard } from '@/components/ui/Skeleton'
import ServerSectionNav from '@/components/servers/ServerSectionNav'

interface ServerDetail {
  id: string
  name: string
  hostname: string
  transport: string
  instanceId: string | null
  region: string | null
  sshHost: string | null
  sshPort: number | null
  sshUser: string | null
  agentUrl: string | null
  ccdPath: string
  easyRsaPath: string
  serverConf: string
  isActive: boolean
  createdAt: string
  _count: { users: number; groups: number; syncJobs: number }
}

const cardStyle: React.CSSProperties = {
  background: '#111111',
  border: '1px solid #1E1E1E',
  borderRadius: '16px',
  padding: '20px',
}

const dtStyle: React.CSSProperties = { fontSize: '13px', color: '#888888' }
const ddStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 500, color: '#F0F0F0' }
const monoStyle: React.CSSProperties = {
  ...ddStyle,
  fontFamily: 'ui-monospace, monospace',
  fontSize: '12px',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  textAlign: 'right',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: '#1A1A1A',
  border: '1px solid #333333',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#F0F0F0',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: '#888888',
  marginBottom: '4px',
}

export default function ServerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [server, setServer] = useState<ServerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [serverManagementEnabled, setServerManagementEnabled] = useState(true)

  const fetchServer = () => {
    fetch(`/api/servers/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) { setServer(null); return }
        setServer(data)
        setForm({
          name: data.name,
          hostname: data.hostname,
          transport: data.transport,
          instanceId: data.instanceId || '',
          region: data.region || '',
          sshHost: data.sshHost || '',
          sshPort: String(data.sshPort || 22),
          sshUser: data.sshUser || '',
          agentUrl: data.agentUrl || '',
          ccdPath: data.ccdPath,
          easyRsaPath: data.easyRsaPath,
          serverConf: data.serverConf,
        })
      })
      .catch(() => setServer(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchServer() }, [params.id])

  useEffect(() => {
    fetch('/api/system/status')
      .then((response) => response.json())
      .then((data) => {
        setServerManagementEnabled(data?.featureFlags?.serverManagementEnabled !== false)
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        hostname: form.hostname,
        transport: form.transport,
        ccdPath: form.ccdPath,
        easyRsaPath: form.easyRsaPath,
        serverConf: form.serverConf,
      }
      if (form.transport === 'SSH') {
        payload.sshHost = form.sshHost || null
        payload.sshPort = parseInt(form.sshPort) || 22
        payload.sshUser = form.sshUser || null
      } else if (form.transport === 'SSM') {
        payload.instanceId = form.instanceId || null
        payload.region = form.region || null
      } else if (form.transport === 'AGENT') {
        payload.agentUrl = form.agentUrl || null
      }
      const res = await fetch(`/api/servers/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setEditing(false)
        fetchServer()
        toast('Server updated', 'success')
      } else {
        const data = await res.json()
        const msg = data.error || 'Failed to save'
        setError(msg)
        toast(msg, 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    if (!server) return
    await fetch(`/api/servers/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !server.isActive }),
    })
    fetchServer()
  }

  const set = (key: string, value: string) => setForm({ ...form, [key]: value })

  if (loading) {
    return (
      <div>
        <SkeletonLine width="120px" height="14px" />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', margin: '16px 0 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <SkeletonLine width="200px" height="24px" />
            <SkeletonLine width="160px" height="14px" />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <SkeletonLine width="90px" height="32px" />
            <SkeletonLine width="60px" height="32px" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '16px' }}>
          <SkeletonCard height="200px" />
          <SkeletonCard height="200px" />
        </div>
      </div>
    )
  }
  if (!server) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: '#555555' }}>Server not found</div>
  }

  const transportColors: Record<string, { bg: string; text: string }> = {
    SSM: { bg: 'rgba(168,85,247,0.15)', text: '#c084fc' },
    SSH: { bg: 'rgba(234,126,32,0.15)', text: '#60a5fa' },
    AGENT: { bg: 'rgba(20,184,166,0.15)', text: '#2dd4bf' },
  }
  const tc = transportColors[server.transport] || { bg: 'rgba(136,136,136,0.15)', text: '#888' }

  return (
    <div>
      <button
        onClick={() => router.push('/servers')}
        style={{ fontSize: '13px', color: '#EA7E20', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '16px' }}
      >
        &larr; Back to Servers
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#F0F0F0' }}>{server.name}</h2>
            <span style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500, background: server.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(136,136,136,0.15)', color: server.isActive ? '#4ade80' : '#555' }}>
              {server.isActive ? 'Active' : 'Inactive'}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500, background: tc.bg, color: tc.text }}>
              {server.transport}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#888888', marginTop: '4px' }}>{server.hostname}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {serverManagementEnabled && (
            <>
              <button
                onClick={() => server.isActive ? setConfirmDeactivate(true) : handleToggleActive()}
                style={{
                  padding: '6px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: '1px solid #2A2A2A',
                  background: 'transparent', color: server.isActive ? '#EF4444' : '#22C55E', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {server.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => setEditing(!editing)}
                style={{
                  padding: '6px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none',
                  background: editing ? 'transparent' : '#EA7E20', color: editing ? '#F0F0F0' : '#FFFFFF',
                  cursor: 'pointer', fontFamily: 'inherit',
                  ...(editing ? { border: '1px solid #2A2A2A' } : {}),
                }}
              >
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </>
          )}
        </div>
      </div>

      {!serverManagementEnabled && (
        <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', color: '#93C5FD', fontSize: '13px' }}>
          Server management is disabled by environment configuration. This page is currently read-only, and operational tools are hidden.
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Users', value: server._count.users, href: '/users', color: '#EA7E20' },
          { label: 'Groups', value: server._count.groups, href: '/groups', color: '#22C55E' },
          { label: 'Sync Jobs', value: server._count.syncJobs, href: '/sync', color: '#F59E0B' },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} style={{ textDecoration: 'none' }}>
            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#888888' }}>{stat.label}</span>
              <span style={{ fontSize: '28px', fontWeight: 600, color: '#F0F0F0' }}>{stat.value}</span>
            </div>
          </Link>
        ))}
      </div>

      {editing && serverManagementEnabled ? (
        /* Edit Form */
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F0F0F0', marginBottom: '16px' }}>Edit Server</h3>
          {error && (
            <div style={{ padding: '8px 12px', marginBottom: '16px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: '13px' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', marginBottom: '16px' }}>
            <div><label style={labelStyle}>Name</label><input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Hostname</label><input type="text" value={form.hostname} onChange={(e) => set('hostname', e.target.value)} style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Transport</label>
              <select value={form.transport} onChange={(e) => set('transport', e.target.value)} style={{ ...inputStyle, minWidth: '120px' }}>
                <option value="SSH">SSH</option><option value="SSM">AWS SSM</option><option value="AGENT">Agent</option>
              </select>
            </div>
          </div>
          {form.transport === 'SSH' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: '16px', marginBottom: '16px' }}>
              <div><label style={labelStyle}>SSH Host</label><input type="text" value={form.sshHost} onChange={(e) => set('sshHost', e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Port</label><input type="text" value={form.sshPort} onChange={(e) => set('sshPort', e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>SSH User</label><input type="text" value={form.sshUser} onChange={(e) => set('sshUser', e.target.value)} style={inputStyle} /></div>
            </div>
          )}
          {form.transport === 'SSM' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div><label style={labelStyle}>Instance ID</label><input type="text" value={form.instanceId} onChange={(e) => set('instanceId', e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Region</label><input type="text" value={form.region} onChange={(e) => set('region', e.target.value)} style={inputStyle} /></div>
            </div>
          )}
          {form.transport === 'AGENT' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Agent URL</label><input type="text" value={form.agentUrl} onChange={(e) => set('agentUrl', e.target.value)} style={inputStyle} />
            </div>
          )}
          <div style={{ height: '1px', background: '#1E1E1E', margin: '4px 0 16px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div><label style={labelStyle}>CCD Path</label><input type="text" value={form.ccdPath} onChange={(e) => set('ccdPath', e.target.value)} style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', fontSize: '12px' }} /></div>
            <div><label style={labelStyle}>EasyRSA Path</label><input type="text" value={form.easyRsaPath} onChange={(e) => set('easyRsaPath', e.target.value)} style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', fontSize: '12px' }} /></div>
            <div><label style={labelStyle}>Server Config</label><input type="text" value={form.serverConf} onChange={(e) => set('serverConf', e.target.value)} style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', fontSize: '12px' }} /></div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 16px', background: '#EA7E20', color: '#FFF', fontSize: '13px', fontWeight: 500, borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1, fontFamily: 'inherit' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      ) : (
        /* Read-only view */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '16px' }}>
            <div style={cardStyle}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#F0F0F0', marginBottom: '14px' }}>Connection</h3>
              <dl style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <CompactRow
                  label="Transport"
                  value={<span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 500, background: tc.bg, color: tc.text }}>{server.transport}</span>}
                />
                <CompactRow label="Hostname" value={server.hostname} />
                {server.transport === 'SSH' && (
                  <>
                    {server.sshHost && <CompactRow label="SSH Host" value={server.sshHost} />}
                    <CompactRow label="SSH Port" value={String(server.sshPort || 22)} />
                    {server.sshUser && <CompactRow label="SSH User" value={server.sshUser} />}
                  </>
                )}
                {server.transport === 'SSM' && (
                  <>
                    {server.instanceId && <CompactRow label="Instance ID" value={server.instanceId} mono />}
                    {server.region && <CompactRow label="Region" value={server.region} />}
                  </>
                )}
                {server.transport === 'AGENT' && server.agentUrl && (
                  <CompactRow label="Agent URL" value={server.agentUrl} mono />
                )}
              </dl>
            </div>

            <div style={cardStyle}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#F0F0F0', marginBottom: '14px' }}>Server Paths</h3>
              <dl style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <CompactRow label="CCD Directory" value={server.ccdPath} mono />
                <CompactRow label="EasyRSA" value={server.easyRsaPath} mono />
                <CompactRow label="Server Config" value={server.serverConf} mono />
              </dl>
            </div>
          </div>

          <ServerSectionNav
            serverId={server.id}
            serverManagementEnabled={serverManagementEnabled}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmDeactivate}
        title="Deactivate Server"
        message={`Are you sure you want to deactivate "${server.name}"? Users will no longer be able to connect through this server.`}
        confirmLabel="Deactivate"
        confirmColor="#EF4444"
        onConfirm={() => { setConfirmDeactivate(false); handleToggleActive() }}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </div>
  )
}

function CompactRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  const valueStyle: React.CSSProperties = mono
    ? monoStyle
    : { ...ddStyle, textAlign: 'right', overflowWrap: 'anywhere' }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
      <dt style={dtStyle}>{label}</dt>
      <dd style={typeof value === 'string' ? valueStyle : undefined}>{value}</dd>
    </div>
  )
}
