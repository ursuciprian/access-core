export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { parseStatusLog } from '@/lib/connections'
import { requireAdmin } from '@/lib/rbac'

export const GET = requireAdmin()(async (
  _request: Request,
  _session,
  context
) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const connections = await parseStatusLog(id)

  return NextResponse.json(connections)
})
