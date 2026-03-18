export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/rbac'

export const POST = requireAdmin()(async (_request, session, context) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')

  const adminUser = await prisma.adminUser.findUnique({
    where: { id },
    select: { id: true, email: true, mfaEnabled: true },
  })

  if (!adminUser) {
    return NextResponse.json({ error: 'Admin user not found' }, { status: 404 })
  }

  await prisma.adminUser.update({
    where: { id },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaPendingSecret: null,
      mfaEnabledAt: null,
    },
  })

  await logAudit({
    action: 'ADMIN_USER_MFA_RESET',
    actorEmail: session.user.email as string,
    targetType: 'ADMIN_USER',
    targetId: adminUser.id,
    details: { email: adminUser.email, previousState: adminUser.mfaEnabled ? 'enabled' : 'not_enabled' },
  })

  return NextResponse.json({ success: true })
})
