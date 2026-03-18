export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { prisma } = await import('@/lib/prisma')

  const users = await prisma.vpnUser.findMany({
    where: { isFlagged: true },
    select: {
      id: true,
      email: true,
      commonName: true,
      flagReason: true,
      flaggedAt: true,
      server: { select: { id: true, name: true } },
    },
    orderBy: { flaggedAt: 'desc' },
  })

  return NextResponse.json(users)
}
