export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { logAudit } from '@/lib/audit'
import { getAuthMethodLabel } from '@/lib/auth-method'
import { requireAdmin } from '@/lib/rbac'
import { passwordSchema } from '@/lib/validation'

export const GET = requireAdmin()(async (_request: NextRequest) => {

  const { prisma } = await import('@/lib/prisma')

  const admins = await prisma.adminUser.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      isApproved: true,
      lastLoginAt: true,
      mfaEnabled: true,
      password: true,
      loginHistory: {
        select: { method: true },
        take: 20,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Map password to authMethod flag (don't expose hash)
  const mapped = admins.map(({ password, loginHistory, ...rest }) => ({
    ...rest,
    hasPassword: password !== null,
    authMethod: getAuthMethodLabel(password !== null, loginHistory.map((entry) => entry.method)),
  }))

  return NextResponse.json(mapped)
})

const createAdminSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  role: z.enum(['ADMIN', 'VIEWER']).default('VIEWER'),
})

export const POST = requireAdmin()(async (request: NextRequest, session) => {
  const body = await request.json()
  const parsed = createAdminSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { prisma } = await import('@/lib/prisma')
  const { hashSync } = await import('bcryptjs')

  const exists = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } })
  if (exists) {
    return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
  }

  const admin = await prisma.adminUser.create({
    data: {
      email: parsed.data.email,
      password: hashSync(parsed.data.password, 10),
      role: parsed.data.role,
      isApproved: true,
    },
    select: { id: true, email: true, role: true, createdAt: true },
  })

  await logAudit({
    action: 'ADMIN_USER_CREATED',
    actorEmail: session.user!.email!,
    targetType: 'ADMIN_USER',
    targetId: admin.id,
    details: { email: admin.email, role: admin.role },
  })

  return NextResponse.json(admin, { status: 201 })
})
