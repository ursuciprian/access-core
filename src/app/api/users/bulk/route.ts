export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { generateCcdForUser, buildCcdWriteCommand } from '@/lib/ccd-generator'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { getTransport } from '@/lib/transport'
import { generateCert, getCertExpiryDate } from '@/lib/cert-service'
import { requireAdmin } from '@/lib/rbac'

const bulkActionSchema = z.object({
  action: z.enum(['push-ccd', 'generate-cert', 'add-to-group']),
  userIds: z.array(z.string().trim().min(1)).min(1).max(100),
  groupId: z.string().trim().min(1).optional(),
}).superRefine((value, ctx) => {
  if (value.action === 'add-to-group' && !value.groupId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['groupId'],
      message: 'groupId is required for add-to-group action',
    })
  }
})

export const POST = requireAdmin()(async (request: NextRequest) => {
  const parsed = bulkActionSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const action = parsed.data.action
  const userIds = [...new Set(parsed.data.userIds)]
  const groupId = parsed.data.groupId

  if (!isServerManagementEnabled() && (action === 'push-ccd' || action === 'generate-cert')) {
    return NextResponse.json(
      { error: SERVER_MANAGEMENT_DISABLED_MESSAGE },
      { status: 409 }
    )
  }

  const { prisma } = await import('@/lib/prisma')

  let success = 0
  let failed = 0
  const errors: Array<{ userId: string; error: string }> = []

  if (action === 'push-ccd') {
    for (const userId of userIds) {
      try {
        const user = await prisma.vpnUser.findUnique({
          where: { id: userId },
          include: { server: true },
        })
        if (!user) {
          throw new Error('User not found')
        }

        const ccdContent = await generateCcdForUser(userId)
        const command = buildCcdWriteCommand(
          user.server.ccdPath,
          user.commonName,
          ccdContent
        )
        const transport = getTransport(user.server)
        await transport.executeCommand(command)

        await prisma.vpnUser.update({
          where: { id: userId },
          data: { ccdSyncStatus: 'SUCCESS', lastCcdPush: new Date() },
        })

        success++
      } catch (error) {
        failed++
        errors.push({ userId, error: String(error) })

        await prisma.vpnUser.update({
          where: { id: userId },
          data: { ccdSyncStatus: 'FAILED' },
        }).catch(() => {})
      }
    }
  } else if (action === 'generate-cert') {
    for (const userId of userIds) {
      try {
        const user = await prisma.vpnUser.findUnique({
          where: { id: userId },
          include: { server: true },
        })
        if (!user) {
          throw new Error('User not found')
        }

        await generateCert(user.server, user.commonName)
        const certExpiresAt = await getCertExpiryDate(user.server, user.commonName)

        await prisma.vpnUser.update({
          where: { id: userId },
          data: { certStatus: 'ACTIVE', certCreatedAt: new Date(), certExpiresAt },
        })

        success++
      } catch (error) {
        failed++
        errors.push({ userId, error: String(error) })
      }
    }
  } else if (action === 'add-to-group') {
    for (const userId of userIds) {
      try {
        await prisma.vpnUserGroup.create({
          data: {
            userId,
            groupId: groupId!,
            source: 'MANUAL',
          },
        })
        success++
      } catch (error) {
        failed++
        errors.push({ userId, error: String(error) })
      }
    }
  }

  return NextResponse.json({ success, failed, errors })
})
