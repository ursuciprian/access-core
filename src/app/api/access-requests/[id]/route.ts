import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { generateCert, getCertExpiryDate, revokeCert } from '@/lib/cert-service'
import { deriveCommonName, validateCommonName } from '@/lib/validation'
import { requireAdmin } from '@/lib/rbac'
import { enforceTrustedOriginForMutation } from '@/lib/request-security'

function sanitizeCommonName(email: string) {
  const candidate = deriveCommonName(email)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 64)

  return candidate.length > 0 ? candidate : 'user'
}

async function buildUniqueCommonName(prisma: any, serverId: string, email: string) {
  const base = sanitizeCommonName(email)

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const nextCandidate =
      suffix === 0
        ? base
        : `${base.slice(0, Math.max(1, 64 - String(suffix + 1).length - 1))}-${suffix + 1}`

    if (!validateCommonName(nextCandidate).success) {
      continue
    }

    const existing = await prisma.vpnUser.findFirst({
      where: { serverId, commonName: nextCandidate },
      select: { id: true },
    })
    if (!existing) {
      return nextCandidate
    }
  }

  throw new Error('Unable to derive a unique common name')
}

export const dynamic = 'force-dynamic'

// PATCH /api/access-requests/[id] — approve or reject (admin only)
export const PATCH = requireAdmin()(async (
  req: NextRequest,
  session,
  context
) => {
  const { prisma } = await import('@/lib/prisma')
  const actorEmail = session.user.email as string
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const body = await req.json()
  const { action, reviewNote } = body as { action: 'approve' | 'reject'; reviewNote?: string }

  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const request = await prisma.accessRequest.findUnique({ where: { id } })
  if (!request) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (request.status === 'PROCESSING') {
    return NextResponse.json({ error: 'Request is already being provisioned' }, { status: 409 })
  }
  if (!['PENDING', 'FAILED'].includes(request.status)) {
    return NextResponse.json({ error: 'Request already reviewed' }, { status: 409 })
  }

  if (action === 'reject') {
    const rejected = await prisma.accessRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: actorEmail,
        reviewedAt: new Date(),
        reviewNote: reviewNote || undefined,
      },
      include: { server: { select: { id: true, name: true } } },
    })

    await logAudit({
      action: 'ACCESS_REQUEST_REJECTED',
      actorEmail,
      targetType: 'ACCESS_REQUEST',
      targetId: request.id,
      details: { email: request.email, reviewNote },
    })

    return NextResponse.json(rejected)
  }

  await prisma.accessRequest.update({
    where: { id },
    data: {
      status: 'PROCESSING',
      reviewNote: reviewNote || undefined,
    },
  })

  await logAudit({
    action: 'ACCESS_REQUEST_PROVISIONING_STARTED',
    actorEmail,
    targetType: 'ACCESS_REQUEST',
    targetId: request.id,
    details: { email: request.email, reviewNote },
  })

  let vpnUser = await prisma.vpnUser.findFirst({
    where: { email: request.email, serverId: request.serverId },
    include: { server: true },
  })

  let createdUserId: string | null = null
  let generatedFreshCert = false

  try {
    if (!vpnUser) {
      const commonName = await buildUniqueCommonName(prisma, request.serverId, request.email)
      vpnUser = await prisma.vpnUser.create({
        data: {
          email: request.email,
          commonName,
          displayName: request.name || undefined,
          serverId: request.serverId,
          isEnabled: false,
        },
        include: { server: true },
      })
      createdUserId = vpnUser.id

      await logAudit({
        action: 'USER_CREATED',
        actorEmail,
        targetType: 'USER',
        targetId: vpnUser.id,
        userId: vpnUser.id,
        details: { source: 'access_request', requestId: request.id },
      })
    }

    if (!vpnUser) {
      throw new Error('Failed to create or load VPN user during provisioning')
    }

    const provisionedUser = vpnUser

    if (request.groupIds.length > 0) {
      await prisma.vpnUserGroup.createMany({
        data: request.groupIds.map((groupId: string) => ({
          userId: provisionedUser.id,
          groupId,
          source: 'MANUAL' as const,
        })),
        skipDuplicates: true,
      })
    }

    const needsNewCert = provisionedUser.certStatus !== 'ACTIVE'
    let certExpiresAt = provisionedUser.certExpiresAt ?? null
    if (needsNewCert) {
      await generateCert(provisionedUser.server, provisionedUser.commonName)
      certExpiresAt = await getCertExpiryDate(provisionedUser.server, provisionedUser.commonName)
      generatedFreshCert = true
    }

    const [updatedRequest] = await prisma.$transaction([
      prisma.accessRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: actorEmail,
          reviewedAt: new Date(),
          reviewNote: reviewNote || undefined,
        },
        include: { server: { select: { id: true, name: true } } },
      }),
      prisma.vpnUser.update({
        where: { id: provisionedUser.id },
        data: {
          isEnabled: true,
          certStatus: 'ACTIVE',
          certCreatedAt: needsNewCert ? new Date() : provisionedUser.certCreatedAt ?? new Date(),
          certExpiresAt,
        },
      }),
      prisma.adminUser.updateMany({
        where: { email: request.email, isApproved: false },
        data: { isApproved: true },
      }),
    ])

    if (needsNewCert) {
      await logAudit({
        action: 'CERT_GENERATED',
        actorEmail,
        targetType: 'USER',
        targetId: provisionedUser.id,
        userId: provisionedUser.id,
        details: { commonName: provisionedUser.commonName, requestId: request.id },
      })
    }

    await logAudit({
      action: 'ACCESS_REQUEST_APPROVED',
      actorEmail,
      targetType: 'ACCESS_REQUEST',
      targetId: request.id,
      details: { email: request.email, reviewNote, provisioned: true },
    })

    return NextResponse.json(updatedRequest)
  } catch (error) {
    console.error('Access request provisioning failed', { requestId: request.id, error })

    if (generatedFreshCert && vpnUser) {
      try {
        await revokeCert(vpnUser.server, vpnUser.commonName)
      } catch (cleanupError) {
        console.error('Failed to revoke certificate after provisioning error', {
          requestId: request.id,
          userId: vpnUser.id,
          cleanupError,
        })
      }
    }

    await prisma.accessRequest.update({
      where: { id },
      data: {
        status: 'FAILED',
        reviewedBy: actorEmail,
        reviewedAt: new Date(),
        reviewNote:
          reviewNote || 'Provisioning failed. An administrator can retry this request.',
      },
    })

    if (vpnUser && vpnUser.certStatus !== 'ACTIVE') {
      await prisma.vpnUser.update({
        where: { id: vpnUser.id },
        data: { isEnabled: false },
      })
    }

    await logAudit({
      action: 'ACCESS_REQUEST_PROVISIONING_FAILED',
      actorEmail,
      targetType: 'ACCESS_REQUEST',
      targetId: request.id,
      userId: createdUserId ?? vpnUser?.id,
      details: {
        email: request.email,
        reason: 'certificate_provisioning_failed',
      },
    })

    return NextResponse.json(
      { error: 'Access provisioning failed. The request has been left in a retryable state.' },
      { status: 502 }
    )
  }
})

// DELETE /api/access-requests/[id] — cancel own pending request
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { prisma } = await import('@/lib/prisma')
  const blockedByOriginPolicy = enforceTrustedOriginForMutation(req)
  if (blockedByOriginPolicy) {
    return blockedByOriginPolicy
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const request = await prisma.accessRequest.findUnique({ where: { id } })
  if (!request) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Only allow canceling own pending requests
  if (request.email !== session.user.email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (request.status !== 'PENDING') {
    return NextResponse.json({ error: 'Only pending requests can be canceled' }, { status: 409 })
  }

  await prisma.accessRequest.delete({ where: { id } })

  await logAudit({
    action: 'ACCESS_REQUEST_CANCELED',
    actorEmail: session.user.email,
    targetType: 'ACCESS_REQUEST',
    targetId: id,
    details: { serverId: request.serverId },
  })

  return NextResponse.json({ ok: true })
}
