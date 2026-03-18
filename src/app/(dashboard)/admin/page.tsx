'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/ToastProvider'

interface AdminUser {
  id: string
  email: string
  role: string
  createdAt: string
  isApproved: boolean
  lastLoginAt: string | null
  hasPassword: boolean
  authMethod: string
  mfaEnabled: boolean
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
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

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 20px',
  fontSize: '12px',
  fontWeight: 600,
  color: '#555555',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

export default function AdminPage() {
  const { toast } = useToast()
  const { data: session } = useSession()
  const [allUsers, setAllUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', role: 'VIEWER' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'users' | 'pending'>('users')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null)
  const [resettingUserId, setResettingUserId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')

  const fetchUsers = () => {
    fetch('/api/admin/users')
      .then((res) => res.json())
      .then((data) => setAllUsers(Array.isArray(data) ? data : []))
      .catch(() => setAllUsers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [])

  const approvedUsers = allUsers.filter((u) => u.isApproved)
  const pendingUsers = allUsers.filter((u) => !u.isApproved)
  const currentUserEmail = session?.user?.email ?? null

  const filteredApproved = approvedUsers.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ email: '', password: '', role: 'VIEWER' })
        toast('User created successfully', 'success')
        fetchUsers()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create user')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string } | null>(null)

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast('User removed', 'success')
      fetchUsers()
    } else {
      const data = await res.json()
      toast(data.error || 'Failed to delete', 'error')
    }
    setDeleteTarget(null)
  }

