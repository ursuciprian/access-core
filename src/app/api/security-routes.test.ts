import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    vpnServer: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/system-settings', () => ({
  getEffectiveSystemSettings: vi.fn(),
}))

import { getServerSession } from 'next-auth'
import { getEffectiveSystemSettings } from '@/lib/system-settings'
import { GET as searchGet } from '@/app/api/search/route'
import { GET as usersGet } from '@/app/api/users/route'
import { GET as userDetailGet } from '@/app/api/users/[id]/route'
import { GET as groupsGet } from '@/app/api/groups/route'
import { GET as groupDetailGet } from '@/app/api/groups/[id]/route'
import { GET as serversGet } from '@/app/api/servers/route'
import { GET as serverDetailGet } from '@/app/api/servers/[id]/route'
import { GET as auditGet } from '@/app/api/audit/route'
import { GET as syncJobsGet } from '@/app/api/sync/jobs/route'
import { GET as googleMappingsGet } from '@/app/api/google-mappings/route'
import { GET as statusGet } from '@/app/api/servers/[id]/status/route'
import { GET as queueGet } from '@/app/api/servers/[id]/queue/route'
import { GET as historyGet } from '@/app/api/servers/[id]/connections/history/route'
import { GET as systemStatusGet } from '@/app/api/system/status/route'
import { GET as temporaryAccessGet } from '@/app/api/users/[id]/temporary-access/route'

function makeRequest(url: string) {
  return new NextRequest(url)
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('security route guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for viewer access on admin inventory and ops routes', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        email: 'viewer@example.com',
        role: 'VIEWER',
        isApproved: true,
      },
    } as never)

    const cases = [
      () => searchGet(makeRequest('http://localhost/api/search?q=alice')),
      () => usersGet(makeRequest('http://localhost/api/users')),
      () => userDetailGet(makeRequest('http://localhost/api/users/user-1'), makeParams('user-1')),
      () => groupsGet(makeRequest('http://localhost/api/groups')),
      () => groupDetailGet(makeRequest('http://localhost/api/groups/group-1'), makeParams('group-1')),
      () => serversGet(makeRequest('http://localhost/api/servers')),
      () => serverDetailGet(makeRequest('http://localhost/api/servers/server-1'), makeParams('server-1')),
      () => auditGet(makeRequest('http://localhost/api/audit')),
      () => syncJobsGet(makeRequest('http://localhost/api/sync/jobs')),
      () => googleMappingsGet(makeRequest('http://localhost/api/google-mappings')),
      () => statusGet(makeRequest('http://localhost/api/servers/server-1/status'), makeParams('server-1')),
      () => queueGet(makeRequest('http://localhost/api/servers/server-1/queue'), makeParams('server-1')),
      () => historyGet(makeRequest('http://localhost/api/servers/server-1/connections/history'), makeParams('server-1')),
      () => temporaryAccessGet(makeRequest('http://localhost/api/users/user-1/temporary-access'), makeParams('user-1')),
    ]

    for (const run of cases) {
      const response = await run()
      expect(response.status).toBe(403)
    }
  })

  it('blocks unapproved users from approved-only routes', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        email: 'viewer@example.com',
        role: 'VIEWER',
        isApproved: false,
      },
    } as never)

    const response = await systemStatusGet(makeRequest('http://localhost/api/system/status'))
    expect(response.status).toBe(403)
  })

  it('allows approved users on self-service approved routes', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        email: 'viewer@example.com',
        role: 'VIEWER',
        isApproved: true,
      },
    } as never)
    vi.mocked(getEffectiveSystemSettings).mockResolvedValue({
      maintenanceMode: true,
    } as never)

    const response = await systemStatusGet(makeRequest('http://localhost/api/system/status'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      maintenanceMode: true,
      featureFlags: {
        serverManagementEnabled: true,
        ldapEnabled: false,
        totpMfaEnabled: true,
        mfaOnboardingRequired: true,
        oidcSsoEnabled: false,
      },
    })
  })

  it('uses sanitized server selects for admin server reads', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        email: 'admin@example.com',
        role: 'ADMIN',
        isApproved: true,
      },
    } as never)

    prismaMock.vpnServer.findMany.mockResolvedValue([])
    prismaMock.vpnServer.findUnique.mockResolvedValue({
      id: 'server-1',
      name: 'Primary',
      hostname: 'vpn.example.com',
      transport: 'SSH',
      instanceId: null,
      region: null,
      sshHost: 'vpn.example.com',
      sshPort: 22,
      sshUser: 'root',
      agentUrl: null,
      ccdPath: '/etc/openvpn/ccd',
      easyRsaPath: '/etc/openvpn/easy-rsa',
      serverConf: '/etc/openvpn/server.conf',
      isActive: true,
      createdAt: new Date(),
      groups: [],
      _count: { users: 1, groups: 1, syncJobs: 0 },
    })

    await serversGet(makeRequest('http://localhost/api/servers'))
    await serverDetailGet(makeRequest('http://localhost/api/servers/server-1'), makeParams('server-1'))

    expect(prismaMock.vpnServer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          sshKeySecretId: true,
          agentApiKeySecretId: true,
          sshHostKey: true,
        }),
      })
    )
    expect(prismaMock.vpnServer.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          sshKeySecretId: true,
          agentApiKeySecretId: true,
          sshHostKey: true,
        }),
      })
    )
  })
})
