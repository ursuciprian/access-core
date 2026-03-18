export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { SyncType, SyncStatus } from '@prisma/client'
import { requireAdmin } from '@/lib/rbac'

export const GET = requireAdmin()(async (request: NextRequest) => {
  const { prisma } = await import('@/lib/prisma')
  const { searchParams } = new URL(request.url)

  const serverId = searchParams.get('serverId')
  const typeParam = searchParams.get('type')
  const statusParam = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0)

  const where: Record<string, unknown> = {}
  if (serverId) where.serverId = serverId
  if (typeParam && Object.values(SyncType).includes(typeParam as SyncType)) {
    where.type = typeParam as SyncType
  }
  if (statusParam && Object.values(SyncStatus).includes(statusParam as SyncStatus)) {
    where.status = statusParam as SyncStatus
  }

  const [jobs, total] = await Promise.all([
    prisma.syncJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.syncJob.count({ where }),
  ])

  return NextResponse.json({ jobs, total, limit, offset })
})
