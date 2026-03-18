export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/rbac'

export const GET = requireAdmin()(async (request: NextRequest) => {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ users: [], servers: [], groups: [] })
  }

  const [users, servers, groups] = await Promise.all([
    prisma.vpnUser.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { commonName: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, email: true, commonName: true, displayName: true, serverId: true },
      take: 5,
    }),
    prisma.vpnServer.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { hostname: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, hostname: true },
      take: 5,
    }),
    prisma.vpnGroup.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, description: true },
      take: 5,
    }),
  ])

  return NextResponse.json({ users, servers, groups })
})
