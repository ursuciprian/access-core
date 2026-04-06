import { NextRequest } from 'next/server'

const { prismaMock, executeCommandMock, revokeCertMock, isCertRevokedOrMissingMock, buildCcdDeleteCommandMock, logAuditMock } = vi.hoisted(() => ({
  prismaMock: {
    vpnUser: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
  executeCommandMock: vi.fn(),
  revokeCertMock: vi.fn(),
  isCertRevokedOrMissingMock: vi.fn(),
  buildCcdDeleteCommandMock: vi.fn(),
  logAuditMock: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  requireAdmin: () => (handler: any) => (request: any, context: any) =>
    handler(
      request,
      {
        user: {
          email: 'admin@example.com',
          role: 'ADMIN',
          isApproved: true,
        },
      },
      context
    ),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/features', () => ({
  isServerManagementEnabled: vi.fn(() => true),
  SERVER_MANAGEMENT_DISABLED_MESSAGE: 'Server management is disabled in the current environment',
}))

vi.mock('@/lib/cert-service', () => ({
  revokeCert: revokeCertMock,
  isCertRevokedOrMissing: isCertRevokedOrMissingMock,
}))

vi.mock('@/lib/ccd-generator', () => ({
  buildCcdDeleteCommand: buildCcdDeleteCommandMock,
}))

vi.mock('@/lib/transport', () => ({
  getTransport: vi.fn(() => ({
    executeCommand: executeCommandMock,
  })),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: logAuditMock,
}))

import { isServerManagementEnabled } from '@/lib/features'
import { DELETE } from '@/app/api/users/[id]/route'

function makeRequest() {
  return new NextRequest('http://localhost/api/users/user-1', {
    method: 'DELETE',
    headers: {
      origin: 'http://localhost',
    },
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('DELETE /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isServerManagementEnabled).mockReturnValue(true)
    buildCcdDeleteCommandMock.mockReturnValue("rm -f '/etc/openvpn/ccd/alice'")
    executeCommandMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
    revokeCertMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
    isCertRevokedOrMissingMock.mockResolvedValue(false)
    prismaMock.vpnUser.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      commonName: 'alice',
      certStatus: 'ACTIVE',
      serverId: 'server-1',
      server: {
        id: 'server-1',
        name: 'Primary',
        ccdPath: '/etc/openvpn/ccd',
      },
    })
    prismaMock.vpnUser.delete.mockResolvedValue({ id: 'user-1' })
    logAuditMock.mockResolvedValue(undefined)
  })

  it('revokes the cert, removes the CCD, kills the active session, and deletes the user', async () => {
    const response = await DELETE(makeRequest(), makeParams('user-1'))

    expect(response.status).toBe(200)
    expect(revokeCertMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'server-1', name: 'Primary' }),
      'alice'
    )
    expect(buildCcdDeleteCommandMock).toHaveBeenCalledWith('/etc/openvpn/ccd', 'alice')
    expect(executeCommandMock).toHaveBeenNthCalledWith(1, "rm -f '/etc/openvpn/ccd/alice'")
    expect(executeCommandMock).toHaveBeenNthCalledWith(
      2,
      "printf '%s\\n' 'kill alice' | nc -w 1 127.0.0.1 7505 2>/dev/null || true"
    )
    expect(prismaMock.vpnUser.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } })
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_DELETED',
        actorEmail: 'admin@example.com',
        targetType: 'USER',
        targetId: 'user-1',
        details: expect.objectContaining({
          userId: 'user-1',
          email: 'alice@example.com',
          commonName: 'alice',
        }),
      })
    )
  })

  it('blocks deletion when server management is disabled', async () => {
    vi.mocked(isServerManagementEnabled).mockReturnValue(false)

    const response = await DELETE(makeRequest(), makeParams('user-1'))

    expect(response.status).toBe(409)
    expect(revokeCertMock).not.toHaveBeenCalled()
    expect(prismaMock.vpnUser.delete).not.toHaveBeenCalled()
  })

  it('does not delete the user when remote cleanup fails', async () => {
    executeCommandMock.mockRejectedValueOnce(new Error('ssh failed'))

    const response = await DELETE(makeRequest(), makeParams('user-1'))

    expect(response.status).toBe(500)
    expect(prismaMock.vpnUser.delete).not.toHaveBeenCalled()
    expect(logAuditMock).not.toHaveBeenCalled()
  })

  it('continues deletion when the certificate is already revoked or missing', async () => {
    revokeCertMock.mockRejectedValueOnce(new Error('Certificate revocation command failed'))
    isCertRevokedOrMissingMock.mockResolvedValueOnce(true)

    const response = await DELETE(makeRequest(), makeParams('user-1'))

    expect(response.status).toBe(200)
    expect(isCertRevokedOrMissingMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'server-1', name: 'Primary' }),
      'alice'
    )
    expect(prismaMock.vpnUser.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } })
  })
})
