export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod/v4'
import { runGoogleSync } from '@/lib/sync-engine'
import { logAudit } from '@/lib/audit'
import { getEffectiveSystemSettings } from '@/lib/system-settings'

const triggerSyncSchema = z.object({
  serverId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = triggerSyncSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const settings = await getEffectiveSystemSettings()
  if (!settings.googleSyncEnabled) {
    return NextResponse.json({ error: 'Google sync is disabled in admin settings' }, { status: 409 })
  }

  const { prisma } = await import('@/lib/prisma')
  const server = await prisma.vpnServer.findUnique({ where: { id: parsed.data.serverId } })
  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 })
  }

  await logAudit({
    action: 'SYNC_STARTED',
    actorEmail: session.user.email,
    targetType: 'SERVER',
    targetId: parsed.data.serverId,
    details: { type: 'GOOGLE_SYNC' },
  })

  try {
    const result = await runGoogleSync(parsed.data.serverId, session.user.email)

    await logAudit({
      action: 'SYNC_COMPLETED',
      actorEmail: session.user.email,
      targetType: 'SERVER',
      targetId: parsed.data.serverId,
      details: {
        syncJobId: result.syncJobId,
        usersAdded: result.usersAdded,
        usersFlagged: result.usersFlagged,
        mappingsProcessed: result.mappingsProcessed,
        errors: result.errors,
      },
    })

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Sync failed', details: errorMessage }, { status: 500 })
  }
}
