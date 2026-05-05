export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { AccessRequestStatus, SyncStatus } from '@prisma/client'
import { requireAdmin } from '@/lib/rbac'
import { getEffectiveSystemSettings } from '@/lib/system-settings'
import { buildSecurityNotifications } from '@/lib/security-notifications'
import { logAudit } from '@/lib/audit'

export const GET = requireAdmin()(async () => {
  const { prisma } = await import('@/lib/prisma')
  const settings = await getEffectiveSystemSettings()
  const certWarningDate = new Date()
  certWarningDate.setDate(certWarningDate.getDate() + settings.certExpiryWarnDays)

  const dnsFailureWindow = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    pendingPortalUsers,
    pendingVpnRequests,
    failedProvisioning,
    failedSyncJobs,
    expiringCertificates,
    flaggedUsers,
    recentDnsFailureAudits,
  ] = await Promise.all([
    prisma.adminUser.count({ where: { isApproved: false } }),
    prisma.accessRequest.count({ where: { status: AccessRequestStatus.PENDING } }),
    prisma.accessRequest.count({ where: { status: AccessRequestStatus.FAILED } }),
    prisma.syncJob.count({ where: { status: SyncStatus.FAILED } }),
    prisma.vpnUser.count({
      where: {
        certStatus: 'ACTIVE',
        certExpiresAt: { lte: certWarningDate, not: null },
      },
    }),
    prisma.vpnUser.count({ where: { isFlagged: true } }),
    prisma.auditLog.findMany({
      where: {
        action: 'DNS_HEALTH_CHECKED',
        createdAt: { gte: dnsFailureWindow },
      },
      select: { details: true },
      take: 50,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const recentDnsFailures = recentDnsFailureAudits.reduce((sum, audit) => {
    const details = audit.details as Record<string, unknown> | null
    const failedCount = typeof details?.failedCount === 'number' ? details.failedCount : 0
    return sum + failedCount
  }, 0)

  const notifications = buildSecurityNotifications({
    pendingPortalUsers,
    pendingVpnRequests,
    failedProvisioning,
    failedSyncJobs,
    expiringCertificates,
    flaggedUsers,
    recentDnsFailures,
  })

  return NextResponse.json({
    count: notifications.reduce((sum, item) => sum + item.count, 0),
    notifications,
  })
})

export const POST = requireAdmin()(async (
  request: NextRequest,
  session
) => {
  const body = await request.json().catch(() => ({})) as { action?: string }
  if (body.action !== 'viewed') {
    return NextResponse.json({ error: 'Unsupported notification action' }, { status: 400 })
  }

  await logAudit({
    action: 'NOTIFICATIONS_VIEWED',
    actorEmail: session.user.email as string,
    targetType: 'ADMIN_USER',
    targetId: session.user.email as string,
    details: { viewedAt: new Date().toISOString() },
  })

  return NextResponse.json({ success: true })
})
