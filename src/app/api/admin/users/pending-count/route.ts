import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

// GET /api/admin/users/pending-count — count unapproved portal users (admin only)
export const GET = requireAdmin()(async (_request: NextRequest) => {
  const { prisma } = await import('@/lib/prisma')

  const count = await prisma.adminUser.count({
    where: { isApproved: false },
  })

  return NextResponse.json({ count })
})
