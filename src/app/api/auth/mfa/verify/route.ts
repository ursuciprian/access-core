export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod/v4'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decryptTotpSecret, verifyTotpCode } from '@/lib/totp'
import { logAudit } from '@/lib/audit'
import {
  canAttemptMfaVerify,
  recordFailedMfaAttempt,
  clearMfaRateLimit,
} from '@/lib/login-rate-limit'
import {
  createMfaVerificationCookieValue,
  MFA_VERIFICATION_COOKIE,
} from '@/lib/mfa-cookie'

const verifyMfaSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
})

export async function POST(request: NextRequest) {
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
  if (!secret || !verifyTotpCode(secret, parsed.data.code)) {
    await recordFailedMfaAttempt(adminUser.id)
    await logAudit({
      action: 'MFA_VERIFICATION_FAILED',
      actorEmail: adminUser.email,
      targetType: 'ADMIN_USER',
      targetId: adminUser.id,
      details: { email: adminUser.email },
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
  const userId = (session.user as Record<string, unknown>).id
  const authSessionId = (session.user as Record<string, unknown>).authSessionId
  const sessionExpiresAt = (session.user as Record<string, unknown>).sessionExpiresAt
  if (
    typeof userId === 'string' &&
    typeof authSessionId === 'string' &&
    typeof sessionExpiresAt === 'number'
  ) {
    response.cookies.set({
      name: MFA_VERIFICATION_COOKIE,
      value: await createMfaVerificationCookieValue(userId, authSessionId, sessionExpiresAt),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(sessionExpiresAt),
    })
  }

  return response
}
