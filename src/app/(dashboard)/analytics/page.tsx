import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { parseStatusLog } from '@/lib/connections'
import { authOptions } from '@/lib/auth'
import { getEffectiveSystemSettings } from '@/lib/system-settings'
import { OperationsShell } from '../operations-shared'
import AnalyticsView from './analytics-view'
import type { AnalyticsViewData } from './analytics-types'

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || (session.user as Record<string, unknown>).role !== 'ADMIN') {
    redirect('/')
  }

  const { prisma } = await import('@/lib/prisma')
  const settings = await getEffectiveSystemSettings()

  const sevenDaysAgo = startOfDayDaysAgo(6)
  const warnCutoff = new Date()
  warnCutoff.setDate(warnCutoff.getDate() + settings.certExpiryWarnDays)

  const [
    totalUsers,
    activeCerts,
    revokedCerts,
    noCerts,
    disabledUsers,
    flaggedUsers,
    pendingRequests,
    processingRequests,
    failedRequests,
    allServers,
    sevenDayLogs,
    recentConnections,
    initialAuditEntries,
    totalAuditEntries,
    expiringSoonUsers,
  ] = await Promise.all([
    prisma.vpnUser.count(),
    prisma.vpnUser.count({ where: { certStatus: 'ACTIVE' } }),
    prisma.vpnUser.count({ where: { certStatus: 'REVOKED' } }),
    prisma.vpnUser.count({ where: { certStatus: 'NONE' } }),
    prisma.vpnUser.count({ where: { isEnabled: false } }),
    prisma.vpnUser.count({ where: { isFlagged: true } }),
    prisma.accessRequest.count({ where: { status: 'PENDING' } }),
    prisma.accessRequest.count({ where: { status: 'PROCESSING' } }),
    prisma.accessRequest.count({ where: { status: 'FAILED' } }),
    prisma.vpnServer.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { id: true, action: true, actorEmail: true, createdAt: true, targetType: true, targetId: true, details: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.vpnConnection.findMany({
      where: {
        OR: [
          { connectedAt: { gte: sevenDaysAgo } },
          { disconnectedAt: { gte: sevenDaysAgo } },
          {
            connectedAt: { lte: new Date() },
            disconnectedAt: null,
          },
        ],
      },
      select: {
        connectedAt: true,
        disconnectedAt: true,
        bytesIn: true,
        bytesOut: true,
        serverId: true,
      },
      orderBy: { connectedAt: 'asc' },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, action: true, actorEmail: true, createdAt: true, targetType: true, targetId: true, details: true },
    }),
    prisma.auditLog.count(),
    prisma.vpnUser.findMany({
      where: {
        certStatus: 'ACTIVE',
        certExpiresAt: {
          not: null,
          lte: warnCutoff,
        },
      },
      orderBy: { certExpiresAt: 'asc' },
      take: 5,
      select: {
        id: true,
        email: true,
        certExpiresAt: true,
        server: { select: { id: true, name: true } },
      },
    }),
  ])

  let activeConnections = 0
  const serverTraffic =
    allServers.length > 0
      ? (
          await Promise.allSettled(
            allServers.map(async (server) => {
              const connections = await parseStatusLog(server.id)
              const bytesIn = connections.reduce((sum, connection) => sum + connection.bytesIn, 0)
              const bytesOut = connections.reduce((sum, connection) => sum + connection.bytesOut, 0)
              const liveSessions = connections.length

              return {
                id: server.id,
                name: server.name,
                liveSessions,
                bytesIn,
                bytesOut,
                totalTraffic: bytesIn + bytesOut,
              }
            })
          )
        )
          .map((result, index) => {
            if (result.status === 'fulfilled') {
              activeConnections += result.value.liveSessions
              return result.value
            }

            return {
              id: allServers[index].id,
              name: allServers[index].name,
              liveSessions: 0,
              bytesIn: 0,
              bytesOut: 0,
              totalTraffic: 0,
            }
          })
          .sort((a, b) => b.totalTraffic - a.totalTraffic)
      : []

  const activityByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sevenDaysAgo)
    date.setDate(sevenDaysAgo.getDate() + index)
    const dateKey = formatDateKey(date)
    const count = sevenDayLogs.filter((log) => formatDateKey(log.createdAt) === dateKey).length
    return { date: dateKey, count }
  })

  const todayKey = formatDateKey(new Date())
  const liveBytesInNow = serverTraffic.reduce((sum, server) => sum + server.bytesIn, 0)
  const liveBytesOutNow = serverTraffic.reduce((sum, server) => sum + server.bytesOut, 0)
  const liveTrafficNow = serverTraffic.reduce((sum, server) => sum + server.totalTraffic, 0)

  const connectionSeries = Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date(sevenDaysAgo)
    dayStart.setDate(sevenDaysAgo.getDate() + index)
    dayStart.setHours(0, 0, 0, 0)

    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)

    const dateKey = formatDateKey(dayStart)
    const historicalActiveCount = recentConnections.filter((connection) => {
      return connection.connectedAt <= dayEnd && (!connection.disconnectedAt || connection.disconnectedAt > dayEnd)
    }).length

    const historicalBytesIn = recentConnections.reduce((sum, connection) => {
      const connectedDateKey = formatDateKey(connection.connectedAt)
      if (connectedDateKey !== dateKey) return sum
      return sum + Number(connection.bytesIn)
    }, 0)

    const historicalBytesOut = recentConnections.reduce((sum, connection) => {
      const connectedDateKey = formatDateKey(connection.connectedAt)
      if (connectedDateKey !== dateKey) return sum
      return sum + Number(connection.bytesOut)
    }, 0)

    const activeCount = dateKey === todayKey ? Math.max(historicalActiveCount, activeConnections) : historicalActiveCount
    const bytesIn = dateKey === todayKey ? Math.max(historicalBytesIn, liveBytesInNow) : historicalBytesIn
    const bytesOut = dateKey === todayKey ? Math.max(historicalBytesOut, liveBytesOutNow) : historicalBytesOut
    const trafficBytes = dateKey === todayKey ? Math.max(historicalBytesIn + historicalBytesOut, liveTrafficNow) : historicalBytesIn + historicalBytesOut

    return {
      date: dateKey,
      activeCount,
      bytesIn,
      bytesOut,
      trafficBytes,
    }
  })

  const sevenDayTotal = activityByDay.reduce((sum, day) => sum + day.count, 0)
  const dailyAverage = Math.round((sevenDayTotal / Math.max(activityByDay.length, 1)) * 10) / 10
  const activeCertCoverage = totalUsers > 0 ? Math.round((activeCerts / totalUsers) * 100) : 0

  const actorBreakdown = Object.entries(
    sevenDayLogs.reduce<Record<string, number>>((acc, log) => {
      acc[log.actorEmail] = (acc[log.actorEmail] ?? 0) + 1
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([email, count]) => ({ email, count }))

  const maxServerTraffic = Math.max(...serverTraffic.map((server) => server.totalTraffic), 1)
  const healthyActiveCerts = Math.max(activeCerts - expiringSoonUsers.length, 0)
  const requestBreakdown = [
    { label: 'Pending', value: pendingRequests, color: '#F59E0B', helper: 'Awaiting an admin decision.' },
    { label: 'Provisioning', value: processingRequests, color: '#60A5FA', helper: 'Currently generating certs and access.' },
    { label: 'Failed', value: failedRequests, color: '#EF4444', helper: 'Need operator retry or follow-up.' },
  ]
  const certificateBreakdown = [
    { label: 'Active', value: healthyActiveCerts, color: '#22C55E', helper: 'Healthy active certificates.' },
    { label: 'Expiring', value: expiringSoonUsers.length, color: '#F59E0B', helper: `Inside ${settings.certExpiryWarnDays}-day warning window.` },
    { label: 'Revoked', value: revokedCerts, color: '#EF4444', helper: 'Certificates no longer trusted.' },
    { label: 'No Cert', value: noCerts, color: '#666666', helper: 'Users without a certificate yet.' },
    { label: 'Disabled', value: disabledUsers, color: '#F97316', helper: 'Accounts blocked from access.' },
    { label: 'Flagged', value: flaggedUsers, color: '#8B5CF6', helper: 'Users requiring review.' },
  ]
  const topOperators = actorBreakdown.slice(0, 3)
  const operatorSeries = topOperators.map((operator, index) => ({
    label: operator.email,
    color: ['#60A5FA', '#22C55E', '#EA7E20'][index] ?? '#888888',
    points: activityByDay.map((day) => ({
      date: day.date,
      value: sevenDayLogs.filter((log) => log.actorEmail === operator.email && formatDateKey(log.createdAt) === day.date).length,
    })),
  }))

  const data: AnalyticsViewData = {
    activeServerCount: allServers.length,
    metrics: [
      { label: '7-Day Events', value: String(sevenDayTotal), accent: '#EA7E20', helper: 'Audit events logged in the last week.' },
      { label: 'Live Sessions', value: String(activeConnections), accent: '#22C55E', helper: 'Current active connections across all servers.' },
      { label: 'VPN Users', value: String(totalUsers), accent: '#F0F0F0', helper: 'Tracked VPN identities across the fleet.' },
      {
        label: 'Open Requests',
        value: String(pendingRequests + processingRequests + failedRequests),
        accent: pendingRequests + processingRequests + failedRequests > 0 ? '#F59E0B' : '#22C55E',
        helper: 'Pending, provisioning, or failed requests.',
      },
      { label: 'Certificate Coverage', value: `${activeCertCoverage}%`, accent: '#60A5FA', helper: `${activeCerts} active certs across ${totalUsers} users.` },
      { label: 'Flags', value: String(flaggedUsers), accent: flaggedUsers > 0 ? '#8B5CF6' : '#22C55E', helper: 'Users currently flagged for review.' },
    ],
    activityTrend: activityByDay.map((day) => ({ date: day.date, value: day.count })),
    connectedUsersTrend: connectionSeries.map((day) => ({ date: day.date, value: day.activeCount })),
    trafficTrend: connectionSeries.map((day) => ({ date: day.date, value: day.trafficBytes, label: formatBytes(day.trafficBytes) })),
    inboundTrafficTrend: connectionSeries.map((day) => ({ date: day.date, value: day.bytesIn, label: formatBytes(day.bytesIn) })),
    outboundTrafficTrend: connectionSeries.map((day) => ({ date: day.date, value: day.bytesOut, label: formatBytes(day.bytesOut) })),
    operatorSeries,
    requestBreakdown,
    certificateBreakdown,
    dailyAverage,
    peakConnectedUsers: Math.max(...connectionSeries.map((day) => day.activeCount), 0),
    peakTraffic: formatBytes(Math.max(...connectionSeries.map((day) => day.trafficBytes), 0)),
    peakInboundTraffic: formatBytes(Math.max(...connectionSeries.map((day) => day.bytesIn), 0)),
    peakOutboundTraffic: formatBytes(Math.max(...connectionSeries.map((day) => day.bytesOut), 0)),
    topOperatorCount: topOperators.length,
    openRequestCount: pendingRequests + processingRequests + failedRequests,
    certificateCoverage: activeCertCoverage,
    serverTraffic,
    maxServerTraffic,
  }

  return (
    <OperationsShell
      title="Analytics"
      description="Review traffic, request throughput, certificate posture, and operator activity across AccessCore."
    >
      <AnalyticsView
        data={data}
        initialEntries={initialAuditEntries.map((entry) => ({
          ...entry,
          createdAt: entry.createdAt.toISOString(),
          details: (entry.details as Record<string, unknown> | null) ?? null,
        }))}
        totalEntries={totalAuditEntries}
      />
    </OperationsShell>
  )
}

function startOfDayDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatShortDay(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en', { weekday: 'short' })
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, unitIndex)
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
