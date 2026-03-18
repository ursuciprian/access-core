export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getQueueStatus } from '@/lib/operation-queue'
import { requireAdmin } from '@/lib/rbac'

export const GET = requireAdmin()(async (
  _request: NextRequest,
  _session,
  context
) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')

  const server = await prisma.vpnServer.findUnique({ where: { id } })
  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 })
  }

  const status = await getQueueStatus(id)

  return NextResponse.json(status)
})
