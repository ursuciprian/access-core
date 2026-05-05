export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod/v4'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decryptTotpSecret } from '@/lib/totp'
import { logAudit } from '@/lib/audit'
import {
  canAttemptMfaVerify,
  recordFailedMfaAttempt,
  clearMfaRateLimit,
} from '@/lib/login-rate-limit'
import { applyMfaVerificationCookie } from '@/lib/auth-cookies'
import { enforceTrustedOriginForMutation } from '@/lib/request-security'
import { consumeTotpCode } from '@/lib/totp-verification'

const verifyMfaSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
})

export async function POST(request: NextRequest) {
  const blockedByOriginPolicy = enforceTrustedOriginForMutation(request)
  if (blockedByOriginPolicy) {
    return blockedByOriginPolicy
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = verifyMfaSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { email: session.user.email },
  })

  if (!adminUser) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!adminUser.mfaEnabled || !adminUser.mfaSecret) {
    return NextResponse.json({ error: 'Multi-factor authentication is not enabled' }, { status: 409 })
  }

  if (!(await canAttemptMfaVerify(adminUser.id))) {
    return NextResponse.json({ error: 'Too many verification attempts. Please try again later.' }, { status: 429 })
  }

  const secret = decryptTotpSecret(adminUser.mfaSecret)
  const verification = secret
    ? await consumeTotpCode(adminUser.id, secret, parsed.data.code)
    : { success: false as const, reason: 'invalid' as const }

  if (!verification.success) {
    await recordFailedMfaAttempt(adminUser.id)
    await logAudit({
      action: 'MFA_VERIFICATION_FAILED',
      actorEmail: adminUser.email,
      targetType: 'ADMIN_USER',
      targetId: adminUser.id,
      details: { email: adminUser.email, reason: verification.reason },
    })
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
  }

  await clearMfaRateLimit(adminUser.id)
  await logAudit({
    action: 'MFA_VERIFIED',
    actorEmail: adminUser.email,
    targetType: 'ADMIN_USER',
    targetId: adminUser.id,
    details: { email: adminUser.email },
  })

  const response = NextResponse.json({ success: true })
  await applyMfaVerificationCookie(response, session.user as Record<string, unknown>)
  return response
}
