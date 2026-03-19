'use client'

import { SessionProvider, useSession, signIn } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ServerOption {
  id: string
  name: string
}

interface GroupOption {
  id: string
  name: string
  description: string | null
}

interface ExistingRequest {
  id: string
  status: string
  serverId: string
  server: { name: string }
  createdAt: string
  reviewNote: string | null
}

export default function RequestAccessPage() {
  return (
    <SessionProvider>
      <RequestAccessContent />
    </SessionProvider>
  )
}

function RequestAccessContent() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()
  const [servers, setServers] = useState<ServerOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [existing, setExisting] = useState<ExistingRequest[]>([])
  const [selectedServer, setSelectedServer] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [visibleActivityCount, setVisibleActivityCount] = useState(10)

  const role = (session?.user as Record<string, unknown>)?.role as string

  useEffect(() => {
    if (authStatus !== 'authenticated') return

    // If admin, redirect to dashboard
    if (role === 'ADMIN') {
      router.push('/')
      return
    }

    Promise.all([
      fetch('/api/servers/public').then(r => r.json()),
      fetch('/api/access-requests').then(r => r.json()),
    ]).then(([serversData, requestsData]) => {
      setServers(Array.isArray(serversData) ? serversData : [])
      setExisting(Array.isArray(requestsData) ? requestsData : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [authStatus, role, router])

  useEffect(() => {
    if (!selectedServer) {
      setGroups([])
      return
    }
    fetch(`/api/servers/${selectedServer}/groups`)
      .then(r => r.json())
      .then(data => setGroups(Array.isArray(data) ? data : []))
      .catch(() => setGroups([]))
  }, [selectedServer])

  const selectedServerRequest = existing.find(
    (request) =>
      request.serverId === selectedServer &&
      ['PENDING', 'PROCESSING', 'FAILED', 'APPROVED'].includes(request.status)
  )

  const blockedServerIds = new Set(
    existing
      .filter((request) => ['PENDING', 'PROCESSING', 'FAILED', 'APPROVED'].includes(request.status))
      .map((request) => request.serverId)
  )

  const getBlockedServerLabel = (serverId: string) => {
    const request = existing.find(
      (entry) =>
        entry.serverId === serverId &&
        ['PENDING', 'PROCESSING', 'FAILED', 'APPROVED'].includes(entry.status)
    )

    if (!request) {
      return null
    }

    if (request.status === 'APPROVED') {
      return 'already approved'
    }

    if (request.status === 'PROCESSING') {
      return 'provisioning in progress'
    }

    if (request.status === 'FAILED') {
      return 'awaiting admin retry'
    }

    return 'request already pending'
  }

  const activeRequestActivity = existing.filter((request) => request.status !== 'APPROVED')
  const visibleRequestActivity = activeRequestActivity.slice(0, visibleActivityCount)
  const approvedRequestCount = existing.filter((request) => request.status === 'APPROVED').length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedServerRequest) {
      setError(
        selectedServerRequest.status === 'APPROVED'
          ? 'You already have access for this VPN server.'
          : selectedServerRequest.status === 'PROCESSING'
            ? 'Your VPN access is already being provisioned for this server.'
            : selectedServerRequest.status === 'FAILED'
              ? 'Your last request for this server is awaiting an administrator retry.'
              : 'You already have a pending request for this VPN server.'
      )
      return
    }
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/access-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverId: selectedServer,
        groupIds: selectedGroups,
        reason,
      }),
    })

    if (res.ok) {
      setSuccess(true)
      setSelectedServer('')
      setSelectedGroups([])
      setReason('')
      // Refresh existing requests
      const updated = await fetch('/api/access-requests').then(r => r.json())
      setExisting(Array.isArray(updated) ? updated : [])
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to submit request')
    }
    setSubmitting(false)
  }

  const toggleGroup = (id: string) => {
    setSelectedGroups(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    )
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'rgba(234,126,32,0.15)', text: '#EA7E20' },
    PROCESSING: { bg: 'rgba(59,130,246,0.15)', text: '#60A5FA' },
    APPROVED: { bg: 'rgba(34,197,94,0.15)', text: '#22C55E' },
    FAILED: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
    REJECTED: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444' },
  }

  if (authStatus === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
        Loading...
      </div>
    )
  }

  // Unauthenticated: show sign-in screen
  if (authStatus === 'unauthenticated') {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{
          width: '100%', maxWidth: '400px', background: '#111', border: '1px solid #1E1E1E',
          borderRadius: '16px', padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: '24px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '48px', height: '48px', margin: '0 auto 16px',
              background: 'rgba(234,126,32,0.15)', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EA7E20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#F0F0F0', marginBottom: '6px' }}>
              Request VPN Access
            </h1>
            <p style={{ fontSize: '13px', color: '#888' }}>
              Sign in with your Google account to request VPN access.
            </p>
          </div>

          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/request-access' })}
            style={{
              width: '100%', background: '#1A1A1A', border: '1px solid #333',
              borderRadius: '8px', padding: '12px 18px', fontSize: '14px',
              fontWeight: 500, color: '#F0F0F0', cursor: 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '10px', transition: 'border-color 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#555' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>

          <p style={{ fontSize: '11px', color: '#444', textAlign: 'center' }}>
            Your administrator will review your access request.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', padding: '40px 24px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <Link
          href="/"
          style={{
            fontSize: '13px',
            color: '#EA7E20',
            textDecoration: 'none',
            display: 'inline-block',
            marginBottom: '16px',
          }}
        >
          &larr; Back to Portal
        </Link>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px', height: '48px', margin: '0 auto 16px',
            background: 'rgba(234,126,32,0.15)', borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EA7E20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#F0F0F0', marginBottom: '8px' }}>
            Request VPN Access
          </h1>
          <p style={{ fontSize: '14px', color: '#888' }}>
            Submit a request to your administrator for VPN access.
          </p>
        </div>

        {/* Success message */}
        {success && (
          <div style={{
            padding: '16px', marginBottom: '24px', borderRadius: '12px',
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            color: '#22C55E', fontSize: '14px', textAlign: 'center',
          }}>
            Your request has been submitted. An administrator will review it shortly.
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '16px', marginBottom: '24px', borderRadius: '12px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#EF4444', fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        {/* Request form */}
        <form onSubmit={handleSubmit} style={{
          background: '#111', borderRadius: '16px', border: '1px solid #1E1E1E',
          padding: '24px', marginBottom: '24px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#F0F0F0', marginBottom: '16px' }}>
            New Request
          </h2>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888', marginBottom: '6px' }}>
              VPN Server
            </label>
            <select
              value={selectedServer}
              onChange={e => setSelectedServer(e.target.value)}
              required
              style={{
                width: '100%', padding: '10px 12px', background: '#1A1A1A',
                border: '1px solid #333', borderRadius: '8px', fontSize: '14px',
                color: '#F0F0F0', outline: 'none', fontFamily: 'inherit',
              }}
            >
              <option value="">Select a server...</option>
              {servers.map(s => (
                <option key={s.id} value={s.id} disabled={blockedServerIds.has(s.id)}>
                  {s.name}{blockedServerIds.has(s.id) ? ` - ${getBlockedServerLabel(s.id)}` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedServerRequest && (
            <div style={{
              padding: '12px 14px',
              marginBottom: '16px',
              borderRadius: '10px',
              background:
                selectedServerRequest.status === 'APPROVED'
                  ? 'rgba(34,197,94,0.1)'
                  : selectedServerRequest.status === 'PROCESSING'
                    ? 'rgba(59,130,246,0.1)'
                    : selectedServerRequest.status === 'FAILED'
                      ? 'rgba(245,158,11,0.12)'
                      : 'rgba(234,126,32,0.12)',
              border: `1px solid ${
                selectedServerRequest.status === 'APPROVED'
                  ? 'rgba(34,197,94,0.25)'
                  : selectedServerRequest.status === 'PROCESSING'
                    ? 'rgba(59,130,246,0.25)'
                    : selectedServerRequest.status === 'FAILED'
                      ? 'rgba(245,158,11,0.25)'
                      : 'rgba(234,126,32,0.25)'
              }`,
              color:
                selectedServerRequest.status === 'APPROVED'
                  ? '#22C55E'
                  : selectedServerRequest.status === 'PROCESSING'
                    ? '#60A5FA'
                    : selectedServerRequest.status === 'FAILED'
                      ? '#F59E0B'
                      : '#EA7E20',
              fontSize: '13px',
              lineHeight: 1.5,
            }}>
              {selectedServerRequest.status === 'APPROVED'
                ? 'You already have approved access for this VPN server.'
                : selectedServerRequest.status === 'PROCESSING'
                  ? 'Your access is currently being provisioned for this VPN server.'
                  : selectedServerRequest.status === 'FAILED'
                    ? 'Provisioning previously failed for this VPN server. An administrator needs to retry the request.'
                    : 'You already have a pending request for this VPN server.'}
            </div>
          )}

          {groups.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888', marginBottom: '8px' }}>
                Request Access to Groups (optional)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {groups.map(g => (
                  <label key={g.id} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', background: selectedGroups.includes(g.id) ? 'rgba(234,126,32,0.15)' : '#1A1A1A',
                    border: `1px solid ${selectedGroups.includes(g.id) ? 'rgba(234,126,32,0.3)' : '#333'}`,
                    borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#F0F0F0',
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      style={{ accentColor: '#EA7E20' }}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888', marginBottom: '6px' }}>
              Reason for Access
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why do you need VPN access?"
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', background: '#1A1A1A',
                border: '1px solid #333', borderRadius: '8px', fontSize: '14px',
                color: '#F0F0F0', outline: 'none', fontFamily: 'inherit',
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedServer || Boolean(selectedServerRequest)}
            style={{
              padding: '10px 20px', background: submitting ? '#1A1A1A' : '#EA7E20',
              color: submitting ? '#555' : '#FFF', fontSize: '14px', fontWeight: 600,
              borderRadius: '8px', border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>

        {approvedRequestCount > 0 && (
          <div style={{
            padding: '14px 16px', marginBottom: '24px', borderRadius: '12px',
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)',
            color: '#22C55E', fontSize: '13px', lineHeight: 1.6,
          }}>
            You already have approved VPN access. Open <Link href="/my-access" style={{ color: '#22C55E', fontWeight: 600, textDecoration: 'none' }}>My VPN</Link> to download your configuration and use your approved servers.
          </div>
        )}

        {/* Request activity */}
        {activeRequestActivity.length > 0 && (
          <div style={{
            background: '#111', borderRadius: '16px', border: '1px solid #1E1E1E',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#F0F0F0', margin: 0 }}>
                  Request Activity
                </h2>
                <p style={{ fontSize: '12px', color: '#666666', margin: '6px 0 0', lineHeight: 1.5 }}>
                  Recent requests that are still pending review, provisioning, failed, or rejected.
                </p>
              </div>
              <span style={{ fontSize: '12px', color: '#888888' }}>
                Showing {Math.min(visibleRequestActivity.length, activeRequestActivity.length)} of {activeRequestActivity.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visibleRequestActivity.map(r => {
                const sc = statusColors[r.status] || statusColors.PENDING
                return (
                  <div key={r.id} style={{
                    padding: '14px', background: '#1A1A1A', borderRadius: '10px',
                    border: '1px solid #2A2A2A',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#F0F0F0' }}>
                        {r.server.name}
                      </span>
                      <span style={{
                        padding: '3px 10px', borderRadius: '9999px', fontSize: '11px',
                        fontWeight: 600, background: sc.bg, color: sc.text,
                      }}>
                        {r.status}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                    {r.reviewNote && (
                      <p style={{ fontSize: '13px', color: '#888', marginTop: '6px', fontStyle: 'italic' }}>
                        &quot;{r.reviewNote}&quot;
                      </p>
                    )}
                    {r.status === 'FAILED' && !r.reviewNote && (
                      <p style={{ fontSize: '13px', color: '#F59E0B', marginTop: '8px' }}>
                        Provisioning failed. An administrator needs to retry this request.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {activeRequestActivity.length > visibleRequestActivity.length && (
              <button
                type="button"
                onClick={() => setVisibleActivityCount((current) => current + 10)}
                style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  background: 'transparent',
                  color: '#888888',
                  border: '1px solid #2A2A2A',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Load 10 More
              </button>
            )}
          </div>
        )}

        <p style={{ fontSize: '11px', color: '#444', textAlign: 'center', marginTop: '24px' }}>
          Access requests are reviewed by your VPN administrator.
        </p>
      </div>
    </div>
  )
}
