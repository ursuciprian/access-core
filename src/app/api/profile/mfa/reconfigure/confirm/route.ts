export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { requireApprovedUser } from '@/lib/rbac'
import { decryptTotpSecret, verifyTotpCode } from '@/lib/totp'

const schema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
})

export const POST = requireApprovedUser()(async (request: NextRequest, session) => {
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const email = session.user.email as string
  const adminUser = await prisma.adminUser.findUnique({ where: { email } })

  if (!adminUser) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!adminUser.mfaEnabled) {
    return NextResponse.json({ error: 'Multi-factor authentication is not enabled' }, { status: 409 })
  }

  const pendingSecret = decryptTotpSecret(adminUser.mfaPendingSecret)
  if (!pendingSecret) {
    return NextResponse.json({ error: 'No MFA reconfiguration is pending' }, { status: 409 })
  }

  if (!verifyTotpCode(pendingSecret, parsed.data.code)) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
  }

  await prisma.adminUser.update({
    where: { id: adminUser.id },
    data: {
      mfaSecret: adminUser.mfaPendingSecret,
      mfaPendingSecret: null,
      mfaEnabled: true,
      mfaEnabledAt: new Date(),
    },
  })

  await logAudit({
    action: 'MFA_RECONFIGURED',
    actorEmail: adminUser.email,
    targetType: 'ADMIN_USER',
    targetId: adminUser.id,
    details: { email: adminUser.email, method: 'TOTP' },
  })

  return NextResponse.json({ success: true })
})
