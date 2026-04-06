export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod/v4'
import { logAudit } from '@/lib/audit'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { generateCert, getCertExpiryDate, revokeCert } from '@/lib/cert-service'
import { enforceTrustedOriginForMutation } from '@/lib/request-security'

const certActionSchema = z.object({
  action: z.enum(['generate', 'revoke', 'regenerate']),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blockedByOriginPolicy = enforceTrustedOriginForMutation(request)
  if (blockedByOriginPolicy) {
    return blockedByOriginPolicy
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = certActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { prisma } = await import('@/lib/prisma')

  const user = await prisma.vpnUser.findUnique({
    where: { id },
    include: { server: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    if (parsed.data.action === 'generate') {
      if (user.certStatus === 'ACTIVE') {
        return NextResponse.json(
          { error: 'Certificate already exists. Use regenerate to replace it.' },
          { status: 409 }
        )
      }

      await generateCert(user.server, user.commonName)
      const certExpiresAt = await getCertExpiryDate(user.server, user.commonName)

      const updatedUser = await prisma.vpnUser.update({
        where: { id },
        data: {
          certStatus: 'ACTIVE',
          certCreatedAt: new Date(),
          certExpiresAt,
        },
      })

      await logAudit({
        action: 'CERT_GENERATED',
        actorEmail: session.user.email,
        targetType: 'USER',
        targetId: id,
        userId: id,
        details: { commonName: user.commonName },
      })

      return NextResponse.json(updatedUser)
    }

    if (parsed.data.action === 'revoke') {
      if (user.certStatus !== 'ACTIVE') {
        return NextResponse.json(
          { error: 'No active certificate to revoke' },
          { status: 400 }
        )
      }

      await revokeCert(user.server, user.commonName)

      const updatedUser = await prisma.vpnUser.update({
        where: { id },
        data: { certStatus: 'REVOKED' },
      })

      await logAudit({
        action: 'CERT_REVOKED',
        actorEmail: session.user.email,
        targetType: 'USER',
        targetId: id,
        userId: id,
        details: { commonName: user.commonName },
      })

      return NextResponse.json(updatedUser)
    }

    if (parsed.data.action === 'regenerate') {
      // Revoke existing cert if active
      if (user.certStatus === 'ACTIVE') {
        await revokeCert(user.server, user.commonName, { allowMissing: true })
      }

      await generateCert(user.server, user.commonName)
      const certExpiresAt = await getCertExpiryDate(user.server, user.commonName)

      const updatedUser = await prisma.vpnUser.update({
        where: { id },
        data: {
          certStatus: 'ACTIVE',
          certCreatedAt: new Date(),
          certExpiresAt,
        },
      })

      await logAudit({
        action: 'CERT_REGENERATED',
        actorEmail: session.user.email,
        targetType: 'USER',
        targetId: id,
        userId: id,
        details: { commonName: user.commonName },
      })

      return NextResponse.json(updatedUser)
    }
  } catch (error) {
    console.error('Certificate operation failed', { userId: id, action: parsed.data.action, error })
    return NextResponse.json(
      { error: 'Certificate operation failed' },
      { status: 500 }
    )
  }
}
