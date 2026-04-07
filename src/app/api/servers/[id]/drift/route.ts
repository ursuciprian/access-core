export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { detectDrift, reconcileDrift } from '@/lib/drift-detection'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { enforceTrustedOriginForMutation } from '@/lib/request-security'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const { id } = await params

  try {
    const result = await detectDrift(id)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Failed to detect drift', { serverId: id, error: err })
    return NextResponse.json({ error: 'Failed to detect drift' }, { status: 500 })
  }
}

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
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const { id } = await params

  try {
    await reconcileDrift(id, session.user.email)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Failed to reconcile drift', { serverId: id, actorEmail: session.user.email, error: err })
    return NextResponse.json({ error: 'Failed to reconcile drift' }, { status: 500 })
  }
}
