'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/ToastProvider'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface UserDetail {
  id: string
  email: string
  commonName: string
  displayName: string | null
  certStatus: string
  certCreatedAt: string | null
  certExpiresAt: string | null
  isEnabled: boolean
  isFlagged: boolean
  flagReason: string | null
  staticIp: string | null
  allowInternet: boolean
  maxConnections: number
  require2fa: boolean
  allowedSourceIps: string[]
  ccdSyncStatus: string
  lastCcdPush: string | null
  groups: { id: string; group: { id: string; name: string } }[]
  server: { id: string; name: string }
}

interface TempAccessGrant {
  id: string
  reason: string | null
  grantedBy: string
  createdAt: string
  startsAt: string
  expiresAt: string
  isActive: boolean
  revokedAt: string | null
  revokedBy: string | null
  server: { id: string; name: string }
  group: { id: string; name: string }
}

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: '3px 10px',
  borderRadius: 'var(--radius-full)',
  fontSize: '11px',
  fontWeight: 500,
  background: bg,
  color,
  display: 'inline-block',
})

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  padding: '20px',
}

const sectionTitle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: '16px',
}

const dtStyle: React.CSSProperties = { fontSize: '13px', color: 'var(--text-secondary)' }
const ddStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }

const certColors: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  REVOKED: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
  NONE: { bg: 'rgba(136,136,136,0.15)', color: '#888888' },
}

