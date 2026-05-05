export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserRole, SyncStatus } from '@prisma/client'
import { getTransport } from '@/lib/transport'
import { validateDeploymentSecurityConfig } from '@/lib/deployment-security'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as Record<string, unknown>).role !== UserRole.ADMIN) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  const { prisma } = await import('@/lib/prisma')

  // DB connectivity check
  let dbHealthy = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbHealthy = true
  } catch {
    dbHealthy = false
  }

  // Per-server transport + last sync
  const servers = await prisma.vpnServer.findMany({
    where: { isActive: true },
  })

  const serverResults = await Promise.all(
    servers.map(async (server) => {
      let transportOk = false
      let transportError: string | undefined

      try {
        const transport = getTransport(server)
        transportOk = await transport.testConnectivity()
      } catch (err) {
        transportError = err instanceof Error ? err.message : String(err)
      }

      const lastSync = await prisma.syncJob.findFirst({
        where: {
          serverId: server.id,
          status: SyncStatus.SUCCESS,
        },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true, type: true },
      })

      return {
        id: server.id,
        name: server.name,
        transport: server.transport,
        transportOk,
        transportError,
        lastSync: lastSync
          ? { completedAt: lastSync.completedAt, type: lastSync.type }
          : null,
      }
    })
  )

  const allTransportsOk = serverResults.every((s) => s.transportOk)
  const deploymentSecurityIssues = validateDeploymentSecurityConfig()
  const hasCriticalDeploymentIssue = deploymentSecurityIssues.some((issue) => issue.severity === 'critical')
  const overallStatus = dbHealthy && allTransportsOk && !hasCriticalDeploymentIssue ? 'healthy' : 'degraded'

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      db: { healthy: dbHealthy },
      deploymentSecurity: {
        healthy: deploymentSecurityIssues.length === 0,
        issues: deploymentSecurityIssues,
      },
      servers: serverResults,
    },
    { status: overallStatus === 'healthy' ? 200 : 503 }
  )
}
