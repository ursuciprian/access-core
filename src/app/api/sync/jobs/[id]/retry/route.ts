export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserRole, SyncStatus } from '@prisma/client'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as Record<string, unknown>).role !== UserRole.ADMIN) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  const { id } = await params
  const { prisma } = await import('@/lib/prisma')

  const originalJob = await prisma.syncJob.findUnique({ where: { id } })
  if (!originalJob) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }
  if (originalJob.status !== SyncStatus.FAILED) {
    return NextResponse.json(
      { error: 'Only FAILED jobs can be retried' },
      { status: 400 }
    )
  }

  const newJob = await prisma.syncJob.create({
    data: {
      type: originalJob.type,
      status: SyncStatus.PENDING,
      serverId: originalJob.serverId,
      triggeredBy: session.user.email,
      details: { retriedFrom: originalJob.id },
    },
  })

  return NextResponse.json(newJob, { status: 201 })
}
