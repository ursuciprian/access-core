import { NextRequest } from 'next/server'

const { prismaMock, executeCommandMock, generateCcdForUserMock, buildCcdWriteCommandMock, reconcileExpiredTemporaryAccessMock, logAuditMock } = vi.hoisted(() => ({
  prismaMock: {
    vpnUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  executeCommandMock: vi.fn(),
  generateCcdForUserMock: vi.fn(),
  buildCcdWriteCommandMock: vi.fn(),
  reconcileExpiredTemporaryAccessMock: vi.fn(),
  logAuditMock: vi.fn(),
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: {
      email: 'admin@example.com',
      role: 'ADMIN',
      isApproved: true,
    },
  }),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/features', () => ({
  isServerManagementEnabled: vi.fn(() => true),
  SERVER_MANAGEMENT_DISABLED_MESSAGE: 'Server management is disabled by environment configuration',
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/ccd-generator', () => ({
  generateCcdForUser: generateCcdForUserMock,
  buildCcdWriteCommand: buildCcdWriteCommandMock,
}))

vi.mock('@/lib/temporary-access', () => ({
  reconcileExpiredTemporaryAccess: reconcileExpiredTemporaryAccessMock,
}))

vi.mock('@/lib/transport', () => ({
  getTransport: vi.fn(() => ({
    executeCommand: executeCommandMock,
  })),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: logAuditMock,
}))

import { POST } from '@/app/api/users/[id]/push-ccd/route'

describe('POST /api/users/[id]/push-ccd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reconcileExpiredTemporaryAccessMock.mockResolvedValue({ expiredCount: 0, failedCount: 0 })
    prismaMock.vpnUser.findUnique.mockResolvedValue({
      id: 'user-1',
      commonName: 'alice',
      serverId: 'server-1',
      server: {
        id: 'server-1',
        ccdPath: '/etc/openvpn/ccd',
      },
    })
    generateCcdForUserMock.mockResolvedValue('push "route 10.0.2.0 255.255.255.0"')
    buildCcdWriteCommandMock.mockReturnValue('write-ccd')
    executeCommandMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
    prismaMock.vpnUser.update.mockResolvedValue({ id: 'user-1' })
    logAuditMock.mockResolvedValue(undefined)
  })

  it('reconciles temporary access before pushing the user CCD', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/users/user-1/push-ccd', { method: 'POST' }),
      { params: Promise.resolve({ id: 'user-1' }) }
    )

    expect(response.status).toBe(200)
    expect(reconcileExpiredTemporaryAccessMock).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(generateCcdForUserMock).toHaveBeenCalledWith('user-1')
    expect(buildCcdWriteCommandMock).toHaveBeenCalledWith(
      '/etc/openvpn/ccd',
      'alice',
      'push "route 10.0.2.0 255.255.255.0"'
    )
  })
})
