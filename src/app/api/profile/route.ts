export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthMethodLabel } from '@/lib/auth-method'
import { requireApprovedUser } from '@/lib/rbac'
import { isMfaOnboardingRequired, isTotpMfaEnabled } from '@/lib/features'

export const GET = requireApprovedUser()(async (_request, session) => {
  const email = session.user.email as string
  const adminUser = await prisma.adminUser.findUnique({
    where: { email },
    include: {
      loginHistory: {
        orderBy: { createdAt: 'desc' },
        select: { method: true },
        take: 20,
      },
    },
  })

  if (!adminUser) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const [approvedRequests, vpnUsers] = await Promise.all([
    prisma.accessRequest.findMany({
      where: {
        email: adminUser.email,
        status: 'APPROVED',
      },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            hostname: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.vpnUser.findMany({
      where: { email: adminUser.email },
      select: {
        serverId: true,
        certStatus: true,
        certExpiresAt: true,
        isEnabled: true,
      },
    }),
  ])

  const vpnUserByServer = new Map(vpnUsers.map((user) => [user.serverId, user]))
  const loginMethods = adminUser.loginHistory.map((entry: { method: string }) => entry.method)
  const uniqueApprovedRequests = approvedRequests.filter((request, index, all) => {
    return index === all.findIndex((candidate) => candidate.serverId === request.serverId)
  })

  return NextResponse.json({
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    createdAt: adminUser.createdAt,
    lastLoginAt: adminUser.lastLoginAt,
    mfaEnabled: adminUser.mfaEnabled,
    mfaEnabledAt: adminUser.mfaEnabledAt,
    mfaAvailable: isTotpMfaEnabled(),
    mfaRequired: isMfaOnboardingRequired(),
    authMethod: getAuthMethodLabel(adminUser.password !== null, loginMethods),
    hasPassword: adminUser.password !== null,
    access: uniqueApprovedRequests.map((request) => {
      const vpnUser = vpnUserByServer.get(request.serverId)

      return {
        id: request.id,
        approvedAt: request.reviewedAt ?? request.updatedAt,
        server: request.server,
        certStatus: vpnUser?.certStatus ?? 'NONE',
        certExpiresAt: vpnUser?.certExpiresAt ?? null,
        isEnabled: vpnUser?.isEnabled ?? false,
      }
    }),
  })
})
