'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/ToastProvider'
import type { DashboardAlertItem, DashboardAlertSeverity } from '@/lib/dashboard-alerts'

interface ConnectedUser {
  commonName: string
  realAddress: string
  vpnAddress: string
  bytesIn: number
  bytesOut: number
  connectedSince: string
  serverId: string
  serverName: string
}

interface DashboardStats {
  role?: string
  totalUsers: number
  activeCerts: number
  pendingFlags: number
  lastSync: string | null
  serverCount: number
  pendingRequests: number
  activeConnections: number
  totalBandwidthIn: number
  totalBandwidthOut: number
  serverConnections: Record<string, number>
  connectedUsers: ConnectedUser[]
  activityByDay: { date: string; count: number }[]
  revokedCerts: number
  noCerts: number
  expiringCerts: number
  todayAuditCount: number
  disabledUsers: number
  certWarningDays?: number
  alerts?: DashboardAlertItem[]
}

interface ViewerStats {
  role: 'VIEWER'
  certWarningDays: number
  approvedServers: { id: string; name: string; hostname: string; approvedAt: string }[]
  pendingRequestCount: number
  certExpiry: { serverName: string; serverId: string; certExpiresAt: string | null; certStatus: string }[]
  recentRequests: { id: string; serverName: string; status: string; createdAt: string; reviewNote: string | null }[]
}

interface VpnServer {
  id: string
  name: string
  hostname: string
  isActive?: boolean
  _count: { users: number; groups: number }
}

