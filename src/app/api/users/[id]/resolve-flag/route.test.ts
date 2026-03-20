import { NextRequest } from 'next/server'

const {
  prismaMock,
  logAuditMock,
  executeCommandMock,
  revokeCertMock,
} = vi.hoisted(() => ({
  prismaMock: {
    vpnUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    vpnGroup: {
      findUnique: vi.fn(),
    },
    vpnUserGroup: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
  logAuditMock: vi.fn(),
  executeCommandMock: vi.fn(),
  revokeCertMock: vi.fn(),
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => ({
    user: {
      email: 'admin@example.com',
      role: 'ADMIN',
      isApproved: true,
    },
  })),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/audit', () => ({
  logAudit: logAuditMock,
}))

vi.mock('@/lib/cert-service', () => ({
  revokeCert: revokeCertMock,
}))

vi.mock('@/lib/transport', () => ({
  getTransport: vi.fn(() => ({
    executeCommand: executeCommandMock,
  })),
}))

import { POST } from '@/app/api/users/[id]/resolve-flag/route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/users/user-1/resolve-flag', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/users/[id]/resolve-flag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    executeCommandMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
    prismaMock.vpnUser.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      commonName: 'alice',
      isFlagged: true,
      certStatus: 'ACTIVE',
      server: {
        id: 'server-1',
        ccdPath: '/etc/openvpn/ccd',
        easyRsaPath: '/etc/openvpn/easy-rsa',
        serverConf: '/etc/openvpn/server.conf',
      },
    })
    prismaMock.vpnUser.update.mockResolvedValue({
      id: 'user-1',
      isFlagged: false,
      flagReason: null,
      flaggedAt: null,
    })
    logAuditMock.mockResolvedValue(undefined)
  })

  it('dismisses a flagged user and writes an audit log', async () => {
    const response = await POST(makeRequest({ action: 'dismiss' }), makeParams('user-1'))

    expect(response.status).toBe(200)
    expect(prismaMock.vpnUser.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        isFlagged: false,
        flagReason: null,
        flaggedAt: null,
      },
    })
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'FLAG_RESOLVED',
        targetId: 'user-1',
        details: expect.objectContaining({
          resolution: 'dismiss',
          commonName: 'alice',
        }),
      })
    )
  })

  it('shell-escapes the CCD removal command for revoke actions', async () => {
    const response = await POST(makeRequest({ action: 'revoke' }), makeParams('user-1'))

    expect(response.status).toBe(200)
    expect(executeCommandMock).toHaveBeenCalledWith("rm -f '/etc/openvpn/ccd/alice'")
    expect(revokeCertMock).toHaveBeenCalled()
  })

  it('rejects revoke actions when the common name is invalid', async () => {
    prismaMock.vpnUser.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      commonName: "alice;rm -rf /",
      isFlagged: true,
      certStatus: 'ACTIVE',
      server: {
        id: 'server-1',
        ccdPath: '/etc/openvpn/ccd',
        easyRsaPath: '/etc/openvpn/easy-rsa',
        serverConf: '/etc/openvpn/server.conf',
      },
    })

    const response = await POST(makeRequest({ action: 'revoke' }), makeParams('user-1'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid common name' })
    expect(executeCommandMock).not.toHaveBeenCalled()
  })

  it('returns 400 when action is missing', async () => {
    const response = await POST(makeRequest({}), makeParams('user-1'))

    expect(response.status).toBe(400)
    expect(prismaMock.vpnUser.update).not.toHaveBeenCalled()
    expect(logAuditMock).not.toHaveBeenCalled()
  })
})
