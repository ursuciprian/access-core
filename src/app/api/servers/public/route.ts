import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/servers/public — public list of active servers (name + hostname only)
// Used by the request-access page for unauthenticated or viewer users
export async function GET() {
  const { prisma } = await import('@/lib/prisma')

  const servers = await prisma.vpnServer.findMany({
    where: { isActive: true },
    select: { id: true, name: true, hostname: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(servers)
}