interface ServerStatus {
  id: string
  online: boolean
  uptimeSeconds?: number | null
  error?: string
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

function connectedDuration(dateStr: string): string {
  const now = Date.now()
  // OpenVPN status log dates are UTC without timezone marker
  const utcStr = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : dateStr.replace(' ', 'T') + 'Z'
  const then = new Date(utcStr).getTime()
  if (isNaN(then)) return '—'
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 0) return '0s'
  if (diffSec < 60) return `${diffSec}s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  const remainMin = diffMin % 60
  if (diffHr < 24) return `${diffHr}h ${remainMin}m`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ${diffHr % 24}h`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(1)} ${units[i]}`
}

function formatShortDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en', { weekday: 'short' })
}

function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${Math.max(minutes, 1)}m`
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '20px',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [viewerStats, setViewerStats] = useState<ViewerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [servers, setServers] = useState<VpnServer[]>([])
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({})
  const [pushingServers, setPushingServers] = useState<Record<string, boolean>>({})
  const [pushResults, setPushResults] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [showAllUsers, setShowAllUsers] = useState(false)
  const [killTarget, setKillTarget] = useState<{ commonName: string; serverId: string; serverName: string } | null>(null)
  const [killing, setKilling] = useState(false)
  const [viewport, setViewport] = useState<'phone' | 'tablet' | 'desktop'>('desktop')
  const { toast } = useToast()

  const fetchData = useCallback((isInitial = false) => {
    if (isInitial) setLoading(true)

    fetch('/api/dashboard/stats').then((r) => r.json()).then((data) => {
      if (data?.role === 'VIEWER') {
        setViewerStats(data as ViewerStats)
        setStats(null)
        setLastRefresh(new Date())
        setLoading(false)
        return
      }
      setStats(data)
      setViewerStats(null)
      setLastRefresh(new Date())

      Promise.all([
        fetch('/api/servers').then((r) => r.json()).catch(() => []),
      ]).then(([serversData]) => {
        const serverList: VpnServer[] = Array.isArray(serversData) ? serversData : []
        setServers(serverList)

        serverList.forEach((server) => {
          fetch(`/api/servers/${server.id}/status`)
            .then((r) => r.json())
            .then((status: ServerStatus) => {
              setServerStatuses((prev) => ({ ...prev, [server.id]: status }))
            })
            .catch(() => {
              setServerStatuses((prev) => ({
                ...prev,
                [server.id]: { id: server.id, online: false, error: 'Failed to fetch' },
              }))
            })
        })
      }).finally(() => setLoading(false))
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData(true)
    const interval = setInterval(() => fetchData(false), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    const phoneMedia = window.matchMedia('(max-width: 720px)')
    const tabletMedia = window.matchMedia('(max-width: 1080px)')
    const sync = () => {
      if (phoneMedia.matches) setViewport('phone')
      else if (tabletMedia.matches) setViewport('tablet')
      else setViewport('desktop')
    }

    sync()
    phoneMedia.addEventListener('change', sync)
    tabletMedia.addEventListener('change', sync)
    return () => {
      phoneMedia.removeEventListener('change', sync)
      tabletMedia.removeEventListener('change', sync)
    }
  }, [])

  const handlePushAllCcd = useCallback(async (serverId: string, serverName: string) => {
    setPushingServers((prev) => ({ ...prev, [serverId]: true }))
    setPushResults((prev) => { const next = { ...prev }; delete next[serverId]; return next })
    try {
      const res = await fetch(`/api/servers/${serverId}/push-all-ccd`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setPushResults((prev) => ({ ...prev, [serverId]: { ok: false, message: (data as Record<string, string>).error ?? `HTTP ${res.status}` } }))
      } else {
        const data = await res.json()
        const status = (data as Record<string, unknown>).status as string
        setPushResults((prev) => ({
          ...prev,
          [serverId]: {
            ok: status === 'SUCCESS',
            message: status === 'SUCCESS' ? `Pushed CCDs for ${serverName}` : `Completed with issues`,
          },
        }))
      }
    } catch {
      setPushResults((prev) => ({ ...prev, [serverId]: { ok: false, message: 'Network error' } }))
    } finally {
      setPushingServers((prev) => ({ ...prev, [serverId]: false }))
    }
  }, [])

  const handleKillSession = useCallback(async () => {
    if (!killTarget) return
    setKilling(true)
    try {
      const res = await fetch(`/api/servers/${killTarget.serverId}/kill-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commonName: killTarget.commonName }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast((data as Record<string, string>).error ?? `HTTP ${res.status}`, 'error')
      } else {
        toast('Session terminated', 'success')
        fetchData(false)
      }
    } catch {
      toast('Network error', 'error')
    } finally {
      setKilling(false)
      setKillTarget(null)
    }
  }, [killTarget, toast, fetchData])

  if (loading) {
    return (
      <div>
        <div style={{ height: '20px', width: '120px', background: 'var(--elevated)', borderRadius: '4px', marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
          {[1,2,3,4].map((i) => <div key={i} style={{ ...cardStyle, height: '90px' }} />)}
        </div>
        <div style={{ ...cardStyle, height: '200px', marginTop: '16px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div style={{ ...cardStyle, height: '300px' }} />
          <div style={{ ...cardStyle, height: '300px' }} />
        </div>
      </div>
    )
  }

  // Viewer dashboard
  if (viewerStats) {
    const now = new Date()
    const activeViewerCerts = viewerStats.certExpiry.filter((c) => c.certStatus === 'ACTIVE').length
    const revokedViewerCerts = viewerStats.certExpiry.filter((c) => c.certStatus === 'REVOKED').length
    const expiringViewerCerts = viewerStats.certExpiry.filter((c) => {
      if (c.certStatus !== 'ACTIVE' || !c.certExpiresAt) return false
      const daysUntilExpiry = Math.floor((new Date(c.certExpiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return daysUntilExpiry <= viewerStats.certWarningDays
    }).length
    const failedViewerRequests = viewerStats.recentRequests.filter((request) => request.status === 'FAILED').length
    const viewerHeroColumns = viewport === 'desktop' ? 'minmax(0, 1.2fr) minmax(280px, 0.8fr)' : '1fr'

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>AccessCore Overview</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
            <button
              onClick={() => fetchData(false)}
              style={{
                padding: '4px 10px', fontSize: '11px', fontWeight: 500, borderRadius: '6px',
                border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        <section style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: viewerHeroColumns, gap: '16px', alignItems: 'start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Portal Access</h3>
                <StatusBadge
                  label={
                    viewerStats.approvedServers.length > 0
                      ? 'Ready'
                      : viewerStats.pendingRequestCount > 0
                        ? 'In Review'
                        : 'Get Started'
                  }
                  color={
                    viewerStats.approvedServers.length > 0
                      ? '#22C55E'
                      : viewerStats.pendingRequestCount > 0
                        ? '#F59E0B'
                        : '#60A5FA'
                  }
                />
              </div>
              <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {viewerStats.approvedServers.length > 0
                  ? 'Your VPN access is ready.'
                  : viewerStats.pendingRequestCount > 0
                    ? 'Your access request is in progress.'
                    : 'Request VPN access to get started.'}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 0', lineHeight: 1.6, maxWidth: '720px' }}>
                {viewerStats.approvedServers.length > 0
                  ? 'Open My VPN to view your approved servers and download the configuration you need.'
                  : viewerStats.pendingRequestCount > 0
                    ? 'Come back here to follow approval progress. Once access is ready, Open My VPN will take you to your VPN servers.'
                    : 'Submit a request and return here to track status and access your VPN servers when approved.'}
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
                <Link
                  href={viewerStats.approvedServers.length > 0 ? '/my-access' : '/request-access'}
                  style={{
                    minHeight: '38px',
                    padding: '0 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(234,126,32,0.22)',
                    background: 'rgba(234,126,32,0.12)',
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {viewerStats.approvedServers.length > 0 ? 'Open My VPN' : 'Request Access'}
                </Link>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <InfoRow
                label="Approved Access"
                value={`${viewerStats.approvedServers.length} server${viewerStats.approvedServers.length === 1 ? '' : 's'}`}
                tone="#22C55E"
                helper={viewerStats.approvedServers.length > 0 ? 'Available from Open My VPN.' : 'No approved access yet.'}
              />
              <InfoRow
                label="Open Requests"
                value={`${viewerStats.pendingRequestCount}`}
                tone={viewerStats.pendingRequestCount > 0 ? '#F59E0B' : '#22C55E'}
                helper={viewerStats.pendingRequestCount > 0 ? 'Requests still in review or provisioning.' : 'Nothing waiting right now.'}
              />
              <InfoRow
                label="Certificate Health"
                value={expiringViewerCerts + revokedViewerCerts + failedViewerRequests > 0 ? 'Needs review' : 'Healthy'}
                tone={expiringViewerCerts + revokedViewerCerts + failedViewerRequests > 0 ? '#EF4444' : '#22C55E'}
                helper={
                  expiringViewerCerts + revokedViewerCerts + failedViewerRequests > 0
                    ? `${activeViewerCerts} active, ${expiringViewerCerts} expiring, ${revokedViewerCerts} revoked, ${failedViewerRequests} failed request${failedViewerRequests === 1 ? '' : 's'}.`
                    : 'No certificate or request issues to review.'
                }
              />
            </div>
          </div>
        </section>
      </div>
    )
  }

  const maxActivity = Math.max(...(stats?.activityByDay?.map((d) => d.count) || [1]), 1)
  const totalUsers = stats?.totalUsers ?? 0
  const activeConnections = stats?.activeConnections ?? 0
  const activeCerts = stats?.activeCerts ?? 0
  const activeCertPct = totalUsers > 0 ? Math.round((activeCerts / totalUsers) * 100) : 0
  const overviewColumns = viewport === 'desktop' ? 'minmax(0, 1.35fr) minmax(320px, 0.85fr)' : '1fr'
  const overviewStatColumns = viewport === 'desktop' ? 'repeat(4, minmax(0, 1fr))' : viewport === 'tablet' ? 'repeat(2, minmax(0, 1fr))' : '1fr'
  const detailPillColumns = viewport === 'desktop' ? 'repeat(4, minmax(0, 1fr))' : viewport === 'tablet' ? 'repeat(2, minmax(0, 1fr))' : '1fr'
  const healthColumns = viewport === 'phone' ? '1fr' : 'repeat(2, minmax(0, 1fr))'
  const lowerRowColumns = viewport === 'desktop' ? '1fr 1fr' : '1fr'

  return (
    <div>
      {/* Header with auto-refresh indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>Overview</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={() => fetchData(false)}
            style={{
              padding: '4px 10px', fontSize: '11px', fontWeight: 500, borderRadius: '6px',
              border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: overviewColumns, gap: '16px', marginBottom: '16px' }}>
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Network Overview</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                Live posture for connected users, server availability, request backlog, and sync activity.
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Last sync</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                {stats?.lastSync ? relativeTime(stats.lastSync) : 'Never'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: overviewStatColumns, gap: '12px' }}>
            <StatCard title="Connected" value={activeConnections} color="#22C55E" subtitle={`of ${totalUsers} users`} />
            <StatCard title="Active Certs" value={activeCerts} color="#3B82F6" subtitle={`${activeCertPct}% of users`} />
            <StatCard title="Servers" value={stats?.serverCount ?? 0} color="#8B5CF6" subtitle="configured" />
            <StatCard title="Requests" value={stats?.pendingRequests ?? 0} color="#F59E0B" subtitle="awaiting review" href="/access-requests" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: detailPillColumns, gap: '10px', marginTop: '14px' }}>
            <DetailPill label="Bandwidth In" value={formatBytes(stats?.totalBandwidthIn ?? 0)} color="#22C55E" />
            <DetailPill label="Bandwidth Out" value={formatBytes(stats?.totalBandwidthOut ?? 0)} color="var(--accent)" />
            <DetailPill label="Today's Events" value={String(stats?.todayAuditCount ?? 0)} color="var(--accent)" />
            <DetailPill label="Flagged Users" value={String(stats?.pendingFlags ?? 0)} color="#EF4444" />
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Certificate & Access Health</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                Certificate coverage, revocations, expirations, and account issues that need attention.
              </p>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#F59E0B',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.22)',
              borderRadius: '9999px',
              padding: '4px 8px',
              whiteSpace: 'nowrap',
            }}>
              {stats?.certWarningDays ?? 30}d warning
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: healthColumns, gap: '10px' }}>
            <MiniStat label="Active" value={stats?.activeCerts ?? 0} color="#22C55E" />
            <MiniStat label="Expiring Soon" value={stats?.expiringCerts ?? 0} color="#F59E0B" />
            <MiniStat label="Revoked" value={stats?.revokedCerts ?? 0} color="#EF4444" />
            <MiniStat label="No Certificate" value={stats?.noCerts ?? 0} color="var(--text-muted)" />
            <MiniStat label="Disabled Users" value={stats?.disabledUsers ?? 0} color="#EF4444" />
            <MiniStat label="Flagged Users" value={stats?.pendingFlags ?? 0} color="#EF4444" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
            <HealthNotice
              visible={(stats?.expiringCerts ?? 0) > 0}
              color="#F59E0B"
              message={`${stats?.expiringCerts ?? 0} cert${stats?.expiringCerts === 1 ? '' : 's'} expiring within ${stats?.certWarningDays ?? 30} days`}
            />
            <HealthNotice
              visible={(stats?.revokedCerts ?? 0) > 0}
              color="#EF4444"
              message={`${stats?.revokedCerts ?? 0} revoked cert${stats?.revokedCerts === 1 ? '' : 's'} currently on record`}
            />
            <HealthNotice
              visible={(stats?.disabledUsers ?? 0) > 0}
              color="#EF4444"
              message={`${stats?.disabledUsers ?? 0} disabled user${stats?.disabledUsers === 1 ? '' : 's'} may need review`}
            />
          </div>
        </section>
      </div>

      <section style={{ ...cardStyle, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Priority Alerts</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
              High-signal certificate and access risks that deserve an admin review.
            </p>
          </div>
          <Link href="/audit" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
            View Audit Trail
          </Link>
        </div>

        {(stats?.alerts?.length ?? 0) === 0 ? (
          <div style={{
            background: '#0A0A0A',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#22C55E',
            fontSize: '13px',
          }}>
            <StatusDot color="#22C55E" />
            <span>No priority alerts right now. Certificate and access posture look healthy.</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {stats?.alerts?.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </section>

      {/* Connected Users Table */}
      <div style={{ ...cardStyle, marginTop: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ConnectionIcon size={16} />
          Connected Users
          {(stats?.activeConnections ?? 0) > 0 && (
            <span style={{
              fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '10px',
              background: 'rgba(34,197,94,0.15)', color: '#22C55E',
            }}>
              {stats?.activeConnections} online
            </span>
          )}
        </h3>
        {(!stats?.connectedUsers || stats.connectedUsers.length === 0) ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No users currently connected</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>VPN IP</th>
                  <th style={thStyle}>Real IP</th>
                  <th style={thStyle}>Server</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Received</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Sent</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Duration</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {(showAllUsers ? stats.connectedUsers : stats.connectedUsers.slice(0, 5)).map((user, i) => (
                  <tr key={`${user.commonName}-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{user.commonName}</span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: '#22C55E' }}>
                      {user.vpnAddress || '—'}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {user.realAddress.split(':')[0]}
                    </td>
                    <td style={tdStyle}>
                      <Link href={`/servers/${user.serverId}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '12px' }}>
                        {user.serverName}
                      </Link>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#22C55E', fontFamily: 'var(--font-mono)' }}>
                      {formatBytes(user.bytesIn)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                      {formatBytes(user.bytesOut)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {connectedDuration(user.connectedSince)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', padding: '6px 8px' }}>
                      <button
                        onClick={() => setKillTarget({ commonName: user.commonName, serverId: user.serverId, serverName: user.serverName })}
                        disabled={killing}
                        title="Disconnect user"
                        style={{
                          width: '24px',
                          height: '24px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: killing ? 'not-allowed' : 'pointer',
                          fontSize: '16px',
                          fontWeight: 700,
                          lineHeight: '24px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'inherit',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#EF4444' }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--text-muted)' }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Bandwidth totals + expand toggle */}
            <div style={{
              display: 'flex', gap: '24px', paddingTop: '12px', marginTop: '4px',
              borderTop: '1px solid var(--border)', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Total received: <strong style={{ color: '#22C55E' }}>{formatBytes(stats?.totalBandwidthIn ?? 0)}</strong>
                {' / '}
                sent: <strong style={{ color: 'var(--accent)' }}>{formatBytes(stats?.totalBandwidthOut ?? 0)}</strong>
              </span>
              {stats.connectedUsers.length > 5 && (
                <button
                  onClick={() => setShowAllUsers(!showAllUsers)}
                  style={{
                    background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: '6px',
                    padding: '4px 10px', fontSize: '11px', color: 'var(--accent)', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {showAllUsers ? 'Show less' : `Show all ${stats.connectedUsers.length} users`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Server Health + Activity Chart row */}
      <div style={{ display: 'grid', gridTemplateColumns: lowerRowColumns, gap: '16px', marginTop: '16px' }}>
        {/* Servers with Push CCD */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ServerIcon size={16} />
            Servers
          </h3>
          {servers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No servers configured</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {servers.map((server) => {
                const status = serverStatuses[server.id]
                const isOnline = status?.online ?? false
                const statusLoading = !status
                const connCount = stats?.serverConnections?.[server.id] ?? 0
                const isPushing = pushingServers[server.id] ?? false
                const result = pushResults[server.id]

                return (
                  <div key={server.id} style={{
                    background: '#0A0A0A', border: '1px solid var(--border)', borderRadius: '12px',
                    padding: '14px', display: 'flex', alignItems: 'center', gap: '12px',
                  }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                      background: statusLoading ? 'var(--text-muted)' : isOnline ? '#22C55E' : '#EF4444',
                      boxShadow: statusLoading ? 'none' : isOnline ? '0 0 8px #22C55E80' : '0 0 8px #EF444480',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/servers/${server.id}`} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>
                        {server.name}
                      </Link>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {server.hostname}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: connCount > 0 ? '#22C55E' : 'var(--text-muted)' }}>{connCount}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>online</div>
                      </div>
                      <div style={{ textAlign: 'center', minWidth: '54px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: isOnline ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {isOnline ? formatUptime(status?.uptimeSeconds) : '—'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>uptime</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>{server._count.users}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>users</div>
                      </div>
                      <button
                        onClick={() => handlePushAllCcd(server.id, server.name)}
                        disabled={isPushing}
                        title="Push All CCDs"
                        style={{
                          width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                          background: isPushing ? 'var(--border-hover)' : 'rgba(234,126,32,0.15)',
                          color: 'var(--accent)', cursor: isPushing ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: isPushing ? 0.5 : 1,
                        }}
                      >
                        {isPushing ? <SpinnerIcon size={14} /> : <PushIcon size={14} />}
                      </button>
                    </div>
                    {result && (
                      <span style={{ fontSize: '11px', color: result.ok ? '#22C55E' : '#EF4444', flexShrink: 0 }}>
                        {result.ok ? 'Done' : 'Failed'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Last sync */}
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Last sync: {stats?.lastSync ? relativeTime(stats.lastSync) : 'Never'}
            </span>
            <Link href="/sync" style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' }}>
              History
            </Link>
          </div>
        </div>

        {/* Activity Chart */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ActivityIcon size={16} />
            Activity (7 days)
          </h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px', padding: '0 4px' }}>
            {stats?.activityByDay?.map((day) => {
              const heightPct = maxActivity > 0 ? (day.count / maxActivity) * 100 : 0
              return (
                <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {day.count > 0 ? day.count : ''}
                  </span>
                  <div style={{
                    width: '100%', maxWidth: '40px',
                    height: `${Math.max(heightPct, 4)}%`,
                    background: day.count > 0
                      ? 'linear-gradient(180deg, var(--accent) 0%, var(--accent-strong) 100%)'
                      : 'var(--border)',
                    borderRadius: '6px 6px 2px 2px',
                    transition: 'height 0.3s ease',
                    minHeight: '4px',
                  }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {formatShortDay(day.date)}
                  </span>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Link href="/audit" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
              View Activity
            </Link>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!killTarget}
        title="Disconnect User"
        message={killTarget ? `Disconnect ${killTarget.commonName} from ${killTarget.serverName}?` : ''}
        confirmLabel="Disconnect"
        confirmColor="#EF4444"
        onConfirm={handleKillSession}
        onCancel={() => setKillTarget(null)}
      />
    </div>
  )
}

/* ---- Helpers ---- */

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', fontSize: '11px',
  fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)',
}

function StatCard({ title, value, color, subtitle, href }: {
  title: string; value: number | string; color: string; subtitle?: string; href?: string
}) {
  const isTextValue = typeof value === 'string'
  const content = (
    <div style={{
      ...cardStyle,
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      height: '100%',
      minHeight: '94px',
      cursor: href ? 'pointer' : 'default',
    }}>
      <div style={{
        minWidth: isTextValue ? '72px' : '40px',
        height: '40px',
        padding: isTextValue ? '0 12px' : '0',
        borderRadius: isTextValue ? '9999px' : '10px',
        background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: isTextValue ? '12px' : '20px',
          fontWeight: 700,
          color,
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          {value}
        </span>
      </div>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>{title}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', minHeight: '30px', lineHeight: 1.35 }}>
          {subtitle ?? '\u00A0'}
        </div>
      </div>
    </div>
  )
  if (href) return <Link href={href} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>{content}</Link>
  return content
}

function DetailPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: '#0A0A0A',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, color }}>
        {value}
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  tone,
  helper,
}: {
  label: string
  value: string
  tone: string
  helper: string
}) {
  return (
    <div style={{
      background: '#0A0A0A',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '13px 14px',
      display: 'grid',
      gap: '6px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: tone }}>
          {value}
        </span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        {helper}
      </div>
    </div>
  )
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: '11px',
      fontWeight: 600,
      padding: '3px 8px',
      borderRadius: '9999px',
      background: `${color}18`,
      color,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function HealthNotice({ visible, color, message }: { visible: boolean; color: string; message: string }) {
  if (!visible) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '9px 12px',
      background: `${color}10`,
      border: `1px solid ${color}22`,
      borderRadius: '10px',
      fontSize: '12px',
      color,
    }}>
      <WarningIcon size={14} />
      <span>{message}</span>
    </div>
  )
}

function AlertRow({ alert }: { alert: DashboardAlertItem }) {
  const severityColor = getAlertSeverityColor(alert.severity)

  return (
    <div style={{
      background: '#0A0A0A',
      border: `1px solid ${severityColor}22`,
      borderRadius: '12px',
      padding: '14px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'grid', gap: '8px', minWidth: 0, flex: '1 1 320px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            fontWeight: 700,
            color: severityColor,
            background: `${severityColor}18`,
            borderRadius: '9999px',
            padding: '4px 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            <StatusDot color={severityColor} />
            {alert.severity}
          </span>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: severityColor,
            background: `${severityColor}10`,
            border: `1px solid ${severityColor}22`,
            borderRadius: '9999px',
            padding: '4px 8px',
          }}>
            {alert.count}
          </span>
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{alert.title}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{alert.message}</div>
      </div>

      <Link
        href={alert.href}
        style={{
          minHeight: '36px',
          padding: '0 12px',
          borderRadius: '10px',
          border: `1px solid ${severityColor}26`,
          background: `${severityColor}12`,
          color: severityColor,
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {alert.ctaLabel}
      </Link>
    </div>
  )
}

function StatusDot({ color }: { color: string }) {
  return (
    <span style={{
      width: '8px',
      height: '8px',
      borderRadius: '9999px',
      background: color,
      display: 'inline-block',
      flexShrink: 0,
    }} />
  )
}

function getAlertSeverityColor(severity: DashboardAlertSeverity) {
  switch (severity) {
    case 'critical':
      return '#EF4444'
    case 'warning':
      return '#F59E0B'
    default:
      return '#60A5FA'
  }
}

/* ---- SVG Icons ---- */

function ServerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  )
}

function ConnectionIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
    </svg>
  )
}

function ActivityIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function PushIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: '#0A0A0A', border: '1px solid var(--border)', borderRadius: '10px',
      padding: '10px 14px', textAlign: 'center', minHeight: '86px',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <div style={{ fontSize: '18px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

function WarningIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function SpinnerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