  const handleToggleRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'VIEWER' : 'ADMIN'
    await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    toast(`Role updated to ${newRole}`, 'success')
    fetchUsers()
  }

  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: true }),
    })
    if (res.ok) {
      toast('User approved', 'success')
      fetchUsers()
    } else {
      const data = await res.json()
      toast(data.error || 'Failed to approve', 'error')
    }
  }

  const [rejectTarget, setRejectTarget] = useState<{ id: string; email: string } | null>(null)

  const togglePendingSelection = (id: string) => {
    setSelectedPendingIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }

  const toggleAllPending = () => {
    setSelectedPendingIds((current) =>
      current.length === pendingUsers.length ? [] : pendingUsers.map((user) => user.id)
    )
  }

  const handleReject = async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast('User rejected and removed', 'success')
      fetchUsers()
    } else {
      const data = await res.json()
      toast(data.error || 'Failed to reject', 'error')
    }
    setRejectTarget(null)
  }

  const handleBulkPendingAction = async () => {
    if (!bulkAction || selectedPendingIds.length === 0) return

    const actionLabel = bulkAction === 'approve' ? 'approved' : 'rejected'
    const failures: string[] = []

    await Promise.all(selectedPendingIds.map(async (id) => {
      const endpoint = `/api/admin/users/${id}`
      const options = bulkAction === 'approve'
        ? {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isApproved: true }),
          }
        : { method: 'DELETE' }

      const res = await fetch(endpoint, options)
      if (!res.ok) {
        failures.push(id)
      }
    }))

    if (failures.length > 0) {
      toast(`Some users could not be ${actionLabel}`, 'error')
    } else {
      toast(`${selectedPendingIds.length} user${selectedPendingIds.length === 1 ? '' : 's'} ${actionLabel}`, 'success')
    }

    setSelectedPendingIds([])
    setBulkAction(null)
    fetchUsers()
  }

  const handleResetPassword = async (id: string) => {
    if (resetPassword.length < 6) {
      toast('Password must be at least 6 characters', 'error')
      return
    }

    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPassword }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast((data as Record<string, string>).error || 'Failed to reset password', 'error')
      return
    }

    toast('Password reset', 'success')
    setResettingUserId(null)
    setResetPassword('')
    fetchUsers()
  }

  const handleResetMfa = async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}/mfa/reset`, {
      method: 'POST',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast((data as Record<string, string>).error || 'Failed to reset MFA', 'error')
      return
    }

    toast('MFA reset', 'success')
    fetchUsers()
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: '#555555' }}>Loading...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div />
        <button
          onClick={() => { setShowForm(!showForm); setError('') }}
          style={{
            padding: '8px 16px',
            backgroundColor: showForm ? 'transparent' : '#EA7E20',
            color: showForm ? '#F0F0F0' : '#FFFFFF',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '12px',
            border: showForm ? '1px solid #2A2A2A' : 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {showForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            backgroundColor: '#111111',
            borderRadius: '16px',
            border: '1px solid #1E1E1E',
            padding: '20px',
            marginBottom: '24px',
          }}
        >
          {error && (
            <div style={{ padding: '8px 12px', marginBottom: '16px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: '13px' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888888', marginBottom: '4px' }}>Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888888', marginBottom: '4px' }}>Password</label>
              <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888888', marginBottom: '4px' }}>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ ...inputStyle, minWidth: '120px' }}>
                <option value="VIEWER">Viewer</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '8px 16px', backgroundColor: '#EA7E20', color: '#FFFFFF', fontSize: '14px', fontWeight: 500,
              borderRadius: '12px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1, fontFamily: 'inherit',
            }}
          >
            {submitting ? 'Creating...' : 'Create User'}
          </button>
        </form>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '1px solid #1E1E1E' }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 500,
            color: activeTab === 'users' ? '#F0F0F0' : '#555555',
            background: 'transparent',
            border: 'none',
            borderBottom: `2px solid ${activeTab === 'users' ? '#EA7E20' : 'transparent'}`,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginBottom: '-1px',
          }}
        >
          Accounts
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 500,
            color: activeTab === 'pending' ? '#F0F0F0' : '#555555',
            background: 'transparent',
            border: 'none',
            borderBottom: `2px solid ${activeTab === 'pending' ? '#EA7E20' : 'transparent'}`,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginBottom: '-1px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          Pending Login Access
          {pendingUsers.length > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '20px',
              height: '20px',
              borderRadius: '9999px',
              backgroundColor: '#EA7E20',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 600,
              padding: '0 6px',
            }}>
              {pendingUsers.length}
            </span>
          )}
        </button>
      </div>

      {/* Portal Accounts Tab */}
      {activeTab === 'users' && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ ...inputStyle, maxWidth: '320px' }}
            />
          </div>

          <div style={{ backgroundColor: '#111111', borderRadius: '16px', border: '1px solid #1E1E1E', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E1E1E', backgroundColor: '#1A1A1A' }}>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Auth Method</th>
                  <th style={thStyle}>Last Login</th>
                  <th style={thStyle}>Added</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApproved.map((admin) => (
                  <tr key={admin.id} style={{ borderBottom: '1px solid #1E1E1E' }}>
                    <td style={{ padding: '12px 20px', fontSize: '14px', color: '#F0F0F0', fontWeight: 500 }}>
                      {admin.email}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: admin.role === 'ADMIN' ? 'rgba(234,126,32,0.15)' : 'rgba(136,136,136,0.15)',
                          color: admin.role === 'ADMIN' ? '#EA7E20' : '#888888',
                        }}
                      >
                        {admin.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: '#888888' }}>
                      {admin.authMethod}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: '#888888' }}>
                      {admin.lastLoginAt ? timeAgo(admin.lastLoginAt) : 'Never'}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: '#888888' }}>
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {admin.hasPassword && admin.email !== currentUserEmail && (
                          <button
                            onClick={() => {
                              setResettingUserId((current) => current === admin.id ? null : admin.id)
                              setResetPassword('')
                            }}
                            style={{
                              padding: '4px 10px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
                              border: '1px solid #2A2A2A', background: 'transparent', color: '#888888',
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Reset Password
                          </button>
                        )}
                        {admin.mfaEnabled && (
                          <button
                            onClick={() => handleResetMfa(admin.id)}
                            style={{
                              padding: '4px 10px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
                              border: '1px solid rgba(139,92,246,0.28)', background: 'rgba(139,92,246,0.1)', color: '#A78BFA',
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Reset MFA
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleRole(admin.id, admin.role)}
                          disabled={admin.email === currentUserEmail}
                          style={{
                            padding: '4px 10px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
                            border: '1px solid #2A2A2A', background: 'transparent', color: '#888888',
                            cursor: admin.email === currentUserEmail ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                            opacity: admin.email === currentUserEmail ? 0.5 : 1,
                          }}
                        >
                          {admin.role === 'ADMIN' ? 'Make Viewer' : 'Make Admin'}
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: admin.id, email: admin.email })}
                          style={{
                            padding: '4px 10px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
                            border: 'none', background: 'rgba(239,68,68,0.1)', color: '#EF4444',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredApproved.map((admin) => (
                  resettingUserId === admin.id ? (
                    <tr key={`${admin.id}-reset`} style={{ borderBottom: '1px solid #1E1E1E', background: '#151515' }}>
                      <td colSpan={6} style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <input
                            type="password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder="New password"
                            minLength={6}
                            style={{ ...inputStyle, maxWidth: '240px' }}
                          />
                          <button
                            onClick={() => handleResetPassword(admin.id)}
                            style={{
                              padding: '8px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '8px',
                              border: 'none', background: '#EA7E20', color: '#FFFFFF',
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Save Password
                          </button>
                          <button
                            onClick={() => {
                              setResettingUserId(null)
                              setResetPassword('')
                            }}
                            style={{
                              padding: '8px 12px', fontSize: '12px', fontWeight: 500, borderRadius: '8px',
                              border: '1px solid #2A2A2A', background: 'transparent', color: '#888888',
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null
                ))}
                {filteredApproved.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px 20px', textAlign: 'center', fontSize: '14px', color: '#555555' }}>
                      {searchQuery ? 'No users match your search' : 'No AccessCore accounts found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pending Portal Access Tab */}
      {activeTab === 'pending' && (
        <div style={{ backgroundColor: '#111111', borderRadius: '16px', border: '1px solid #1E1E1E', overflow: 'hidden' }}>
          {pendingUsers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #1E1E1E', background: '#151515' }}>
              <div style={{ fontSize: '13px', color: '#888888' }}>
                {selectedPendingIds.length} selected
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setBulkAction('approve')}
                  disabled={selectedPendingIds.length === 0}
                  style={{
                    padding: '6px 10px', fontSize: '12px', fontWeight: 600, borderRadius: '8px',
                    border: 'none', background: 'rgba(34,197,94,0.15)', color: '#22C55E',
                    cursor: selectedPendingIds.length === 0 ? 'not-allowed' : 'pointer', opacity: selectedPendingIds.length === 0 ? 0.5 : 1, fontFamily: 'inherit',
                  }}
                >
                  Approve Selected
                </button>
                <button
                  onClick={() => setBulkAction('reject')}
                  disabled={selectedPendingIds.length === 0}
                  style={{
                    padding: '6px 10px', fontSize: '12px', fontWeight: 600, borderRadius: '8px',
                    border: 'none', background: 'rgba(239,68,68,0.12)', color: '#EF4444',
                    cursor: selectedPendingIds.length === 0 ? 'not-allowed' : 'pointer', opacity: selectedPendingIds.length === 0 ? 0.5 : 1, fontFamily: 'inherit',
                  }}
                >
                  Reject Selected
                </button>
              </div>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E1E1E', backgroundColor: '#1A1A1A' }}>
                <th style={{ ...thStyle, width: '44px' }}>
                  <input
                    type="checkbox"
                    checked={pendingUsers.length > 0 && selectedPendingIds.length === pendingUsers.length}
                    onChange={toggleAllPending}
                    aria-label="Select all pending users"
                  />
                </th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Requested At</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #1E1E1E' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <input
                      type="checkbox"
                      checked={selectedPendingIds.includes(user.id)}
                      onChange={() => togglePendingSelection(user.id)}
                      aria-label={`Select ${user.email}`}
                    />
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: '14px', color: '#F0F0F0', fontWeight: 500 }}>
                    {user.email}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span
                      style={{
                        padding: '2px 10px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: 'rgba(136,136,136,0.15)',
                        color: '#888888',
                      }}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: '13px', color: '#888888' }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleApprove(user.id)}
                        style={{
                          padding: '4px 10px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
                          border: 'none', background: 'rgba(34,197,94,0.15)', color: '#22C55E',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setRejectTarget({ id: user.id, email: user.email })}
                        style={{
                          padding: '4px 10px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
                          border: 'none', background: 'rgba(239,68,68,0.1)', color: '#EF4444',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pendingUsers.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '32px 20px', textAlign: 'center', fontSize: '14px', color: '#555555' }}>
                    No pending AccessCore access requests
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove AccessCore Access"
        message={`Remove AccessCore access for ${deleteTarget?.email ?? ''}? They will no longer be able to log in.`}
        confirmLabel="Remove"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={rejectTarget !== null}
        title="Reject AccessCore Access"
        message={`Reject and remove AccessCore access for ${rejectTarget?.email ?? ''}?`}
        confirmLabel="Reject"
        onConfirm={() => rejectTarget && handleReject(rejectTarget.id)}
        onCancel={() => setRejectTarget(null)}
      />

      <ConfirmDialog
        open={bulkAction !== null}
        title={bulkAction === 'approve' ? 'Approve Selected Accounts' : 'Reject Selected Accounts'}
        message={
          bulkAction === 'approve'
            ? `Approve AccessCore access for ${selectedPendingIds.length} selected account${selectedPendingIds.length === 1 ? '' : 's'}?`
            : `Reject AccessCore access for ${selectedPendingIds.length} selected account${selectedPendingIds.length === 1 ? '' : 's'}?`
        }
        confirmLabel={bulkAction === 'approve' ? 'Approve All' : 'Reject All'}
        onConfirm={handleBulkPendingAction}
        onCancel={() => setBulkAction(null)}
      />
    </div>
  )
}
