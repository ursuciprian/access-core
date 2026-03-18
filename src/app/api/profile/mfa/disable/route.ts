export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { requireApprovedUser } from '@/lib/rbac'
import { decryptTotpSecret, verifyTotpCode } from '@/lib/totp'

const disableMfaSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
})

export const POST = requireApprovedUser()(async (request: NextRequest, session) => {
  const parsed = disableMfaSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const email = session.user.email as string
  const adminUser = await prisma.adminUser.findUnique({
    where: { email },
  })

  if (!adminUser) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!adminUser.mfaEnabled || !adminUser.mfaSecret) {
    return NextResponse.json({ error: 'Multi-factor authentication is not enabled' }, { status: 409 })
  }

  const secret = decryptTotpSecret(adminUser.mfaSecret)
  if (!secret || !verifyTotpCode(secret, parsed.data.code)) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
  }

  await prisma.adminUser.update({
    where: { id: adminUser.id },
    data: {
      mfaEnabled: false,
      mfaEnabledAt: null,
      mfaSecret: null,
      mfaPendingSecret: null,
    },
  })

  await logAudit({
    action: 'MFA_DISABLED',
    actorEmail: adminUser.email,
    targetType: 'ADMIN_USER',
    targetId: adminUser.id,
    details: { email: adminUser.email, method: 'TOTP' },
  })

  return NextResponse.json({ success: true })
})
