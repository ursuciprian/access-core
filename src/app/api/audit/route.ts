export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/rbac'

export const GET = requireAdmin()(async (request: NextRequest) => {
  const { prisma } = await import('@/lib/prisma')
  const { searchParams } = new URL(request.url)

  const action = searchParams.get('action')
  const actorEmail = searchParams.get('actorEmail') || searchParams.get('actor')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)))
  const skip = parseInt(searchParams.get('skip') ?? String((page - 1) * pageSize), 10)
  const take = Math.min(parseInt(searchParams.get('take') ?? String(pageSize), 10), 100)

  const where: Record<string, unknown> = {}
  if (action) where.action = { contains: action, mode: 'insensitive' }
  if (actorEmail) where.actorEmail = { contains: actorEmail, mode: 'insensitive' }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({ entries: logs, total, page, pageSize, skip, take })
})
