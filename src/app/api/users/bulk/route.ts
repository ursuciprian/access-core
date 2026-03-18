export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateCcdForUser, buildCcdWriteCommand } from '@/lib/ccd-generator'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { getTransport } from '@/lib/transport'
import { generateCert } from '@/lib/cert-service'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { action, userIds, groupId } = body as {
    action: string
    userIds: string[]
    groupId?: string
  }

  if (!action || !Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json(
      { error: 'Invalid request: action and userIds are required' },
      { status: 400 }
    )
  }

  if (!['push-ccd', 'generate-cert', 'add-to-group'].includes(action)) {
    return NextResponse.json(
      { error: 'Invalid action. Must be push-ccd, generate-cert, or add-to-group' },
      { status: 400 }
    )
  }

  if (action === 'add-to-group' && !groupId) {
    return NextResponse.json(
      { error: 'groupId is required for add-to-group action' },
      { status: 400 }
    )
  }

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

        await prisma.vpnUser.update({
          where: { id: userId },
          data: { certStatus: 'ACTIVE', certCreatedAt: new Date() },
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
}
