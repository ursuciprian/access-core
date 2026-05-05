export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { requireApprovedUser } from '@/lib/rbac'
import { isTotpMfaEnabled } from '@/lib/features'
import { buildTotpUri, decryptTotpSecret, encryptTotpSecret, generateTotpSecret } from '@/lib/totp'

export const POST = requireApprovedUser()(async (_request, session) => {
  if (!isTotpMfaEnabled()) {
    return NextResponse.json({ error: 'TOTP MFA is disabled in this environment' }, { status: 409 })
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

  let secret = decryptTotpSecret(adminUser.mfaPendingSecret)

  if (!secret) {
    secret = generateTotpSecret()

    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: {
        mfaPendingSecret: encryptTotpSecret(secret),
      },
    })

    await logAudit({
      action: 'MFA_SETUP_STARTED',
      actorEmail: adminUser.email,
      targetType: 'ADMIN_USER',
      targetId: adminUser.id,
      details: { email: adminUser.email, method: 'TOTP' },
    })
  }

  const otpauthUri = buildTotpUri(adminUser.email, 'AccessCore', secret)

  return NextResponse.json({
    secret,
    otpauthUri,
    issuer: 'AccessCore',
  })
})
