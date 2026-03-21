export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { parseStatusLog } from '@/lib/connections'
import { getEffectiveSystemSettings } from '@/lib/system-settings'
import { requireApprovedUser } from '@/lib/rbac'
import { buildDashboardAlerts } from '@/lib/dashboard-alerts'

export const GET = requireApprovedUser()(async (_request, session) => {
  const { prisma } = await import('@/lib/prisma')
  const settings = await getEffectiveSystemSettings()

  const certWarningDate = new Date()
  certWarningDate.setDate(certWarningDate.getDate() + settings.certExpiryWarnDays)
  const now = new Date()
  const stalePendingCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const staleProcessingCutoff = new Date(now.getTime() - 30 * 60 * 1000)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [totalUsers, activeCerts, pendingFlags, lastSyncJob, serverCount, pendingRequests, revokedCerts, noCerts, expiringCerts, todayAuditCount, disabledUsers, failedProvisioningCount, stalePendingRequestCount, staleProcessingRequestCount, earliestExpiringCert, oldestFailedProvisioning, latestFlaggedUser] =
    await Promise.all([
      prisma.vpnUser.count(),
      prisma.vpnUser.count({ where: { certStatus: 'ACTIVE' } }),
      prisma.vpnUser.count({ where: { isFlagged: true } }),
      prisma.syncJob.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      }),
      prisma.vpnServer.count({ where: { isActive: true } }),
      prisma.accessRequest.count({ where: { status: { in: ['PENDING', 'FAILED'] } } }),
      prisma.vpnUser.count({ where: { certStatus: 'REVOKED' } }),
      prisma.vpnUser.count({ where: { certStatus: 'NONE' } }),
      prisma.vpnUser.count({
        where: {
          certStatus: 'ACTIVE',
          certExpiresAt: { lte: certWarningDate, not: null },
        },
      }),
      prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.vpnUser.count({ where: { isEnabled: false } }),
      prisma.accessRequest.count({ where: { status: 'FAILED' } }),
      prisma.accessRequest.count({
        where: {
          status: 'PENDING',
          createdAt: { lte: stalePendingCutoff },
        },
      }),
      prisma.accessRequest.count({
        where: {
          status: 'PROCESSING',
          updatedAt: { lte: staleProcessingCutoff },
        },
      }),
      prisma.vpnUser.findFirst({
        where: {
          certStatus: 'ACTIVE',
          certExpiresAt: { lte: certWarningDate, not: null },
        },
        orderBy: { certExpiresAt: 'asc' },
        select: {
          email: true,
          commonName: true,
          certExpiresAt: true,
          server: { select: { name: true } },
        },
      }),
      prisma.accessRequest.findFirst({
        where: { status: 'FAILED' },
        orderBy: { updatedAt: 'asc' },
        select: {
          email: true,
          updatedAt: true,
          server: { select: { name: true } },
        },
      }),
      prisma.vpnUser.findFirst({
        where: { isFlagged: true },
        orderBy: { flaggedAt: 'desc' },
        select: {
          email: true,
          commonName: true,
          flaggedAt: true,
          server: { select: { name: true } },
        },
      }),
    ])

  // Get active connections across all servers (admin only)
  let activeConnections = 0
  let totalBandwidthIn = 0
  let totalBandwidthOut = 0
  const serverConnections: Record<string, number> = {}
  const connectedUsers: { commonName: string; realAddress: string; vpnAddress: string; bytesIn: number; bytesOut: number; connectedSince: string; serverId: string; serverName: string }[] = []

  const isAdmin = (session.user as Record<string, unknown>).role === 'ADMIN'

  // Viewer-specific dashboard data
  if (!isAdmin) {
    const email = session.user.email as string

    const [approvedRequests, pendingRequestCount, certRecords, recentRequests] = await Promise.all([
      prisma.accessRequest.findMany({
        where: { email, status: 'APPROVED' },
        include: { server: { select: { id: true, name: true, hostname: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.accessRequest.count({ where: { email, status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } } }),
      prisma.vpnUser.findMany({
        where: { email },
        select: { certExpiresAt: true, certStatus: true, server: { select: { id: true, name: true } } },
      }),
      prisma.accessRequest.findMany({
        where: { email },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { server: { select: { id: true, name: true } } },
      }),
    ])

    const uniqueApprovedRequests = approvedRequests.filter((request, index, all) => {
      return index === all.findIndex((candidate) => candidate.serverId === request.serverId)
    })

    return NextResponse.json({
      role: 'VIEWER',
      certWarningDays: settings.certExpiryWarnDays,
      approvedServers: uniqueApprovedRequests.map((r) => ({
        id: r.server.id,
        name: r.server.name,
        hostname: r.server.hostname,
        approvedAt: r.reviewedAt ?? r.updatedAt,
      })),
      pendingRequestCount,
      certExpiry: certRecords.map((c) => ({
        serverName: c.server.name,
        serverId: c.server.id,
        certExpiresAt: c.certExpiresAt,
        certStatus: c.certStatus,
      })),
      recentRequests: recentRequests.map((r) => ({
        id: r.id,
        serverName: r.server.name,
        status: r.status,
        createdAt: r.createdAt,
        reviewNote: r.reviewNote,
      })),
    })
  }

  if (isAdmin) {
    const servers = await prisma.vpnServer.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })

    const connectionResults = await Promise.allSettled(
      servers.map(async (s) => {
        const conns = await parseStatusLog(s.id)
        return { serverId: s.id, serverName: s.name, connections: conns }
      })
    )

    for (const result of connectionResults) {
      if (result.status === 'fulfilled') {
        const { serverId, serverName, connections } = result.value
        activeConnections += connections.length
        serverConnections[serverId] = connections.length
        for (const conn of connections) {
          totalBandwidthIn += conn.bytesIn
          totalBandwidthOut += conn.bytesOut
          connectedUsers.push({
            ...conn,
            serverId,
            serverName,
          })
        }
      }
    }
  }

  // Activity history: count audit entries per day for last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const recentLogs = await prisma.auditLog.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // Bucket into days
  const activityByDay: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const count = recentLogs.filter((log) => {
      return log.createdAt.toISOString().slice(0, 10) === dateStr
    }).length
    activityByDay.push({ date: dateStr, count })
  }

  const alerts = buildDashboardAlerts({
    certWarningDays: settings.certExpiryWarnDays,
    expiringCertCount: expiringCerts,
    earliestExpiringCert: earliestExpiringCert
      ? {
          email: earliestExpiringCert.email,
          commonName: earliestExpiringCert.commonName,
          certExpiresAt: earliestExpiringCert.certExpiresAt,
          serverName: earliestExpiringCert.server.name,
        }
      : undefined,
    failedProvisioningCount,
    oldestFailedProvisioning: oldestFailedProvisioning
      ? {
          email: oldestFailedProvisioning.email,
          timestamp: oldestFailedProvisioning.updatedAt,
          serverName: oldestFailedProvisioning.server.name,
        }
      : undefined,
    flaggedUserCount: pendingFlags,
    latestFlaggedUser: latestFlaggedUser
      ? {
          email: latestFlaggedUser.email,
          commonName: latestFlaggedUser.commonName,
          timestamp: latestFlaggedUser.flaggedAt,
          serverName: latestFlaggedUser.server.name,
        }
      : undefined,
    disabledUserCount: disabledUsers,
    stalePendingRequestCount,
    staleProcessingRequestCount,
  })

  return NextResponse.json({
    role: 'ADMIN',
    totalUsers,
    activeCerts,
    pendingFlags,
    lastSync: lastSyncJob?.completedAt ?? null,
    serverCount,
    pendingRequests,
    activeConnections,
    totalBandwidthIn,
    totalBandwidthOut,
    serverConnections,
    connectedUsers,
    activityByDay,
    revokedCerts,
    noCerts,
    expiringCerts,
    todayAuditCount,
    disabledUsers,
    certWarningDays: settings.certExpiryWarnDays,
    alerts,
  })
})
