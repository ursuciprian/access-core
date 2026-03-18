export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { validateServerPaths } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/rbac'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'

const serverListSelect = {
  id: true,
  name: true,
  hostname: true,
  transport: true,
  isActive: true,
  createdAt: true,
  _count: { select: { users: true, groups: true } },
} as const

export const GET = requireAdmin()(async () => {
  const { prisma } = await import('@/lib/prisma')

  const servers = await prisma.vpnServer.findMany({
    select: serverListSelect,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(servers)
})

const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  hostname: z.string().min(1).max(255),
  transport: z.enum(['SSM', 'SSH', 'AGENT']).default('SSM'),
  instanceId: z.string().optional(),
  region: z.string().optional(),
  sshHost: z.string().optional(),
  sshPort: z.number().int().optional(),
  sshUser: z.string().optional(),
  sshKeySecretId: z.string().optional(),
  sshHostKey: z.string().optional(),
  agentUrl: z.string().optional(),
  agentApiKeySecretId: z.string().optional(),
  ccdPath: z.string(),
  easyRsaPath: z.string(),
  serverConf: z.string(),
})

export const POST = requireAdmin()(async (request: NextRequest, session) => {
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const actorEmail = session.user.email as string
  const body = await request.json()
  const parsed = createServerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const pathValidation = validateServerPaths({
    ccdPath: parsed.data.ccdPath,
    easyRsaPath: parsed.data.easyRsaPath,
    serverConf: parsed.data.serverConf,
  })
  if (!pathValidation.success) {
    return NextResponse.json({ error: 'Invalid server paths', details: pathValidation.error.issues }, { status: 400 })
  }

  const { prisma } = await import('@/lib/prisma')

  const server = await prisma.vpnServer.create({
    data: parsed.data,
    select: serverListSelect,
  })

  await logAudit({
    action: 'SERVER_CREATED',
    actorEmail,
    targetType: 'SERVER',
    targetId: server.id,
    details: { name: server.name, hostname: server.hostname },
  })

  return NextResponse.json(server, { status: 201 })
})
