export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { requireApprovedUser } from '@/lib/rbac'
import { isTotpMfaEnabled } from '@/lib/features'
import {
  buildTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotpCode,
} from '@/lib/totp'

const schema = z.object({
  currentCode: z.string().trim().regex(/^\d{6}$/),
})

export const POST = requireApprovedUser()(async (request: NextRequest, session) => {
  if (!isTotpMfaEnabled()) {
    return NextResponse.json({ error: 'TOTP MFA is disabled in this environment' }, { status: 409 })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const email = session.user.email as string
  const adminUser = await prisma.adminUser.findUnique({ where: { email } })

  if (!adminUser) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!adminUser.mfaEnabled || !adminUser.mfaSecret) {
    return NextResponse.json({ error: 'Multi-factor authentication is not enabled' }, { status: 409 })
  }

  const currentSecret = decryptTotpSecret(adminUser.mfaSecret)
  if (!currentSecret || !verifyTotpCode(currentSecret, parsed.data.currentCode)) {
    return NextResponse.json({ error: 'Invalid current MFA code' }, { status: 400 })
  }

  const secret = generateTotpSecret()
  const otpauthUri = buildTotpUri(adminUser.email, 'AccessCore', secret)

  await prisma.adminUser.update({
    where: { id: adminUser.id },
    data: {
      mfaPendingSecret: encryptTotpSecret(secret),
    },
  })

  await logAudit({
    action: 'MFA_RECONFIGURE_STARTED',
    actorEmail: adminUser.email,
    targetType: 'ADMIN_USER',
    targetId: adminUser.id,
    details: { email: adminUser.email, method: 'TOTP' },
  })

  return NextResponse.json({
    secret,
    otpauthUri,
    issuer: 'AccessCore',
  })
})
