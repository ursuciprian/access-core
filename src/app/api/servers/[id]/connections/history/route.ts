export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/rbac'

export const GET = requireAdmin()(async (
  request: NextRequest,
  _session,
  context
) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const url = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(url.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.get('limit') || '50')))
  const search = url.get('search')?.trim()

  const where = {
    serverId: id,
    ...(search ? { commonName: { contains: search, mode: 'insensitive' as const } } : {}),
  }

  const [connections, total] = await Promise.all([
    prisma.vpnConnection.findMany({
      where,
      orderBy: { connectedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.vpnConnection.count({ where }),
  ])

  // Serialize BigInt values
  const serialized = connections.map(c => ({
    ...c,
    bytesIn: c.bytesIn.toString(),
    bytesOut: c.bytesOut.toString(),
  }))

  return NextResponse.json({
    connections: serialized,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
})
