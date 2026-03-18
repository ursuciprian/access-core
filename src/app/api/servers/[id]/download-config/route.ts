export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTransport } from '@/lib/transport'
import { validateCommonName } from '@/lib/validation'
import { logAudit } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { prisma } = await import('@/lib/prisma')

  // Find the VPN user for this email on this server
  const vpnUser = await prisma.vpnUser.findFirst({
    where: {
      serverId: id,
      email: session.user.email,
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

  const transport = getTransport(server)

  try {
    // Fetch all certificate components in parallel
    const [caResult, certResult, keyResult, taResult, confResult] = await Promise.all([
      transport.executeCommand(`cat ${server.easyRsaPath}/pki/ca.crt`),
      transport.executeCommand(`cat ${server.easyRsaPath}/pki/issued/${vpnUser.commonName}.crt`),
      transport.executeCommand(`cat ${server.easyRsaPath}/pki/private/${vpnUser.commonName}.key`),
      transport.executeCommand(`cat /etc/openvpn/ta.key`),
      transport.executeCommand(`cat ${server.serverConf}`),
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
    const port = confLines.find(l => l.startsWith('port '))?.split(' ')[1] || '1194'
    const proto = confLines.find(l => l.startsWith('proto '))?.split(' ')[1] || 'udp'
    const cipher = confLines.find(l => l.startsWith('cipher '))?.split(' ')[1] || 'AES-256-GCM'

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
      actorEmail: session.user.email,
      targetType: 'USER',
      targetId: vpnUser.id,
      details: { commonName: vpnUser.commonName, serverId: id },
    })

    return new NextResponse(ovpnConfig, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-openvpn-profile',
        'Content-Disposition': `attachment; filename="${vpnUser.commonName}-${server.name}.ovpn"`,
      },
    })
  } catch (err) {
    console.error('Failed to generate OpenVPN config', { serverId: id, userId: vpnUser.id, error: err })
    return NextResponse.json({ error: 'Failed to generate config' }, { status: 500 })
  }
}
