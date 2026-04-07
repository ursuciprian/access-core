import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/import-service', () => ({
  discoverExistingUsers: vi.fn(),
}))

import { getServerSession } from 'next-auth'
import { POST as createServer } from '@/app/api/servers/route'
import { GET as importUsersGet } from '@/app/api/servers/[id]/import/route'
import { POST as certPost } from '@/app/api/users/[id]/cert/route'

function makeAdminSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: {
      email: 'admin@example.com',
      role: 'ADMIN',
      isApproved: true,
    },
  } as never)
}

describe('server management feature flag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SERVER_MANAGEMENT_ENABLED = 'false'
  })

  afterEach(() => {
    process.env.SERVER_MANAGEMENT_ENABLED = 'true'
  })

  it('blocks server creation when server management is disabled', async () => {
    makeAdminSession()

    const response = await createServer(
      new NextRequest('http://localhost/api/servers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Primary',
          hostname: 'vpn.example.com',
          transport: 'SSH',
          ccdPath: '/etc/openvpn/ccd',
          easyRsaPath: '/etc/openvpn/easy-rsa',
          serverConf: '/etc/openvpn/server.conf',
        }),
        headers: {
          origin: 'http://localhost',
        },
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Server management is disabled by environment configuration',
    })
  })

  it('blocks import discovery when server management is disabled', async () => {
    makeAdminSession()

    const response = await importUsersGet(
      new NextRequest('http://localhost/api/servers/server-1/import'),
      { params: Promise.resolve({ id: 'server-1' }) }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Server management is disabled by environment configuration',
    })
  })

  it('blocks certificate operations when server management is disabled', async () => {
    makeAdminSession()

    const response = await certPost(
      new NextRequest('http://localhost/api/users/user-1/cert', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate' }),
        headers: {
          origin: 'http://localhost',
        },
      }),
      { params: Promise.resolve({ id: 'user-1' }) }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Server management is disabled by environment configuration',
    })
  })
})
