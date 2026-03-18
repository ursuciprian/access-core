export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod/v4'
import { logAudit } from '@/lib/audit'
import { getAuthMethodLabel } from '@/lib/auth-method'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') return null
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
}

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'VIEWER']).default('VIEWER'),
})

export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
}
