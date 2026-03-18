'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/ToastProvider'

interface CidrBlock {
  id: string
  cidr: string
  description: string | null
}

interface GroupMember {
  id: string
  user: { id: string; email: string; commonName: string }
  source: string
}

interface TemporaryGroupMember {
  id: string
  reason: string | null
  grantedBy: string
  expiresAt: string
  user: { id: string; email: string; commonName: string }
}

interface GroupDetail {
  id: string
  name: string
  description: string | null
  cidrBlocks: CidrBlock[]
  users: GroupMember[]
  temporaryAccess: TemporaryGroupMember[]
  server: { id: string; name: string }
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  padding: '20px',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: '16px',
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  background: '#1A1A1A',
  border: '1px solid #333333',
  borderRadius: 'var(--radius-md)',
  fontSize: '13px',
  color: '#F0F0F0',
  outline: 'none',
  fontFamily: 'inherit',
}

const listItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  background: 'var(--elevated)',
  borderRadius: 'var(--radius-lg)',
  padding: '12px 14px',
}

export default function GroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [newCidr, setNewCidr] = useState({ cidr: '', description: '' })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [syncingCcd, setSyncingCcd] = useState(false)

  const fetchGroup = () => {
    fetch(`/api/groups/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setGroup(data)
        if (data) setEditForm({ name: data.name, description: data.description || '' })
      })
      .catch(() => setGroup(null))
      .finally(() => setLoading(false))
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/groups/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        setEditing(false)
        toast('Group updated', 'success')
        fetchGroup()
      } else {
        toast('Failed to update group', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => { fetchGroup() }, [params.id])

  const handleAddCidr = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    try {
      const res = await fetch(`/api/groups/${params.id}/cidr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCidr),
      })
      if (res.ok) {
        setNewCidr({ cidr: '', description: '' })
        toast('CIDR block added', 'success')
        fetchGroup()
      } else {
        toast('Failed to add CIDR block', 'error')
      }
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveCidr = async (cidrId: string) => {
    const res = await fetch(`/api/groups/${params.id}/cidr/${cidrId}`, { method: 'DELETE' })
    if (res.ok) toast('CIDR block removed', 'success')
    else toast('Failed to remove CIDR block', 'error')
    fetchGroup()
  }

  const handleSyncCcd = async () => {
    setSyncingCcd(true)
    try {
      const res = await fetch(`/api/groups/${params.id}/push-ccd`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const syncedCount = typeof (data as { syncedCount?: number }).syncedCount === 'number'
          ? (data as { syncedCount: number }).syncedCount
          : undefined
        toast(
          syncedCount !== undefined
            ? `Synced CCD for ${syncedCount} affected user${syncedCount === 1 ? '' : 's'}`
            : 'Group CCD sync completed',
          'success'
        )
        return
      }

      const data = await res.json().catch(() => ({}))
      toast((data as Record<string, string>).error || 'Failed to sync CCD for group', 'error')
    } finally {
      setSyncingCcd(false)
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: 'var(--text-muted)' }}>Loading group...</div>
  }

  if (!group) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: 'var(--text-muted)' }}>Group not found</div>
  }

  return (
    <div>
      <button
        onClick={() => router.push('/groups')}
        style={{ fontSize: '13px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '16px', display: 'inline-block' }}
      >
        &larr; Back to Groups
      </button>

      <div style={{ marginBottom: '24px' }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              style={{ ...inputStyle, fontSize: '20px', fontWeight: 600, flex: 'none' }}
              placeholder="Group name"
            />
            <input
              type="text"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              style={{ ...inputStyle, flex: 'none' }}
              placeholder="Description (optional)"
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                style={{ padding: '6px 14px', background: '#EA7E20', color: '#FFF', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1, fontFamily: 'inherit' }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setEditing(false); if (group) setEditForm({ name: group.name, description: group.description || '' }) }}
                style={{ padding: '6px 14px', background: 'transparent', color: '#888', border: '1px solid #2A2A2A', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{group.name}</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{group.description || 'No description'} &middot; {group.server.name}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleSyncCcd}
                disabled={syncingCcd}
                style={{ padding: '6px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', background: '#EA7E20', color: '#FFF', cursor: syncingCcd ? 'not-allowed' : 'pointer', opacity: syncingCcd ? 0.5 : 1, fontFamily: 'inherit' }}
              >
                {syncingCcd ? 'Syncing...' : 'Sync CCD'}
              </button>
              <button
                onClick={() => setEditing(true)}
                style={{ padding: '6px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', background: '#EA7E20', color: '#FFF', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 14px', borderRadius: 'var(--radius-lg)', background: 'var(--elevated)' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Server</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{group.server.name}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 14px', borderRadius: 'var(--radius-lg)', background: 'var(--elevated)' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>CIDR Blocks</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{group.cidrBlocks.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 14px', borderRadius: 'var(--radius-lg)', background: 'var(--elevated)' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Members</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{group.users.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 14px', borderRadius: 'var(--radius-lg)', background: 'var(--elevated)' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Temporary Members</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{group.temporaryAccess.length}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ ...sectionTitleStyle, marginBottom: '4px' }}>CIDR Blocks</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Routes assigned to everyone in this group.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddCidr} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              required
              placeholder="10.8.1.0/24"
              value={newCidr.cidr}
              onChange={(e) => setNewCidr({ ...newCidr, cidr: e.target.value })}
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Description"
              value={newCidr.description}
              onChange={(e) => setNewCidr({ ...newCidr, description: e.target.value })}
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={adding}
              style={{
                padding: '8px 14px',
                background: '#EA7E20',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: adding ? 'not-allowed' : 'pointer',
                opacity: adding ? 0.5 : 1,
                fontFamily: 'inherit',
              }}
            >
              Add
            </button>
          </form>
          {group.cidrBlocks.length > 0 ? (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {group.cidrBlocks.map((cidr) => (
                <li key={cidr.id} style={listItemStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <span style={{ fontSize: '13px', fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{cidr.cidr}</span>
                    {cidr.description && (
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{cidr.description}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveCidr(cidr.id)}
                    style={{ fontSize: '11px', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, paddingTop: '2px' }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No CIDR blocks configured</p>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ ...sectionTitleStyle, marginBottom: '4px' }}>Members ({group.users.length})</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Users currently assigned to this group and how they were added.
            </p>
          </div>
          {group.users.length > 0 ? (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {group.users.map((membership) => (
                <li key={membership.id} style={listItemStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <a
                      href={`/users/${membership.user.id}`}
                      style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, wordBreak: 'break-word' }}
                    >
                      {membership.user.email}
                    </a>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-word' }}>
                      {membership.user.commonName}
                    </span>
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '10px',
                      fontWeight: 600,
                      background: membership.source === 'GOOGLE_SYNC' ? 'rgba(234,126,32,0.15)' : 'rgba(136,136,136,0.15)',
                      color: membership.source === 'GOOGLE_SYNC' ? '#EA7E20' : '#888888',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {membership.source}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No members</p>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ ...sectionTitleStyle, marginBottom: '4px' }}>Temporary Members ({group.temporaryAccess.length})</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Users with active temporary access to this group and when that access expires.
            </p>
          </div>
          {group.temporaryAccess.length > 0 ? (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {group.temporaryAccess.map((grant) => (
                <li key={grant.id} style={listItemStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <a
                      href={`/users/${grant.user.id}`}
                      style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, wordBreak: 'break-word' }}
                    >
                      {grant.user.email}
                    </a>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-word' }}>
                      {grant.user.commonName}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Expires {new Date(grant.expiresAt).toLocaleString()}
                      {grant.reason ? ` · ${grant.reason}` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '10px',
                        fontWeight: 600,
                        background: 'rgba(139,92,246,0.15)',
                        color: '#8B5CF6',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      TEMPORARY
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      By {grant.grantedBy}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No active temporary members</p>
          )}
        </div>
      </div>
    </div>
  )
}