const syncColors: Record<string, { bg: string; color: string }> = {
  SUCCESS: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  PENDING: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  IN_PROGRESS: { bg: 'rgba(234,126,32,0.15)', color: '#EA7E20' },
  FAILED: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [tempGrants, setTempGrants] = useState<TempAccessGrant[]>([])
  const [showTempForm, setShowTempForm] = useState(false)
  const [tempForm, setTempForm] = useState({ groupId: '', duration: '24', unit: 'hours', reason: '' })
  const [grantingTemp, setGrantingTemp] = useState(false)
  const [tempHistoryLimit, setTempHistoryLimit] = useState(5)
  const [tempHistoryOpen, setTempHistoryOpen] = useState(false)
  const [availableGroups, setAvailableGroups] = useState<{ id: string; name: string }[]>([])
  const [showGroupAdd, setShowGroupAdd] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)
  const [removingGroupId, setRemovingGroupId] = useState<string | null>(null)
  const [showNetworkSettings, setShowNetworkSettings] = useState(false)
  const [networkForm, setNetworkForm] = useState({ staticIp: '', allowInternet: true, maxConnections: 1, require2fa: false, allowedSourceIps: '' })
  const [savingNetwork, setSavingNetwork] = useState(false)
  const [serverManagementEnabled, setServerManagementEnabled] = useState(true)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState(false)

  const fetchUser = () => {
    fetch(`/api/users/${params.id}`)
      .then((res) => res.json())
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }

  const fetchTempGrants = () => {
    fetch(`/api/users/${params.id}/temporary-access`)
      .then((res) => res.json())
      .then((data) => setTempGrants(Array.isArray(data) ? data : []))
      .catch(() => setTempGrants([]))
  }

  const fetchAvailableGroups = () => {
    if (!user) return
    fetch(`/api/servers/${user.server.id}`)
      .then((res) => res.json())
      .then((data) => {
        const groups = data.groups || []
        setAvailableGroups(groups.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })))
      })
      .catch(() => setAvailableGroups([]))
  }

  const handleAddGroup = async () => {
    if (!selectedGroupId) return
    setAddingGroup(true)
    try {
      const res = await fetch(`/api/users/${params.id}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroupId }),
      })
      if (res.ok) {
        setShowGroupAdd(false)
        setSelectedGroupId('')
        toast('Added to group', 'success')
        fetchUser()
      } else {
        toast('Failed to add to group', 'error')
      }
    } finally {
      setAddingGroup(false)
    }
  }

  const handleRemoveGroup = async (groupId: string) => {
    setRemovingGroupId(groupId)
    try {
      const res = await fetch(`/api/users/${params.id}/groups`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      })
      if (res.ok) toast('Removed from group', 'success')
      else toast('Failed to remove from group', 'error')
      fetchUser()
    } finally {
      setRemovingGroupId(null)
    }
  }

  useEffect(() => { fetchUser(); fetchTempGrants() }, [params.id])
  useEffect(() => { if (user) fetchAvailableGroups() }, [user?.server.id])
  useEffect(() => {
    fetch('/api/system/status')
      .then((res) => res.json())
      .then((data) => setServerManagementEnabled(data?.featureFlags?.serverManagementEnabled !== false))
      .catch(() => {})
  }, [])
  useEffect(() => {
    if (user) {
      setNetworkForm({
        staticIp: user.staticIp || '',
        allowInternet: user.allowInternet,
        maxConnections: user.maxConnections,
        require2fa: user.require2fa,
        allowedSourceIps: (user.allowedSourceIps || []).join(', '),
      })
    }
  }, [user?.id, user?.staticIp, user?.allowInternet, user?.maxConnections])

  const handleSaveNetwork = async () => {
    setSavingNetwork(true)
    try {
      const res = await fetch(`/api/users/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staticIp: networkForm.staticIp || null,
          allowInternet: networkForm.allowInternet,
          maxConnections: networkForm.maxConnections,
          require2fa: networkForm.require2fa,
          allowedSourceIps: networkForm.allowedSourceIps.split(',').map(s => s.trim()).filter(Boolean),
        }),
      })
      if (res.ok) {
        toast('Network settings saved', 'success')
        fetchUser()
      } else {
        toast('Failed to save network settings', 'error')
      }
    } finally {
      setSavingNetwork(false)
    }
  }

  const handleGrantTemp = async () => {
    setGrantingTemp(true)
    try {
      const multiplier = tempForm.unit === 'hours' ? 3600000 : tempForm.unit === 'days' ? 86400000 : 60000
      const expiresAt = new Date(Date.now() + parseInt(tempForm.duration) * multiplier)
      const res = await fetch(`/api/users/${params.id}/temporary-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: tempForm.groupId,
          expiresAt: expiresAt.toISOString(),
          reason: tempForm.reason || undefined,
        }),
      })
      if (res.ok) {
        setShowTempForm(false)
        setTempForm({ groupId: '', duration: '24', unit: 'hours', reason: '' })
        toast('Temporary access granted', 'success')
        fetchTempGrants()
        fetchUser()
      } else {
        const data = await res.json().catch(() => ({}))
        toast((data as Record<string, string>).error || 'Failed to grant temporary access', 'error')
      }
    } finally {
      setGrantingTemp(false)
    }
  }

  const handleRevokeTemp = async (grantId: string) => {
    const res = await fetch(`/api/users/${params.id}/temporary-access/${grantId}`, { method: 'DELETE' })
    if (res.ok) toast('Temporary access revoked', 'success')
    else toast('Failed to revoke access', 'error')
    fetchTempGrants()
    fetchUser()
  }

  const handleAction = async (action: string) => {
    if (!serverManagementEnabled && ['generate-cert', 'revoke-cert', 'regenerate-cert', 'push-ccd'].includes(action)) {
      toast('Server management is disabled in the current environment', 'error')
      return
    }

    setActionLoading(action)
    try {
      const actionMap: Record<string, { url: string; method: string; body?: string }> = {
        'generate-cert': { url: `/api/users/${params.id}/cert`, method: 'POST', body: JSON.stringify({ action: 'generate' }) },
        'revoke-cert': { url: `/api/users/${params.id}/cert`, method: 'POST', body: JSON.stringify({ action: 'revoke' }) },
        'regenerate-cert': { url: `/api/users/${params.id}/cert`, method: 'POST', body: JSON.stringify({ action: 'regenerate' }) },
        'push-ccd': { url: `/api/users/${params.id}/push-ccd`, method: 'POST' },
      }
      const mapped = actionMap[action] || { url: `/api/users/${params.id}/${action}`, method: 'POST' }
      const res = await fetch(mapped.url, {
        method: mapped.method,
        headers: mapped.body ? { 'Content-Type': 'application/json' } : undefined,
        body: mapped.body,
      })
      if (res.ok) {
        toast(action.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' successful', 'success')
      } else {
        const data = await res.json().catch(() => ({}))
        toast((data as Record<string, string>).error || `${action} failed`, 'error')
      }
      fetchUser()
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteUser = async () => {
    setDeletingUser(true)
    try {
      const res = await fetch(`/api/users/${params.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast('VPN user deleted', 'success')
        router.push('/users')
        return
      }

      const data = await res.json().catch(() => ({}))
      toast((data as Record<string, string>).error || 'Failed to delete VPN user', 'error')
    } finally {
      setDeletingUser(false)
      setConfirmDeleteOpen(false)
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: 'var(--text-muted)' }}>Loading user...</div>
  }

  if (!user) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: 'var(--text-muted)' }}>User not found</div>
  }

  const cert = certColors[user.certStatus] || certColors.NONE
  const sync = syncColors[user.ccdSyncStatus] || syncColors.PENDING
  const latestTempGrant = tempGrants[0] || null
  const tempHistory = tempGrants.slice(1)
  const certSummaryRows = [
    { label: 'Lifecycle State', value: user.certStatus },
    { label: 'Issued', value: user.certCreatedAt ? new Date(user.certCreatedAt).toLocaleDateString() : 'Not issued yet' },
    { label: 'Expires', value: user.certExpiresAt ? new Date(user.certExpiresAt).toLocaleDateString() : 'No expiry on record' },
    {
      label: 'Next Step',
      value:
        user.certStatus === 'ACTIVE'
          ? 'Regenerate or revoke if the device is replaced or compromised'
          : user.certStatus === 'REVOKED'
            ? 'Generate a replacement certificate before the user can reconnect'
            : 'Generate the first client certificate to activate VPN access',
    },
  ]
  const certActionItems = [
    {
      action: user.certStatus === 'ACTIVE' ? 'regenerate-cert' : 'generate-cert',
      label: user.certStatus === 'ACTIVE' ? 'Regenerate certificate' : 'Generate certificate',
      loadingLabel: user.certStatus === 'ACTIVE' ? 'Regenerating...' : 'Generating...',
      color: '#EA7E20',
      visible: true,
    },
    {
      action: 'revoke-cert',
      label: 'Revoke certificate',
      loadingLabel: 'Revoking...',
      color: '#EF4444',
      visible: user.certStatus === 'ACTIVE',
    },
  ].filter((item) => item.visible)

  const getTempGrantState = (grant: TempAccessGrant) => {
    const now = new Date()
    const expires = new Date(grant.expiresAt)
    const isExpired = expires <= now
    const isRevoked = !grant.isActive
    const isLive = grant.isActive && !isExpired

    return {
      expires,
      isLive,
      label: isLive ? 'Active' : isRevoked ? 'Revoked' : 'Expired',
      colors: isLive
        ? { bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }
        : isRevoked
          ? { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' }
          : { bg: 'rgba(136,136,136,0.15)', color: '#888' },
    }
  }

  return (
    <div>
      <button
        onClick={() => router.push('/users')}
        style={{ fontSize: '13px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '16px', display: 'inline-block' }}
      >
        &larr; Back to Users
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{user.displayName || user.email}</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{user.commonName} &middot; {user.server.name}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {user.isFlagged && (
            <span style={badgeStyle('rgba(239,68,68,0.15)', '#EF4444')}>
              Flagged: {user.flagReason || 'Unknown'}
            </span>
          )}
          <button
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={deletingUser || !serverManagementEnabled}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'rgba(239,68,68,0.12)',
              color: '#EF4444',
              border: '1px solid rgba(239,68,68,0.22)',
              borderRadius: '10px',
              cursor: deletingUser || !serverManagementEnabled ? 'not-allowed' : 'pointer',
              opacity: deletingUser || !serverManagementEnabled ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {deletingUser ? 'Deleting...' : 'Delete VPN User'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
        {/* User Info */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>User Info</h3>
          <dl style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <dt style={dtStyle}>Email</dt>
              <dd style={ddStyle}>{user.email}</dd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <dt style={dtStyle}>Common Name</dt>
              <dd style={ddStyle}>{user.commonName}</dd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <dt style={dtStyle}>Status</dt>
              <dd>
                <span style={badgeStyle(
                  user.isEnabled ? 'rgba(34,197,94,0.15)' : 'rgba(136,136,136,0.15)',
                  user.isEnabled ? '#22C55E' : '#888888'
                )}>
                  {user.isEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Certificate */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Certificate Lifecycle</h3>
              <span style={badgeStyle(cert.bg, cert.color)}>{user.certStatus}</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Issue, replace, and revoke the client certificate that controls this user&apos;s VPN identity.
            </p>
          </div>

          {!serverManagementEnabled && (
            <div style={{
              marginBottom: '16px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(234,126,32,0.1)',
              border: '1px solid rgba(234,126,32,0.22)',
              fontSize: '12px',
              color: '#EA7E20',
              lineHeight: 1.5,
            }}>
              Certificate issuance and revocation are paused because server management is disabled in this environment.
            </div>
          )}

          <dl style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {certSummaryRows.map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <dt style={dtStyle}>{row.label}</dt>
                <dd style={{ ...ddStyle, textAlign: 'right', maxWidth: '60%' }}>{row.value}</dd>
              </div>
            ))}
          </dl>

          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>Available Actions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {certActionItems.map((item) => (
                <ActionButton
                  key={item.action}
                  label={item.label}
                  loadingLabel={item.loadingLabel}
                  action={item.action}
                  color={item.color}
                  actionLoading={actionLoading}
                  onAction={handleAction}
                  disabled={!serverManagementEnabled}
                />
              ))}
            </div>
          </div>
        </div>

        {/* CCD Status */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>CCD Delivery</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Push the latest network profile to the VPN server after access or routing changes.
            </p>
          </div>
          {!serverManagementEnabled && (
            <div style={{
              marginBottom: '16px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(234,126,32,0.1)',
              border: '1px solid rgba(234,126,32,0.22)',
              fontSize: '12px',
              color: '#EA7E20',
              lineHeight: 1.5,
            }}>
              CCD pushes are disabled while server management is turned off.
            </div>
          )}
          <dl style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <dt style={dtStyle}>Sync Status</dt>
              <dd><span style={badgeStyle(sync.bg, sync.color)}>{user.ccdSyncStatus}</span></dd>
            </div>
            {user.lastCcdPush && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <dt style={dtStyle}>Last Push</dt>
                <dd style={ddStyle}>{new Date(user.lastCcdPush).toLocaleString()}</dd>
              </div>
            )}
          </dl>
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <ActionButton label="Push CCD" loadingLabel="Pushing..." action="push-ccd" color="#EA7E20" actionLoading={actionLoading} onAction={handleAction} disabled={!serverManagementEnabled} />
          </div>
        </div>

        {/* Groups */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Group Memberships</h3>
            <button
              onClick={() => { setShowGroupAdd(!showGroupAdd); if (!showGroupAdd) fetchAvailableGroups() }}
              style={{
                padding: '4px 10px', fontSize: '11px', fontWeight: 500, borderRadius: '6px',
                border: showGroupAdd ? '1px solid #2A2A2A' : 'none',
                background: showGroupAdd ? 'transparent' : '#EA7E20', color: showGroupAdd ? '#888' : '#FFF',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {showGroupAdd ? 'Cancel' : 'Add to Group'}
            </button>
          </div>

          {showGroupAdd && (() => {
            const memberGroupIds = new Set(user.groups.map((ug) => ug.group.id))
            const unjoined = availableGroups.filter((g) => !memberGroupIds.has(g.id))
            return (
              <div style={{ padding: '12px', background: 'var(--elevated)', borderRadius: 'var(--radius-lg)', marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                {unjoined.length > 0 ? (
                  <>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      style={{ flex: 1, padding: '6px 8px', background: '#1A1A1A', border: '1px solid #333', borderRadius: '6px', fontSize: '12px', color: '#F0F0F0', outline: 'none', fontFamily: 'inherit' }}
                    >
                      <option value="">Select a group...</option>
                      {unjoined.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddGroup}
                      disabled={!selectedGroupId || addingGroup}
                      style={{
                        padding: '6px 12px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
                        border: 'none', background: '#EA7E20', color: '#FFF',
                        cursor: !selectedGroupId || addingGroup ? 'not-allowed' : 'pointer',
                        opacity: !selectedGroupId || addingGroup ? 0.5 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap',
                      }}
                    >
                      {addingGroup ? 'Adding...' : 'Add'}
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>User is already in all available groups</span>
                )}
              </div>
            )
          })()}

          {user.groups.length > 0 ? (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {user.groups.map((ug) => (
                <li key={ug.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--elevated)', borderRadius: 'var(--radius-lg)', padding: '8px 12px' }}>
                  <a
                    href={`/groups/${ug.group.id}`}
                    style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
                  >
                    {ug.group.name}
                  </a>
                  <button
                    onClick={() => handleRemoveGroup(ug.group.id)}
                    disabled={removingGroupId === ug.group.id}
                    style={{
                      fontSize: '11px', color: '#EF4444', background: 'none', border: 'none',
                      cursor: removingGroupId === ug.group.id ? 'not-allowed' : 'pointer',
                      fontWeight: 500, fontFamily: 'inherit',
                      opacity: removingGroupId === ug.group.id ? 0.5 : 1,
                    }}
                  >
                    {removingGroupId === ug.group.id ? 'Removing...' : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No group memberships</p>
          )}
        </div>

        {/* Temporary Access */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Temporary Access</h3>
            <button
              onClick={() => setShowTempForm(!showTempForm)}
              style={{
                padding: '4px 10px', fontSize: '11px', fontWeight: 500, borderRadius: '6px',
                border: showTempForm ? '1px solid #2A2A2A' : 'none',
                background: showTempForm ? 'transparent' : '#8B5CF6', color: showTempForm ? '#888' : '#FFF',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {showTempForm ? 'Cancel' : 'Grant Access'}
            </button>
          </div>

          {showTempForm && (
            <div style={{ padding: '12px', background: 'var(--elevated)', borderRadius: 'var(--radius-lg)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(() => {
                const permanentGroupIds = new Set(user.groups.map((ug) => ug.group.id))
                const activeTempGroupIds = new Set(
                  tempGrants
                    .filter((grant) => grant.isActive && new Date(grant.expiresAt) > new Date())
                    .map((grant) => grant.group.id)
                )
                const grantableGroups = availableGroups.filter(
                  (group) => !permanentGroupIds.has(group.id) && !activeTempGroupIds.has(group.id)
                )

                return grantableGroups.length > 0 ? (
                  <select
                    value={tempForm.groupId}
                    onChange={(e) => setTempForm({ ...tempForm, groupId: e.target.value })}
                    style={{ padding: '6px 8px', background: '#1A1A1A', border: '1px solid #333', borderRadius: '6px', fontSize: '12px', color: '#F0F0F0', outline: 'none', fontFamily: 'inherit' }}
                  >
                    <option value="">Select a temporary group...</option>
                    {grantableGroups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    No additional groups are available for temporary access.
                  </div>
                )
              })()}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  min="1"
                  value={tempForm.duration}
                  onChange={(e) => setTempForm({ ...tempForm, duration: e.target.value })}
                  style={{ width: '70px', padding: '6px 8px', background: '#1A1A1A', border: '1px solid #333', borderRadius: '6px', fontSize: '12px', color: '#F0F0F0', outline: 'none', fontFamily: 'inherit' }}
                />
                <select
                  value={tempForm.unit}
                  onChange={(e) => setTempForm({ ...tempForm, unit: e.target.value })}
                  style={{ padding: '6px 8px', background: '#1A1A1A', border: '1px solid #333', borderRadius: '6px', fontSize: '12px', color: '#F0F0F0', outline: 'none', fontFamily: 'inherit' }}
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Reason (optional)"
                value={tempForm.reason}
                onChange={(e) => setTempForm({ ...tempForm, reason: e.target.value })}
                style={{ padding: '6px 8px', background: '#1A1A1A', border: '1px solid #333', borderRadius: '6px', fontSize: '12px', color: '#F0F0F0', outline: 'none', fontFamily: 'inherit' }}
              />
              <button
                onClick={handleGrantTemp}
                disabled={grantingTemp || !tempForm.groupId}
                style={{
                  padding: '6px 12px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
                  border: 'none', background: '#8B5CF6', color: '#FFF',
                  cursor: grantingTemp || !tempForm.groupId ? 'not-allowed' : 'pointer',
                  opacity: grantingTemp || !tempForm.groupId ? 0.5 : 1, fontFamily: 'inherit', alignSelf: 'flex-start',
                }}
              >
                {grantingTemp ? 'Granting...' : 'Grant Temporary Access'}
              </button>
            </div>
          )}

          {latestTempGrant ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(() => {
                const state = getTempGrantState(latestTempGrant)

                return (
                  <div style={{ background: 'var(--elevated)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                        Recent Action
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={badgeStyle(state.colors.bg, state.colors.color)}>{state.label}</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {latestTempGrant.group.name}
                        </span>
                        {latestTempGrant.reason && (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{latestTempGrant.reason}</span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Granted {new Date(latestTempGrant.startsAt).toLocaleString()} by {latestTempGrant.grantedBy}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Expires {state.expires.toLocaleString()}
                      </span>
                    </div>
                    {state.isLive && (
                      <button
                        onClick={() => handleRevokeTemp(latestTempGrant.id)}
                        style={{ fontSize: '11px', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                )
              })()}

              {tempHistory.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>History</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tempHistory.length} previous actions</span>
                  </div>
                  <button
                    onClick={() => setTempHistoryOpen(true)}
                    style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                  >
                    View History
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No temporary access grants</p>
          )}
        </div>

        {/* Network Settings */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showNetworkSettings ? '16px' : 0 }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Network Settings</h3>
            <button
              onClick={() => setShowNetworkSettings(!showNetworkSettings)}
              style={{
                padding: '4px 10px', fontSize: '11px', fontWeight: 500, borderRadius: '6px',
                border: showNetworkSettings ? '1px solid #2A2A2A' : 'none',
                background: showNetworkSettings ? 'transparent' : '#EA7E20', color: showNetworkSettings ? '#888' : '#FFF',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {showNetworkSettings ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {showNetworkSettings && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888888', marginBottom: '4px' }}>
                  Static IP (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10.8.0.50"
                  value={networkForm.staticIp}
                  onChange={(e) => setNetworkForm({ ...networkForm, staticIp: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', background: '#1A1A1A', border: '1px solid #333', borderRadius: '6px', fontSize: '12px', color: '#F0F0F0', outline: 'none', fontFamily: 'ui-monospace, monospace', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#888888' }}>Allow Internet</span>
                <button
                  onClick={() => setNetworkForm({ ...networkForm, allowInternet: !networkForm.allowInternet })}
                  style={{
                    width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer', position: 'relative',
                    background: networkForm.allowInternet ? '#EA7E20' : '#333',
                    transition: 'background 150ms',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#FFF',
                    left: networkForm.allowInternet ? '20px' : '2px', transition: 'left 150ms',
                  }} />
                </button>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888888', marginBottom: '4px' }}>
                  Max Connections
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={networkForm.maxConnections}
                  onChange={(e) => setNetworkForm({ ...networkForm, maxConnections: parseInt(e.target.value) || 1 })}
                  style={{ width: '80px', padding: '6px 8px', background: '#1A1A1A', border: '1px solid #333', borderRadius: '6px', fontSize: '12px', color: '#F0F0F0', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#888888' }}>Require 2FA</span>
                <button
                  onClick={() => setNetworkForm({ ...networkForm, require2fa: !networkForm.require2fa })}
                  style={{
                    width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer', position: 'relative',
                    background: networkForm.require2fa ? '#8B5CF6' : '#333',
                    transition: 'background 150ms',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#FFF',
                    left: networkForm.require2fa ? '20px' : '2px', transition: 'left 150ms',
                  }} />
                </button>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888888', marginBottom: '4px' }}>
                  Allowed Source IPs
                </label>
                <input
                  type="text"
                  placeholder="e.g. 203.0.113.0/24, 198.51.100.5"
                  value={networkForm.allowedSourceIps}
                  onChange={(e) => setNetworkForm({ ...networkForm, allowedSourceIps: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', background: '#1A1A1A', border: '1px solid #333', borderRadius: '6px', fontSize: '12px', color: '#F0F0F0', outline: 'none', fontFamily: 'ui-monospace, monospace', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '11px', color: '#555', marginTop: '2px', display: 'block' }}>
                  Comma-separated CIDRs or IPs. Leave empty to allow all.
                </span>
              </div>
              <button
                onClick={handleSaveNetwork}
                disabled={savingNetwork}
                style={{
                  padding: '6px 12px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
                  border: 'none', background: '#EA7E20', color: '#FFF',
                  cursor: savingNetwork ? 'not-allowed' : 'pointer', opacity: savingNetwork ? 0.5 : 1,
                  fontFamily: 'inherit', alignSelf: 'flex-start',
                }}
              >
                {savingNetwork ? 'Saving...' : 'Save Network Settings'}
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete VPN User"
        message="This will revoke the active certificate if present, remove the CCD from the VPN server, kill the active session, and delete the user from AccessCore. This action cannot be undone."
        confirmLabel={deletingUser ? 'Deleting...' : 'Delete User'}
        confirmColor="#EF4444"
        onConfirm={handleDeleteUser}
        onCancel={() => {
          if (!deletingUser) {
            setConfirmDeleteOpen(false)
          }
        }}
      />

      {tempHistoryOpen && (
        <div
          onClick={() => setTempHistoryOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '24px',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(720px, 100%)',
              maxHeight: '80vh',
              overflow: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Temporary Access History</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                  Previous temporary-access actions for this user.
                </p>
              </div>
              <button
                onClick={() => setTempHistoryOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600 }}
              >
                Close
              </button>
            </div>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tempHistory.slice(0, tempHistoryLimit).map((grant) => {
                const state = getTempGrantState(grant)

                return (
                  <li key={grant.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', background: 'var(--elevated)', borderRadius: 'var(--radius-lg)', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={badgeStyle(state.colors.bg, state.colors.color)}>{state.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {grant.group.name}
                        </span>
                        {grant.reason && (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{grant.reason}</span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Granted {new Date(grant.startsAt).toLocaleString()} by {grant.grantedBy}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Expires {state.expires.toLocaleString()}
                        {grant.revokedAt ? ` · Revoked ${new Date(grant.revokedAt).toLocaleString()}${grant.revokedBy ? ` by ${grant.revokedBy}` : ''}` : ''}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>

            {tempHistory.length > tempHistoryLimit && (
              <button
                onClick={() => setTempHistoryLimit((current) => current + 5)}
                style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
              >
                Load 5 more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionButton({ label, loadingLabel, action, color, actionLoading, onAction, disabled }: {
  label: string
  loadingLabel: string
  action: string
  color: string
  actionLoading: string | null
  onAction: (a: string) => void
  disabled?: boolean
}) {
  const isLoading = actionLoading === action
  const isDisabled = Boolean(disabled) || actionLoading !== null
  return (
    <button
      onClick={() => onAction(action)}
      disabled={isDisabled}
      style={{
        padding: '6px 12px',
        fontSize: '12px',
        fontWeight: 500,
        background: isLoading ? 'var(--elevated)' : color,
        color: isLoading ? 'var(--text-muted)' : '#FFFFFF',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled && !isLoading ? 0.5 : 1,
        fontFamily: 'inherit',
        transition: 'opacity 150ms',
      }}
    >
      {isLoading ? loadingLabel : label}
    </button>
  )
}
