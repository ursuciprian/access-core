import { CertStatus } from '@prisma/client'
import { getTransport } from './transport'
import { validateCommonName } from './validation'
import { logAudit } from './audit'

export type ImportUserInput = {
  commonName: string
  email: string
  groupIds: string[]
}

export type DiscoveredUser = {
  commonName: string
  routes: string[]
  certStatus: 'ACTIVE' | 'REVOKED' | 'NONE'
}

export type ImportSummary = {
  imported: number
  errors: Array<{ cn: string; error: string }>
}

function parseCcdRoutes(content: string): string[] {
  const routes: string[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    // match: push "route <ip> <mask>"
    const match = trimmed.match(/^push\s+"route\s+([\d.]+)\s+([\d.]+)"$/)
    if (match) {
      routes.push(`${match[1]}/${match[2]}`)
    }
  }
  return routes
}

function parseCertStatus(output: string): 'ACTIVE' | 'REVOKED' | 'NONE' {
  if (output.includes('NOT_FOUND') || output.trim() === '') return 'NONE'
  if (output.toLowerCase().includes('revoked')) return 'REVOKED'
  return 'ACTIVE'
}

export async function discoverExistingUsers(serverId: string): Promise<DiscoveredUser[]> {
  const { prisma } = await import('@/lib/prisma')

  const server = await prisma.vpnServer.findUnique({ where: { id: serverId } })
  if (!server) {
    throw new Error(`Server not found: ${serverId}`)
  }

  const transport = getTransport(server)

  // List CCD files
  const lsResult = await transport.executeCommand(`ls -1 ${server.ccdPath}/`)
  if (lsResult.exitCode !== 0) {
    throw new Error(`Failed to list CCD directory: ${lsResult.stderr}`)
  }

  const fileNames = lsResult.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const existingUsers = await prisma.vpnUser.findMany({
    where: { serverId, commonName: { in: fileNames } },
    select: { commonName: true },
  })
  const existingCommonNames = new Set(existingUsers.map((user) => user.commonName))

  const discovered: DiscoveredUser[] = []

  for (const cn of fileNames) {
    // Validate common name to avoid path traversal
    const validation = validateCommonName(cn)
    if (!validation.success) {
      continue
    }

    if (existingCommonNames.has(cn)) {
      continue
    }

    // Read CCD content
    const catResult = await transport.executeCommand(`cat ${server.ccdPath}/${cn}`)
    const routes = catResult.exitCode === 0 ? parseCcdRoutes(catResult.stdout) : []

    // Check cert status
    const certResult = await transport.executeCommand(
      `cd ${server.easyRsaPath} && ./easyrsa show-cert ${cn} 2>/dev/null || echo "NOT_FOUND"`
    )
    const certStatus = parseCertStatus(certResult.stdout)

    discovered.push({ commonName: cn, routes, certStatus })
  }

  return discovered
}

export async function importUsers(
  serverId: string,
  imports: ImportUserInput[],
  actorEmail: string
): Promise<ImportSummary> {
  const { prisma } = await import('@/lib/prisma')

  const server = await prisma.vpnServer.findUnique({ where: { id: serverId } })
  if (!server) {
    throw new Error(`Server not found: ${serverId}`)
  }

  let imported = 0
  const errors: Array<{ cn: string; error: string }> = []

  for (const input of imports) {
    const cnValidation = validateCommonName(input.commonName)
    if (!cnValidation.success) {
      errors.push({ cn: input.commonName, error: 'Invalid common name' })
      continue
    }

    try {
      // Check if groups belong to this server
      const groups = await prisma.vpnGroup.findMany({
        where: { id: { in: input.groupIds }, serverId },
      })
      const validGroupIds = groups.map((g) => g.id)

      const user = await prisma.vpnUser.create({
        data: {
          email: input.email,
          commonName: input.commonName,
          serverId,
          certStatus: CertStatus.NONE,
          isEnabled: true,
          groups: {
            create: validGroupIds.map((groupId) => ({
              groupId,
              source: 'MANUAL',
            })),
          },
        },
      })

      await logAudit({
        action: 'IMPORT_COMPLETED',
        actorEmail,
        targetType: 'USER',
        targetId: user.id,
        userId: user.id,
        details: {
          commonName: input.commonName,
          email: input.email,
          groupIds: validGroupIds,
          serverId,
        },
      })

      imported++
    } catch (err) {
      errors.push({ cn: input.commonName, error: String(err) })
    }
  }

  return { imported, errors }
}
