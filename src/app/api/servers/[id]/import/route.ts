export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { discoverExistingUsers, importUsers } from '@/lib/import-service'
import type { ImportUserInput } from '@/lib/import-service'
import { requireAdmin } from '@/lib/rbac'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'

const importUserSchema = z.object({
  commonName: z.string().min(1).max(64),
  email: z.string().email(),
  groupIds: z.array(z.string()),
})

const importBodySchema = z.object({
  users: z.array(importUserSchema),
})

export const GET = requireAdmin()(async (
  _request: NextRequest,
  _session,
  context
) => {
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const { id } = await (context as { params: Promise<{ id: string }> }).params

  try {
    const discovered = await discoverExistingUsers(id)
    return NextResponse.json(discovered)
  } catch (err) {
    console.error('Failed to discover importable users', err)
    return NextResponse.json({ error: 'Failed to load importable users' }, { status: 500 })
  }
})

export const POST = requireAdmin()(async (
  request: NextRequest,
  session,
  context
) => {
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const actorEmail = session.user.email as string
  const body = await request.json()
  const parsed = importBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  try {
    const summary = await importUsers(id, parsed.data.users as ImportUserInput[], actorEmail)
    return NextResponse.json(summary)
  } catch (err) {
    console.error('Failed to import existing users', err)
    return NextResponse.json({ error: 'Failed to import users' }, { status: 500 })
  }
})
