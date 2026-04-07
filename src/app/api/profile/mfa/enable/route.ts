export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { requireApprovedUser } from '@/lib/rbac'
import { decryptTotpSecret } from '@/lib/totp'
import { consumeTotpCode } from '@/lib/totp-verification'

const enableMfaSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
})

export const POST = requireApprovedUser()(async (request: NextRequest, session) => {
  const parsed = enableMfaSchema.safeParse(await request.json())
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

  if (adminUser.mfaEnabled) {
    return NextResponse.json({ error: 'Multi-factor authentication is already enabled' }, { status: 409 })
  }

  const pendingSecret = decryptTotpSecret(adminUser.mfaPendingSecret)
  if (!pendingSecret) {
    return NextResponse.json({ error: 'No MFA enrollment is pending' }, { status: 409 })
  }

  const verification = await consumeTotpCode(adminUser.id, pendingSecret, parsed.data.code)
  if (!verification.success) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
  }

  await prisma.adminUser.update({
    where: { id: adminUser.id },
    data: {
      mfaEnabled: true,
      mfaEnabledAt: new Date(),
      mfaSecret: adminUser.mfaPendingSecret,
      mfaPendingSecret: null,
    },
  })

  await logAudit({
    action: 'MFA_ENABLED',
    actorEmail: adminUser.email,
    targetType: 'ADMIN_USER',
    targetId: adminUser.id,
    details: { email: adminUser.email, method: 'TOTP' },
  })

  return NextResponse.json({ success: true })
})
