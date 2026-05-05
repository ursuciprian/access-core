export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/rbac'
import { getEffectiveSystemSettings } from '@/lib/system-settings'

export const GET = requireAdmin()(async () => {
  const { prisma } = await import('@/lib/prisma')
  const settings = await getEffectiveSystemSettings()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + settings.certExpiryWarnDays)

  const users = await prisma.vpnUser.findMany({
    where: {
      certStatus: 'ACTIVE',
      certExpiresAt: { lte: cutoff, not: null },
    },
    orderBy: { certExpiresAt: 'asc' },
    take: 100,
    select: {
      id: true,
      email: true,
      commonName: true,
      certCreatedAt: true,
      certExpiresAt: true,
      isEnabled: true,
      server: {
        select: {
          id: true,
          name: true,
          hostname: true,
          clientCertValidityDays: true,
        },
      },
    },
  })

  return NextResponse.json({
    warningDays: settings.certExpiryWarnDays,
    count: users.length,
    users,
  })
})
