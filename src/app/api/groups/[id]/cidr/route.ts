export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod/v4'
import { validateCidr } from '@/lib/validation'
import { markUsersAffectedByGroupChangePending } from '@/lib/temporary-access'
import { enforceTrustedOriginForMutation } from '@/lib/request-security'

const addCidrSchema = z.object({
  cidr: z.string(),
  description: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blockedByOriginPolicy = enforceTrustedOriginForMutation(request)
  if (blockedByOriginPolicy) {
    return blockedByOriginPolicy
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = addCidrSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const cidrResult = validateCidr(parsed.data.cidr)
  if (!cidrResult.success) {
    return NextResponse.json({ error: `Invalid CIDR: ${parsed.data.cidr}` }, { status: 400 })
  }

  const { prisma } = await import('@/lib/prisma')

  const group = await prisma.vpnGroup.findUnique({ where: { id } })
  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  const cidrBlock = await prisma.cidrBlock.create({
    data: {
      cidr: parsed.data.cidr,
      description: parsed.data.description,
      groupId: id,
    },
  })

  await markUsersAffectedByGroupChangePending(id)

  return NextResponse.json(cidrBlock, { status: 201 })
}
