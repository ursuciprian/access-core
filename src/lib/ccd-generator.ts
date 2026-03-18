import { prisma } from './prisma'
import { validateCommonName, validateServerPaths } from './validation'

interface CcdRoute {
  ip: string
  mask: string
}

export function cidrToSubnetMask(cidr: string): { ip: string; mask: string } {
  const [network, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)
  const maskNum = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  const mask = [
    (maskNum >>> 24) & 255,
    (maskNum >>> 16) & 255,
    (maskNum >>> 8) & 255,
    maskNum & 255,
  ].join('.')
  return { ip: network, mask }
}

export function generateCcdContent(routes: CcdRoute[], options?: { staticIp?: string | null; vpnNetwork?: string }): string {
  const lines: string[] = []

  // If staticIp is set, add ifconfig-push line
  if (options?.staticIp) {
    const networkCidr = options.vpnNetwork || '10.8.0.0/24'
    const { mask } = cidrToSubnetMask(networkCidr)
    lines.push(`ifconfig-push ${options.staticIp} ${mask}`)
  }

  // Deduplicate by ip+mask
  const seen = new Set<string>()
  const unique: CcdRoute[] = []
  for (const route of routes) {
    const key = `${route.ip}/${route.mask}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(route)
    }
  }

  for (const r of unique) {
    lines.push(`push "route ${r.ip} ${r.mask}"`)
  }

  return lines.join('\n')
}

export async function generateCcdForUser(userId: string): Promise<string> {
  const now = new Date()
  const user = await prisma.vpnUser.findUnique({
    where: { id: userId },
    include: {
      server: { select: { vpnNetwork: true } },
      groups: {
        include: {
          group: {
            include: {
              cidrBlocks: true,
            },
          },
        },
      },
      temporaryAccess: {
        where: {
          isActive: true,
          expiresAt: { gt: now },
        },
        include: {
          group: {
            include: {
              cidrBlocks: true,
            },
          },
        },
      },
    },
  })

  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  const routes: CcdRoute[] = []
  for (const ug of user.groups) {
    for (const cidr of ug.group.cidrBlocks) {
      routes.push(cidrToSubnetMask(cidr.cidr))
    }
  }

  for (const grant of user.temporaryAccess) {
    for (const cidr of grant.group.cidrBlocks) {
      routes.push(cidrToSubnetMask(cidr.cidr))
    }
  }

  return generateCcdContent(routes, {
    staticIp: user.staticIp,
    vpnNetwork: user.server.vpnNetwork,
  })
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function buildCcdWriteCommand(
  ccdPath: string,
  commonName: string,
  ccdContent: string
): string {
  const cnValidation = validateCommonName(commonName)
  if (!cnValidation.success) {
    throw new Error('Invalid common name for CCD write')
  }

  const pathValidation = validateServerPaths({
    ccdPath,
    easyRsaPath: '/tmp',
    serverConf: '/tmp/server.conf',
  })
  if (!pathValidation.success) {
    throw new Error('Invalid CCD path for write')
  }

  const escapedTarget = shellEscape(`${ccdPath}/${commonName}`)
  return [
    `cat > ${escapedTarget} << 'CCDEOF'`,
    ccdContent,
    'CCDEOF',
    `chmod 644 ${escapedTarget}`,
  ].join('\n')
}

export function buildCcdDeleteCommand(
  ccdPath: string,
  commonName: string
): string {
  const cnValidation = validateCommonName(commonName)
  if (!cnValidation.success) {
    throw new Error('Invalid common name for CCD deletion')
  }

  const pathValidation = validateServerPaths({
    ccdPath,
    easyRsaPath: '/tmp',
    serverConf: '/tmp/server.conf',
  })
  if (!pathValidation.success) {
    throw new Error('Invalid CCD path for deletion')
  }

  return `rm -f ${shellEscape(`${ccdPath}/${commonName}`)}`
}
