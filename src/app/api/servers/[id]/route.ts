export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { validateServerPaths } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/rbac'
import { isServerManagementEnabled, SERVER_MANAGEMENT_DISABLED_MESSAGE } from '@/lib/features'
import { getTransport } from '@/lib/transport'
import { validateAgentUrl } from '@/lib/transport/agent-url'
import {
  applyNetworkSettingsToServerConfig,
  buildApplyNetworkSettingsCommand,
  validateServerNetworkSettings,
} from '@/lib/server-network-config'
import { buildCatCommand } from '@/lib/shell'

const serverDetailSelect = {
  id: true,
  name: true,
  hostname: true,
  transport: true,
  instanceId: true,
  region: true,
  sshHost: true,
  sshPort: true,
  sshUser: true,
  agentUrl: true,
  ccdPath: true,
  easyRsaPath: true,
  serverConf: true,
  clientCertValidityDays: true,
  vpnNetwork: true,
  dnsServers: true,
  searchDomains: true,
  internalDomains: true,
  routeMode: true,
  splitTunnel: true,
  compression: true,
  protocol: true,
  port: true,
  isActive: true,
  createdAt: true,
  groups: { select: { id: true, name: true } },
  _count: { select: { users: true, groups: true, syncJobs: true } },
} as const

export const GET = requireAdmin()(async (
  _request: NextRequest,
  _session,
  context
) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')

  const server = await prisma.vpnServer.findUnique({
    where: { id },
    select: serverDetailSelect,
  })

  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 })
  }

  return NextResponse.json(server)
})

const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  hostname: z.string().min(1).max(255).optional(),
  transport: z.enum(['SSM', 'SSH', 'AGENT']).optional(),
  instanceId: z.string().optional(),
  region: z.string().optional(),
  sshHost: z.string().optional(),
  sshPort: z.number().int().optional(),
  sshUser: z.string().optional(),
  sshKeySecretId: z.string().optional(),
  sshHostKey: z.string().optional(),
  agentUrl: z.string().optional(),
  agentApiKeySecretId: z.string().optional(),
  ccdPath: z.string().optional(),
  easyRsaPath: z.string().optional(),
  serverConf: z.string().optional(),
  clientCertValidityDays: z.int().min(1).max(3650).optional(),
  isActive: z.boolean().optional(),
  vpnNetwork: z.string().max(50).optional(),
  dnsServers: z.array(z.string()).optional(),
  searchDomains: z.array(z.string()).optional(),
  internalDomains: z.array(z.string()).optional(),
  routeMode: z.enum(['NAT', 'ROUTING']).optional(),
  splitTunnel: z.boolean().optional(),
  compression: z.enum(['off', 'lzo', 'lz4']).optional(),
  protocol: z.enum(['udp', 'tcp']).optional(),
  port: z.number().int().min(1).max(65535).optional(),
})

