export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getTransport } from '@/lib/transport'
import { validateCommonName, validateServerPaths } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { buildCatCommand } from '@/lib/shell'
import { requireApprovedUser } from '@/lib/rbac'
import {
  buildOvpnAttachmentFilename,
  getSafeOpenVpnConfigToken,
  getSafeOpenVpnPort,
  getSafeOpenVpnProtocol,
  isSafeOpenVpnRemoteHost,
} from '@/lib/openvpn-profile'

export const GET = requireApprovedUser()(async (
  request: NextRequest,
  session,
  context
) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  const { prisma } = await import('@/lib/prisma')
  const actorEmail = session.user.email as string

  // Find the VPN user for this email on this server
  const vpnUser = await prisma.vpnUser.findFirst({
    where: {
      serverId: id,
      email: actorEmail,
      isEnabled: true,
    },
  })

  if (!vpnUser) {
    return NextResponse.json({ error: 'No VPN access found for this server' }, { status: 404 })
  }

  const cnValidation = validateCommonName(vpnUser.commonName)
  if (!cnValidation.success) {
    return NextResponse.json({ error: 'Invalid common name' }, { status: 400 })
  }

  const server = await prisma.vpnServer.findUnique({ where: { id } })
  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 })
  }

  if (!isSafeOpenVpnRemoteHost(server.hostname)) {
    return NextResponse.json({ error: 'Invalid server hostname for OpenVPN profile' }, { status: 400 })
  }

  const pathValidation = validateServerPaths({
    ccdPath: server.ccdPath,
    easyRsaPath: server.easyRsaPath,
    serverConf: server.serverConf,
  })
  if (!pathValidation.success) {
    return NextResponse.json({ error: 'Invalid server configuration paths' }, { status: 400 })
  }

  const transport = getTransport(server)

  try {
    // Fetch all certificate components in parallel
    const [caResult, certResult, keyResult, taResult, confResult] = await Promise.all([
      transport.executeCommand(buildCatCommand(`${server.easyRsaPath}/pki/ca.crt`)),
      transport.executeCommand(buildCatCommand(`${server.easyRsaPath}/pki/issued/${vpnUser.commonName}.crt`)),
      transport.executeCommand(buildCatCommand(`${server.easyRsaPath}/pki/private/${vpnUser.commonName}.key`)),
      transport.executeCommand(buildCatCommand('/etc/openvpn/ta.key')),
      transport.executeCommand(buildCatCommand(server.serverConf)),
    ])

    if (certResult.exitCode !== 0) {
      return NextResponse.json(
        { error: 'Certificate not found. It may need to be generated first.' },
        { status: 404 }
      )
    }

    if (keyResult.exitCode !== 0) {
      return NextResponse.json({ error: 'Private key not found' }, { status: 404 })
    }

    // Parse server config for port and proto
    const confLines = confResult.stdout.split('\n')
    const port = getSafeOpenVpnPort(confLines.find(l => l.startsWith('port '))?.split(/\s+/)[1])
    const proto = getSafeOpenVpnProtocol(confLines.find(l => l.startsWith('proto '))?.split(/\s+/)[1])
    const cipher = getSafeOpenVpnConfigToken(
      confLines.find(l => l.startsWith('cipher '))?.split(/\s+/)[1],
      'AES-256-GCM'
    )

    // Extract just the certificate (between BEGIN and END markers)
    const extractPem = (raw: string) => {
      const match = raw.match(/(-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----)/m)
      return match ? match[1].trim() : raw.trim()
    }

    const ovpnConfig = [
      'client',
      'dev tun',
      `proto ${proto}`,
      `remote ${server.hostname} ${port}`,
      'resolv-retry infinite',
      'nobind',
      'persist-key',
      'persist-tun',
      'remote-cert-tls server',
      `cipher ${cipher}`,
      'key-direction 1',
      'verb 3',
      '',
      '<ca>',
      extractPem(caResult.stdout),
      '</ca>',
      '',
      '<cert>',
      extractPem(certResult.stdout),
      '</cert>',
      '',
      '<key>',
      extractPem(keyResult.stdout),
      '</key>',
      '',
      ...(taResult.exitCode === 0 ? [
        '<tls-auth>',
        extractPem(taResult.stdout),
        '</tls-auth>',
      ] : []),
      '',
    ].join('\n')

    await logAudit({
      action: 'CONFIG_DOWNLOADED',
      actorEmail,
      targetType: 'USER',
      targetId: vpnUser.id,
      details: { commonName: vpnUser.commonName, serverId: id },
    })

    return new NextResponse(ovpnConfig, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-openvpn-profile',
        'Content-Disposition': `attachment; filename="${buildOvpnAttachmentFilename(vpnUser.commonName, server.name)}"`,
      },
    })
  } catch (err) {
    console.error('Failed to generate OpenVPN config', { serverId: id, userId: vpnUser.id, error: err })
    return NextResponse.json({ error: 'Failed to generate config' }, { status: 500 })
  }
})
