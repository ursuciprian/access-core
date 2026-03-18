export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApprovedUser } from '@/lib/rbac'

export const GET = requireApprovedUser()(async (_request, session) => {
  const email = session.user.email as string
  const adminUser = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true },
  })

  if (!adminUser) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const sessions = await prisma.loginHistory.findMany({
    where: { userId: adminUser.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      method: true,
      ip: true,
      userAgent: true,
      createdAt: true,
    },
  })

  return NextResponse.json(sessions)
})