export const PUT = requireAdmin()(async (
  request: NextRequest,
  session,
  context
) => {
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const actorEmail = session.user.email as string
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const body = await request.json()
  const parsed = updateServerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  if (parsed.data.ccdPath || parsed.data.easyRsaPath || parsed.data.serverConf) {
    const { prisma } = await import('@/lib/prisma')
    const existing = await prisma.vpnServer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    const pathValidation = validateServerPaths({
      ccdPath: parsed.data.ccdPath ?? existing.ccdPath,
      easyRsaPath: parsed.data.easyRsaPath ?? existing.easyRsaPath,
      serverConf: parsed.data.serverConf ?? existing.serverConf,
    })
    if (!pathValidation.success) {
      return NextResponse.json({ error: 'Invalid server paths', details: pathValidation.error.issues }, { status: 400 })
    }
  }

  const { prisma } = await import('@/lib/prisma')

  const currentServer = await prisma.vpnServer.findUnique({
    where: { id },
  })
  if (!currentServer) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 })
  }

  const mergedServer = {
    ...currentServer,
    ...parsed.data,
  }

  const networkValidation = validateServerNetworkSettings({
    vpnNetwork: mergedServer.vpnNetwork,
    dnsServers: mergedServer.dnsServers,
    searchDomains: mergedServer.searchDomains,
    internalDomains: mergedServer.internalDomains,
    routeMode: mergedServer.routeMode as 'NAT' | 'ROUTING',
    splitTunnel: mergedServer.splitTunnel,
    compression: mergedServer.compression as 'off' | 'lzo' | 'lz4',
    protocol: mergedServer.protocol as 'udp' | 'tcp',
    port: mergedServer.port,
  })
  if (!networkValidation.success) {
    return NextResponse.json({ error: networkValidation.error }, { status: 400 })
  }

  if (mergedServer.transport === 'AGENT') {
    if (!mergedServer.agentUrl) {
      return NextResponse.json({ error: 'agentUrl is required for agent transport' }, { status: 400 })
    }

    const agentUrlValidation = validateAgentUrl(mergedServer.agentUrl)
    if (!agentUrlValidation.success) {
      return NextResponse.json({ error: agentUrlValidation.error }, { status: 400 })
    }

    parsed.data.agentUrl = agentUrlValidation.data
    mergedServer.agentUrl = agentUrlValidation.data
  }

  const hasNetworkChanges = [
    'vpnNetwork',
    'dnsServers',
    'searchDomains',
    'internalDomains',
    'routeMode',
    'splitTunnel',
    'compression',
    'protocol',
    'port',
    'serverConf',
  ].some((key) => key in parsed.data)

  if (hasNetworkChanges) {
    try {
      const transport = getTransport(mergedServer)
      const currentConfigResult = await transport.executeCommand(`${buildCatCommand(mergedServer.serverConf)} 2>/dev/null || echo ""`)
      const nextConfig = applyNetworkSettingsToServerConfig(currentConfigResult.stdout, {
        vpnNetwork: mergedServer.vpnNetwork,
        dnsServers: mergedServer.dnsServers,
        searchDomains: mergedServer.searchDomains,
        internalDomains: mergedServer.internalDomains,
        routeMode: mergedServer.routeMode as 'NAT' | 'ROUTING',
        splitTunnel: mergedServer.splitTunnel,
        compression: mergedServer.compression as 'off' | 'lzo' | 'lz4',
        protocol: mergedServer.protocol as 'udp' | 'tcp',
        port: mergedServer.port,
      })
      const applyCommand = buildApplyNetworkSettingsCommand({
        serverConf: mergedServer.serverConf,
        vpnNetwork: mergedServer.vpnNetwork,
        routeMode: mergedServer.routeMode as 'NAT' | 'ROUTING',
        configContent: nextConfig,
      })
      const applyResult = await transport.executeCommand(applyCommand, 120000)
      if (applyResult.exitCode !== 0) {
        console.error('Failed to apply server network settings', {
          serverId: id,
          stdout: applyResult.stdout,
          stderr: applyResult.stderr,
        })
        return NextResponse.json({ error: 'Failed to apply network settings on the VPN server' }, { status: 502 })
      }
    } catch (error) {
      console.error('Failed to update VPN server network settings', {
        serverId: id,
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: 'Failed to apply network settings on the VPN server' }, { status: 502 })
    }
  }

  const server = await prisma.vpnServer.update({
    where: { id },
    data: parsed.data,
    select: serverDetailSelect,
  })

  await logAudit({
    action: 'SERVER_UPDATED',
    actorEmail,
    targetType: 'SERVER',
    targetId: server.id,
    details: parsed.data,
  })

  return NextResponse.json(server)
})

export const DELETE = requireAdmin()(async (
  _request: NextRequest,
  session,
  context
) => {
  if (!isServerManagementEnabled()) {
    return NextResponse.json({ error: SERVER_MANAGEMENT_DISABLED_MESSAGE }, { status: 409 })
  }

  const actorEmail = session.user.email as string
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')

  const server = await prisma.vpnServer.findUnique({ where: { id } })
  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 })
  }

  await prisma.vpnServer.delete({ where: { id } })

  await logAudit({
    action: 'SERVER_UPDATED',
    actorEmail,
    targetType: 'SERVER',
    targetId: id,
    details: { deleted: true, name: server.name },
  })

  return NextResponse.json({ success: true })
})
