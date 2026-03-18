export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await params
  const { prisma } = await import('@/lib/prisma')

  const user = await prisma.vpnUser.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await prisma.vpnUser.update({
    where: { id: userId },
    data: { isFlagged: false, flagReason: null, flaggedAt: null },
  })

  await logAudit({
    action: 'FLAG_RESOLVED',
    actorEmail: session.user.email,
    targetType: 'USER',
    targetId: userId,
    details: { email: user.email, previousReason: user.flagReason },
  })

  return NextResponse.json({ success: true })
}
