import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/access-requests/pending-count — count pending requests (admin only)
export async function GET() {
  const { prisma } = await import('@/lib/prisma')
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ count: 0 })
  }

  const role = (session.user as Record<string, unknown>).role as string
  if (role !== 'ADMIN') {
    return NextResponse.json({ count: 0 })
  }

  const count = await prisma.accessRequest.count({
    where: { status: { in: ['PENDING', 'FAILED'] } },
  })

  return NextResponse.json({ count })
}
