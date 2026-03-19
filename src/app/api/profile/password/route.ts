export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { compare, hash } from 'bcryptjs'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { requireApprovedUser } from '@/lib/rbac'
import { passwordSchema } from '@/lib/validation'
import { revokeUserAuthSessions } from '@/lib/auth-session'
import { clearAuthCookies } from '@/lib/auth-cookies'

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})

export const PUT = requireApprovedUser()(async (request: NextRequest, session) => {
  const email = session.user.email as string
  const userId = (session.user as Record<string, unknown>).id as string
  const body = await request.json()
  const parsed = updatePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { email },
  })

  if (!adminUser) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!adminUser.password) {
    return NextResponse.json({ error: 'Password changes are only available for credentials users' }, { status: 400 })
  }

  const isValidPassword = await compare(parsed.data.currentPassword, adminUser.password)
  if (!isValidPassword) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  const hashedPassword = await hash(parsed.data.newPassword, 10)
  await prisma.adminUser.update({
    where: { id: adminUser.id },
    data: { password: hashedPassword },
  })

  await logAudit({
    action: 'PASSWORD_CHANGED',
    actorEmail: adminUser.email,
    targetType: 'ADMIN_USER',
    targetId: adminUser.id,
    details: { email: adminUser.email },
  })

  await revokeUserAuthSessions({
    userId,
    revokedBy: adminUser.email,
  })

  const response = NextResponse.json({ success: true, requiresReauth: true })
  clearAuthCookies(response)
  return response
})
