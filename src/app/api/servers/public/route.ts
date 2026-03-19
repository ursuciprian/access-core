import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

// GET /api/servers/public — authenticated list of active servers for access requests
export const GET = requireAuth()(async (_request: NextRequest) => {
  const { prisma } = await import('@/lib/prisma')

  const servers = await prisma.vpnServer.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(servers)
})
