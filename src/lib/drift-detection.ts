import { getTransport } from './transport'
import { validateCommonName } from './validation'
import { generateCcdForUser, buildCcdWriteCommand } from './ccd-generator'
import { logAudit } from './audit'
import { reconcileExpiredTemporaryAccess } from './temporary-access'
import { buildListDirectoryCommand, buildReadCcdCommand } from './shell'

export type DriftResult = {
  missing: string[]
  extra: string[]
  mismatched: Array<{ cn: string; expected: string; actual: string }>
}

function normalizeCcd(content: string): string {
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .sort()
    .join('\n')
}

export async function detectDrift(serverId: string): Promise<DriftResult> {
  const { prisma } = await import('@/lib/prisma')
  await reconcileExpiredTemporaryAccess({ serverId })

  const server = await prisma.vpnServer.findUnique({ where: { id: serverId } })
  if (!server) {
    throw new Error(`Server not found: ${serverId}`)
  }

  const transport = getTransport(server)

  // List CCD files on server
  const lsResult = await transport.executeCommand(buildListDirectoryCommand(server.ccdPath))
  const serverFiles: string[] = lsResult.exitCode === 0
    ? lsResult.stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && validateCommonName(l).success)
    : []

  // Get all enabled users from DB for this server
  const dbUsers = await prisma.vpnUser.findMany({
    where: { serverId, isEnabled: true },
    select: { id: true, commonName: true },
  })

  const dbCns = new Set(dbUsers.map((u) => u.commonName))
  const serverCns = new Set(serverFiles)

  const missing = dbUsers
    .filter((u) => !serverCns.has(u.commonName))
    .map((u) => u.commonName)

  const extra = serverFiles.filter((cn) => !dbCns.has(cn))

  const mismatched: Array<{ cn: string; expected: string; actual: string }> = []

  // Check files that exist on both sides
  const commonCns = dbUsers.filter((u) => serverCns.has(u.commonName))

  for (const user of commonCns) {
    const catResult = await transport.executeCommand(buildReadCcdCommand(server.ccdPath, user.commonName))
    const actual = catResult.exitCode === 0 ? catResult.stdout : ''

    const expected = await generateCcdForUser(user.id)

    if (normalizeCcd(actual) !== normalizeCcd(expected)) {
      mismatched.push({ cn: user.commonName, expected, actual })
    }
  }

  return { missing, extra, mismatched }
}

export async function reconcileDrift(serverId: string, actorEmail: string): Promise<void> {
  const { prisma } = await import('@/lib/prisma')
  await reconcileExpiredTemporaryAccess({ serverId })

  const server = await prisma.vpnServer.findUnique({ where: { id: serverId } })
  if (!server) {
    throw new Error(`Server not found: ${serverId}`)
  }

  const transport = getTransport(server)

  const dbUsers = await prisma.vpnUser.findMany({
    where: { serverId, isEnabled: true },
    select: { id: true, commonName: true },
  })

  for (const user of dbUsers) {
    const expected = await generateCcdForUser(user.id)
    const command = buildCcdWriteCommand(server.ccdPath, user.commonName, expected)
    await transport.executeCommand(command)

    await prisma.vpnUser.update({
      where: { id: user.id },
      data: { ccdSyncStatus: 'SUCCESS', lastCcdPush: new Date() },
    })
  }

  await logAudit({
    action: 'CCD_PUSHED',
    actorEmail,
    targetType: 'SERVER',
    targetId: serverId,
    details: { reconciled: true, totalUsers: dbUsers.length },
  })
}
