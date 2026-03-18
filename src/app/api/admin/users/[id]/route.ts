export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod/v4'
import { logAudit } from '@/lib/audit'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') return null
  return session
}

const updateAdminSchema = z.object({
  role: z.enum(['ADMIN', 'VIEWER']).optional(),
  password: z.string().min(6).optional(),
  isApproved: z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = updateAdminSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { prisma } = await import('@/lib/prisma')

  const existing = await prisma.adminUser.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Admin user not found' }, { status: 404 })
  }

  const isSelf = existing.email === session.user!.email

  if (parsed.data.password && existing.password === null) {
    return NextResponse.json(
      { error: 'Password reset is only available for accounts that already use credentials' },
      { status: 409 }
    )
  }

  if (isSelf && parsed.data.password) {
    return NextResponse.json(
      { error: 'Use your profile page to change your own password' },
      { status: 409 }
    )
  }

  if (isSelf && (parsed.data.role !== undefined || parsed.data.isApproved !== undefined)) {
    return NextResponse.json(
      { error: 'You cannot change your own role or approval state from admin management' },
      { status: 409 }
    )
  }

  const data: Record<string, unknown> = {}
  if (parsed.data.role) data.role = parsed.data.role
  if (parsed.data.password) {
    const { hashSync } = await import('bcryptjs')
    data.password = hashSync(parsed.data.password, 10)
  }
  if (parsed.data.isApproved !== undefined) data.isApproved = parsed.data.isApproved

  const admin = await prisma.adminUser.update({
    where: { id },
    data,
    select: { id: true, email: true, role: true, createdAt: true, isApproved: true },
  })

  const isApprovalChange = parsed.data.isApproved === true && !existing.isApproved
  const isPasswordReset = Boolean(parsed.data.password)

  await logAudit({
    action: isApprovalChange
      ? 'ADMIN_USER_APPROVED'
      : isPasswordReset
        ? 'ADMIN_USER_PASSWORD_RESET'
        : 'ADMIN_USER_UPDATED',
    actorEmail: session.user!.email!,
    targetType: 'ADMIN_USER',
    targetId: id,
    details: { email: admin.email, changes: Object.keys(data) },
  })

  return NextResponse.json(admin)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { prisma } = await import('@/lib/prisma')

  const existing = await prisma.adminUser.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Admin user not found' }, { status: 404 })
  }

  // Prevent deleting yourself
  if (existing.email === session.user!.email) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  await prisma.adminUser.delete({ where: { id } })

  await logAudit({
    action: existing.isApproved ? 'ADMIN_USER_DELETED' : 'ADMIN_USER_REJECTED',
    actorEmail: session.user!.email!,
    targetType: 'ADMIN_USER',
    targetId: id,
    details: { email: existing.email, wasApproved: existing.isApproved },
  })

  return NextResponse.json({ success: true })
}
