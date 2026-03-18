'use client'

import { useState, useEffect } from 'react'

interface AccessRequest {
  id: string
  email: string
  name: string | null
  serverId: string
  server: { id: string; name: string; hostname: string }
  groupIds: string[]
  reason: string | null
  status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'FAILED' | 'REJECTED'
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
}

export default function AccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PROCESSING' | 'APPROVED' | 'FAILED' | 'REJECTED'>('PENDING')
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchRequests = () => {
    const url = filter === 'ALL' ? '/api/access-requests' : `/api/access-requests?status=${filter}`
    fetch(url)
      .then(r => r.json())
      .then(data => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchRequests() }, [filter])

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessing(id)
    const res = await fetch(`/api/access-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reviewNote: reviewNote[id] || '' }),
    })
    if (res.ok) {
      fetchRequests()
    }
    setProcessing(null)
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'rgba(234,126,32,0.15)', text: '#EA7E20' },
    PROCESSING: { bg: 'rgba(59,130,246,0.15)', text: '#60A5FA' },
    APPROVED: { bg: 'rgba(34,197,94,0.15)', text: '#22C55E' },
    FAILED: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
    REJECTED: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444' },
  }

  const filters: Array<'ALL' | 'PENDING' | 'PROCESSING' | 'APPROVED' | 'FAILED' | 'REJECTED'> = ['ALL', 'PENDING', 'PROCESSING', 'APPROVED', 'FAILED', 'REJECTED']

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: '#555' }}>Loading...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div />
        <div style={{ display: 'flex', gap: '4px' }}>
          {filters.map(f => (
            <button
              key={f}
              onClick={() => { setLoading(true); setFilter(f) }}
              style={{
                padding: '6px 14px', fontSize: '12px', fontWeight: 500,
                borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
                background: filter === f ? 'rgba(234,126,32,0.15)' : 'transparent',
                color: filter === f ? '#EA7E20' : '#888',
              }}
            >
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 0', fontSize: '14px', color: '#555',
          background: '#111', borderRadius: '16px', border: '1px solid #1E1E1E',
        }}>
          No {filter === 'ALL' ? '' : filter.toLowerCase()} access requests.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {requests.map(r => {
            const sc = statusColors[r.status] || statusColors.PENDING
            return (
              <div key={r.id} style={{
                background: '#111', borderRadius: '16px', border: '1px solid #1E1E1E',
                padding: '20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#F0F0F0' }}>
                        {r.email}
                      </span>
                      <span style={{
                        padding: '3px 10px', borderRadius: '9999px', fontSize: '11px',
                        fontWeight: 600, background: sc.bg, color: sc.text,
                      }}>
                        {r.status}
                      </span>
                    </div>
                    {r.name && <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>{r.name}</p>}
                  </div>
                  <span style={{ fontSize: '12px', color: '#555' }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '13px', color: '#888' }}>
                    <span style={{ color: '#555' }}>Server:</span>{' '}
                    <span style={{ color: '#F0F0F0' }}>{r.server.name}</span>
                  </div>
                  {r.groupIds.length > 0 && (
                    <div style={{ fontSize: '13px', color: '#888' }}>
                      <span style={{ color: '#555' }}>Groups:</span>{' '}
                      <span style={{ color: '#F0F0F0' }}>{r.groupIds.length} requested</span>
                    </div>
                  )}
                </div>

                {r.reason && (
                  <div style={{
                    padding: '10px 14px', background: '#1A1A1A', borderRadius: '8px',
                    fontSize: '13px', color: '#CCC', marginBottom: '12px',
                    borderLeft: '3px solid #333',
                  }}>
                    {r.reason}
                  </div>
                )}

                {(r.status === 'PENDING' || r.status === 'FAILED') && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', paddingTop: '8px', borderTop: '1px solid #1E1E1E' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#555', marginBottom: '4px' }}>
                        Note (optional)
                      </label>
                      <input
                        type="text"
                        value={reviewNote[r.id] || ''}
                        onChange={e => setReviewNote(prev => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="Add a note..."
                        style={{
                          width: '100%', padding: '7px 10px', background: '#1A1A1A',
                          border: '1px solid #333', borderRadius: '6px', fontSize: '13px',
                          color: '#F0F0F0', outline: 'none', fontFamily: 'inherit',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <button
                      onClick={() => handleAction(r.id, 'approve')}
                      disabled={processing === r.id}
                      style={{
                        padding: '8px 16px', background: '#22C55E', color: '#FFF',
                        fontSize: '13px', fontWeight: 600, borderRadius: '8px',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      opacity: processing === r.id ? 0.5 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                      {r.status === 'FAILED' ? 'Retry Provisioning' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleAction(r.id, 'reject')}
                      disabled={processing === r.id}
                      style={{
                        padding: '8px 16px', background: 'transparent',
                        color: '#EF4444', fontSize: '13px', fontWeight: 600,
                        borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
                        cursor: 'pointer', fontFamily: 'inherit',
                        opacity: processing === r.id ? 0.5 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {r.status === 'PROCESSING' && (
                  <div style={{
                    marginTop: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid #1E1E1E',
                    fontSize: '12px',
                    color: '#60A5FA',
                  }}>
                    Access is being provisioned. The request will only become approved once certificate generation succeeds.
                  </div>
                )}

                {r.reviewedBy && (
                  <div style={{ fontSize: '12px', color: '#555', marginTop: '8px' }}>
                    Reviewed by {r.reviewedBy} on {new Date(r.reviewedAt!).toLocaleString()}
                    {r.reviewNote && <span style={{ color: '#888' }}> — &quot;{r.reviewNote}&quot;</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
