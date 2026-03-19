export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { runGoogleSync } from '@/lib/sync-engine'
import { logAudit } from '@/lib/audit'
import { getEffectiveSystemSettings } from '@/lib/system-settings'
import { requireAdmin } from '@/lib/rbac'

const triggerSyncSchema = z.object({
  serverId: z.string().min(1),
})

export const POST = requireAdmin()(async (request: NextRequest, session) => {
  const actorEmail = session.user.email as string
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
    actorEmail,
    targetType: 'SERVER',
    targetId: parsed.data.serverId,
    details: { type: 'GOOGLE_SYNC' },
  })

  try {
    const result = await runGoogleSync(parsed.data.serverId, actorEmail)

    await logAudit({
      action: 'SYNC_COMPLETED',
      actorEmail,
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
})
