export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { requireApprovedUser } from '@/lib/rbac'
import { decryptTotpSecret } from '@/lib/totp'
import { revokeUserAuthSessions } from '@/lib/auth-session'
import { clearAuthCookies } from '@/lib/auth-cookies'
import { consumeTotpCode } from '@/lib/totp-verification'

const disableMfaSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
})

export const POST = requireApprovedUser()(async (request: NextRequest, session) => {
  const userId = (session.user as Record<string, unknown>).id as string
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
  const verification = secret
    ? await consumeTotpCode(adminUser.id, secret, parsed.data.code)
    : { success: false as const, reason: 'invalid' as const }

  if (!verification.success) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
  }

  await prisma.adminUser.update({
    where: { id: adminUser.id },
    data: {
      mfaEnabled: false,
      mfaEnabledAt: null,
      mfaSecret: null,
      mfaPendingSecret: null,
      lastTotpStep: null,
      lastTotpSecretHash: null,
    } as any,
  })

  await logAudit({
    action: 'MFA_DISABLED',
    actorEmail: adminUser.email,
    targetType: 'ADMIN_USER',
    targetId: adminUser.id,
    details: { email: adminUser.email, method: 'TOTP' },
  })

  await revokeUserAuthSessions({
    userId,
    revokedBy: adminUser.email,
  })

  const response = NextResponse.json({ success: true, requiresReauth: true })
  clearAuthCookies(response)
  return response
})
