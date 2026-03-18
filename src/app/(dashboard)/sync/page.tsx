'use client'

import { useState, useEffect, CSSProperties } from 'react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { OperationsShell } from '../operations-shared'

interface SyncJob {
  id: string
  type: string
  status: string
  triggeredBy: string | null
  error: string | null
  details: Record<string, unknown> | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

interface GoogleMapping {
  id: string
  googleGroupEmail: string
  googleGroupName: string | null
  vpnGroupId: string
  vpnGroup: { id: string; name: string; serverId: string }
  createdAt: string
}

interface VpnGroup {
  id: string
  name: string
  serverId: string
}

interface Server {
  id: string
  name: string
}

const JOBS_PAGE_SIZE = 10

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '32px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#F0F0F0',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  select: {
    padding: '8px 12px',
    backgroundColor: '#1A1A1A',
    border: '1px solid #333333',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#F0F0F0',
    colorScheme: 'dark' as const,
    outline: 'none',
  } satisfies CSSProperties,
  primaryButton: {
    padding: '8px 16px',
    backgroundColor: '#EA7E20',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 500,
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  primaryButtonDisabled: {
    padding: '8px 16px',
    backgroundColor: '#EA7E20',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 500,
    borderRadius: '12px',
    border: 'none',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  secondaryButton: {
    padding: '8px 16px',
    backgroundColor: '#1A1A1A',
    color: '#F0F0F0',
    fontSize: '14px',
    fontWeight: 500,
    borderRadius: '12px',
    border: '1px solid #2A2A2A',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  darkButton: {
    padding: '6px 12px',
    backgroundColor: '#1A1A1A',
    color: '#F0F0F0',
    fontSize: '14px',
    fontWeight: 500,
    borderRadius: '12px',
    border: '1px solid #2A2A2A',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  errorAlert: {
    padding: '12px 16px',
    backgroundColor: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '12px',
    fontSize: '14px',
    color: '#EF4444',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#F0F0F0',
    margin: 0,
  },
  totalCount: {
    marginLeft: '8px',
    fontSize: '14px',
    fontWeight: 400,
    color: '#555555',
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: '16px',
    border: '1px solid #1E1E1E',
    overflow: 'hidden',
  },
  formCard: {
    marginBottom: '16px',
    padding: '16px',
    backgroundColor: '#1A1A1A',
    border: '1px solid #2A2A2A',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  formTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#F0F0F0',
    margin: 0,
  },
  formError: {
    fontSize: '14px',
    color: '#EF4444',
    margin: 0,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  input: {
    padding: '8px 12px',
    backgroundColor: '#1A1A1A',
    border: '1px solid #333333',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#F0F0F0',
    outline: 'none',
    colorScheme: 'dark' as const,
  } satisfies CSSProperties,
  formActions: {
    display: 'flex',
    gap: '8px',
  },
  loadMoreWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: '16px 20px 20px',
    borderTop: '1px solid #1E1E1E',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  thead: {
    borderBottom: '1px solid #1E1E1E',
    backgroundColor: '#1A1A1A',
  },
  th: {
    textAlign: 'left' as const,
    padding: '12px 20px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#555555',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  thEmpty: {
    padding: '12px 20px',
  },
  tr: {
    borderBottom: '1px solid #1E1E1E',
    transition: 'background-color 0.15s',
  },
  td: {
    padding: '12px 20px',
    fontSize: '14px',
    color: '#888888',
  },
  tdPrimary: {
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#F0F0F0',
  },
  tdSub: {
    fontSize: '12px',
    color: '#555555',
    marginTop: '2px',
  },
  removeButton: {
    fontSize: '12px',
    color: '#EF4444',
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  emptyState: {
    padding: '20px 32px',
    textAlign: 'center' as const,
    fontSize: '14px',
    color: '#555555',
  },
  loadingState: {
    padding: '20px 32px',
    textAlign: 'center' as const,
    fontSize: '14px',
    color: '#555555',
  },
  errorText: {
    color: '#EF4444',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  detailText: {
    color: '#555555',
  },
  detailsCell: {
    padding: '12px 20px',
    fontSize: '14px',
    color: '#888888',
    maxWidth: '280px',
  },
}

const statusBadgeStyles: Record<string, CSSProperties> = {
  SUCCESS: { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  PENDING: { backgroundColor: 'rgba(234,179,8,0.15)', color: '#EAB308' },
  IN_PROGRESS: { backgroundColor: 'rgba(234,126,32,0.15)', color: '#EA7E20' },
  FAILED: { backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' },
}

const typeBadgeStyles: Record<string, CSSProperties> = {
  GOOGLE_SYNC: { backgroundColor: 'rgba(234,126,32,0.15)', color: '#EA7E20' },
  CCD_PUSH: { backgroundColor: 'rgba(168,85,247,0.15)', color: '#A855F7' },
  CERT_OPERATION: { backgroundColor: 'rgba(20,184,166,0.15)', color: '#14B8A6' },
  IMPORT: { backgroundColor: 'rgba(249,115,22,0.15)', color: '#F97316' },
}

const defaultBadgeStyle: CSSProperties = { backgroundColor: 'rgba(85,85,85,0.15)', color: '#555555' }

const badgeBase: CSSProperties = {
  padding: '2px 8px',
  borderRadius: '9999px',
  fontSize: '12px',
  fontWeight: 500,
  display: 'inline-block',
}

export default function SyncPage() {
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const [mappings, setMappings] = useState<GoogleMapping[]>([])
  const [mappingsLoading, setMappingsLoading] = useState(true)

  const [servers, setServers] = useState<Server[]>([])
  const [groups, setGroups] = useState<VpnGroup[]>([])

  const [selectedServerId, setSelectedServerId] = useState('')
  const [showAddMapping, setShowAddMapping] = useState(false)
  const [newMapping, setNewMapping] = useState({ googleGroupEmail: '', googleGroupName: '', vpnGroupId: '' })
  const [addMappingError, setAddMappingError] = useState<string | null>(null)
  const [addMappingLoading, setAddMappingLoading] = useState(false)

  const fetchJobs = (options?: { append?: boolean }) => {
    const append = options?.append ?? false
    const nextOffset = append ? jobs.length : 0
    const params = new URLSearchParams({ limit: String(JOBS_PAGE_SIZE), offset: String(nextOffset) })
    if (selectedServerId) params.set('serverId', selectedServerId)

    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    fetch(`/api/sync/jobs?${params}`)
      .then((res) => res.json())
      .then((data) => {
        const nextJobs = Array.isArray(data.jobs) ? data.jobs : []
        setJobs((current) => append ? [...current, ...nextJobs] : nextJobs)
        setTotal(typeof data.total === 'number' ? data.total : 0)
      })
      .catch(() => {
        if (!append) {
          setJobs([])
        }
      })
      .finally(() => {
        setLoading(false)
        setLoadingMore(false)
      })
  }

  const fetchMappings = () => {
    const params = new URLSearchParams()
    if (selectedServerId) params.set('serverId', selectedServerId)

    fetch(`/api/google-mappings?${params}`)
      .then((res) => res.json())
      .then((data) => setMappings(Array.isArray(data) ? data : []))
      .catch(() => setMappings([]))
      .finally(() => setMappingsLoading(false))
  }

  const fetchServersAndGroups = () => {
    Promise.all([
      fetch('/api/servers').then((r) => r.json()),
      fetch('/api/groups').then((r) => r.json()),
    ]).then(([serversData, groupsData]) => {
      const serverList = Array.isArray(serversData) ? serversData : []
      setServers(serverList)
      setGroups(Array.isArray(groupsData) ? groupsData : [])
      if (serverList.length > 0 && !selectedServerId) {
        setSelectedServerId(serverList[0].id)
      }
    }).catch(() => {})
  }

  useEffect(() => {
    fetchServersAndGroups()
  }, [])

  useEffect(() => {
    if (selectedServerId) {
      setMappingsLoading(true)
      fetchJobs()
      fetchMappings()
    }
  }, [selectedServerId])

  const handleSync = async () => {
    if (!selectedServerId) return
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch('/api/sync/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: selectedServerId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setSyncError(data.error ?? 'Sync failed')
      } else {
        fetchJobs()
      }
    } finally {
      setSyncing(false)
    }
  }

  const [deleteMappingId, setDeleteMappingId] = useState<string | null>(null)

  const handleDeleteMapping = async (id: string) => {
    const res = await fetch(`/api/google-mappings/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMappings((prev) => prev.filter((m) => m.id !== id))
    }
    setDeleteMappingId(null)
  }

  const handleAddMapping = async () => {
    setAddMappingError(null)
    if (!newMapping.googleGroupEmail || !newMapping.vpnGroupId) {
      setAddMappingError('Google group email and VPN group are required.')
      return
    }
    setAddMappingLoading(true)
    try {
      const res = await fetch('/api/google-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMapping),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddMappingError(data.error ?? 'Failed to add mapping')
      } else {
        setMappings((prev) => [data, ...prev])
        setShowAddMapping(false)
        setNewMapping({ googleGroupEmail: '', googleGroupName: '', vpnGroupId: '' })
      }
    } finally {
      setAddMappingLoading(false)
    }
  }

  const filteredGroups = groups.filter((g) => !selectedServerId || g.serverId === selectedServerId)
  const hasMoreJobs = jobs.length < total

  const statusBadge = (status: string) => {
    const badgeStyle = statusBadgeStyles[status] || defaultBadgeStyle
    return (
      <span style={{ ...badgeBase, ...badgeStyle }}>
        {status}
      </span>
    )
  }

  const typeBadge = (type: string) => {
    const badgeStyle = typeBadgeStyles[type] || defaultBadgeStyle
    return (
      <span style={{ ...badgeBase, ...badgeStyle }}>
        {type.replace(/_/g, ' ')}
      </span>
    )
  }

  return (
    <OperationsShell
      title="Sync"
      description="Manage Google group mappings, run directory sync, and review the latest sync history per VPN server."
      actions={
        <>
          {servers.length > 1 && (
            <select
              value={selectedServerId}
              onChange={(e) => setSelectedServerId(e.target.value)}
              style={styles.select}
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleSync}
            disabled={syncing || !selectedServerId}
            style={syncing || !selectedServerId ? styles.primaryButtonDisabled : styles.primaryButton}
          >
            {syncing ? 'Syncing...' : 'Sync Google Now'}
          </button>
        </>
      }
    >
      <div style={styles.page}>
        {syncError && (
          <div style={styles.errorAlert}>
            {syncError}
          </div>
        )}

        {/* Google Group Mappings */}
        <section>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Google Group Mappings</h3>
          <button
            onClick={() => { setShowAddMapping(true); setAddMappingError(null) }}
            style={styles.darkButton}
          >
            Add Mapping
          </button>
        </div>

        {showAddMapping && (
          <div style={styles.formCard}>
            <h4 style={styles.formTitle}>New Google Group Mapping</h4>
            {addMappingError && (
              <p style={styles.formError}>{addMappingError}</p>
            )}
            <div style={styles.formGrid}>
              <input
                type="email"
                placeholder="Google group email"
                value={newMapping.googleGroupEmail}
                onChange={(e) => setNewMapping((p) => ({ ...p, googleGroupEmail: e.target.value }))}
                style={styles.input}
              />
              <input
                type="text"
                placeholder="Display name (optional)"
                value={newMapping.googleGroupName}
                onChange={(e) => setNewMapping((p) => ({ ...p, googleGroupName: e.target.value }))}
                style={styles.input}
              />
              <select
                value={newMapping.vpnGroupId}
                onChange={(e) => setNewMapping((p) => ({ ...p, vpnGroupId: e.target.value }))}
                style={styles.select}
              >
                <option value="">Select VPN group...</option>
                {filteredGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div style={styles.formActions}>
              <button
                onClick={handleAddMapping}
                disabled={addMappingLoading}
                style={addMappingLoading ? styles.primaryButtonDisabled : styles.primaryButton}
              >
                {addMappingLoading ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => { setShowAddMapping(false); setAddMappingError(null) }}
                style={styles.secondaryButton}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={styles.card}>
          {mappingsLoading ? (
            <div style={styles.loadingState}>Loading mappings...</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>Google Group</th>
                  <th style={styles.th}>VPN Group</th>
                  <th style={styles.th}>Added</th>
                  <th style={styles.thEmpty} />
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id} style={styles.tr}>
                    <td style={styles.tdPrimary}>
                      <div>{m.googleGroupEmail}</div>
                      {m.googleGroupName && (
                        <div style={styles.tdSub}>{m.googleGroupName}</div>
                      )}
                    </td>
                    <td style={styles.td}>{m.vpnGroup.name}</td>
                    <td style={styles.td}>
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <button
                        onClick={() => setDeleteMappingId(m.id)}
                        style={styles.removeButton}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {mappings.length === 0 && (
                  <tr>
                    <td colSpan={4} style={styles.emptyState}>
                      No Google group mappings. Add one to enable automatic sync.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        </section>

        {/* Sync History */}
        <section>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>
            Sync History
            {total > 0 && <span style={styles.totalCount}>({total} total)</span>}
          </h3>
        </div>

        <div style={styles.card}>
          {loading ? (
            <div style={styles.loadingState}>Loading sync history...</div>
          ) : (
            <>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thead}>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Triggered By</th>
                    <th style={styles.th}>Started</th>
                    <th style={styles.th}>Completed</th>
                    <th style={styles.th}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} style={styles.tr}>
                      <td style={styles.td}>{typeBadge(job.type)}</td>
                      <td style={styles.td}>{statusBadge(job.status)}</td>
                      <td style={styles.td}>{job.triggeredBy || '-'}</td>
                      <td style={styles.td}>
                        {job.startedAt ? new Date(job.startedAt).toLocaleString() : '-'}
                      </td>
                      <td style={styles.td}>
                        {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
                      </td>
                      <td style={styles.detailsCell}>
                        {job.error ? (
                          <span style={styles.errorText}>{job.error}</span>
                        ) : job.details ? (
                          <span style={styles.detailText}>
                            {typeof job.details.usersAdded === 'number' && `+${job.details.usersAdded} users`}
                            {typeof job.details.usersFlagged === 'number' && job.details.usersFlagged > 0 && `, ${job.details.usersFlagged} flagged`}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan={6} style={styles.emptyState}>No sync history</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {hasMoreJobs && (
                <div style={styles.loadMoreWrap}>
                  <button
                    onClick={() => fetchJobs({ append: true })}
                    disabled={loadingMore}
                    style={loadingMore ? styles.primaryButtonDisabled : styles.primaryButton}
                  >
                    {loadingMore ? 'Loading...' : `Load 10 More`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        </section>

        <ConfirmDialog
          open={deleteMappingId !== null}
          title="Remove Mapping"
          message="Remove this Google group mapping? This will not affect existing user memberships."
          confirmLabel="Remove"
          onConfirm={() => deleteMappingId && handleDeleteMapping(deleteMappingId)}
          onCancel={() => setDeleteMappingId(null)}
        />
      </div>
    </OperationsShell>
  )
}
