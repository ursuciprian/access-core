export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { markUsersAffectedByGroupChangePending } from '@/lib/temporary-access'
import { enforceTrustedOriginForMutation } from '@/lib/request-security'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cidrId: string }> }
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

  const { id, cidrId } = await params
  const { prisma } = await import('@/lib/prisma')

  const cidrBlock = await prisma.cidrBlock.findFirst({
    where: { id: cidrId, groupId: id },
  })
  if (!cidrBlock) {
    return NextResponse.json({ error: 'CIDR block not found' }, { status: 404 })
  }

  await prisma.cidrBlock.delete({ where: { id: cidrId } })
  await markUsersAffectedByGroupChangePending(id)

  return NextResponse.json({ success: true })
}
