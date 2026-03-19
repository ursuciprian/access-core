import { NextRequest } from 'next/server'

const { prismaMock, logAuditMock } = vi.hoisted(() => ({
  prismaMock: {
    adminUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    authSession: {
      updateMany: vi.fn(),
    },
  },
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

vi.mock('@/lib/audit', () => ({
  logAudit: logAuditMock,
}))

import { POST } from '@/app/api/admin/users/[id]/mfa/reset/route'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/users/admin-2/mfa/reset', {
    method: 'POST',
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/admin/users/[id]/mfa/reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears MFA state and writes an audit event', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: 'admin-2',
      email: 'viewer@example.com',
      mfaEnabled: true,
    })
    prismaMock.adminUser.update.mockResolvedValue({
      id: 'admin-2',
    })
    prismaMock.authSession.updateMany.mockResolvedValue({ count: 1 })
    logAuditMock.mockResolvedValue(undefined)

    const response = await POST(makeRequest(), makeParams('admin-2'))

    expect(response.status).toBe(200)
    expect(prismaMock.adminUser.update).toHaveBeenCalledWith({
      where: { id: 'admin-2' },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaPendingSecret: null,
        mfaEnabledAt: null,
      },
    })
    expect(prismaMock.authSession.updateMany).toHaveBeenCalled()
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ADMIN_USER_MFA_RESET',
        targetId: 'admin-2',
        details: expect.objectContaining({ email: 'viewer@example.com' }),
      })
    )
  })

  it('returns 404 when the admin user does not exist', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue(null)

    const response = await POST(makeRequest(), makeParams('missing'))

    expect(response.status).toBe(404)
    expect(prismaMock.adminUser.update).not.toHaveBeenCalled()
    expect(logAuditMock).not.toHaveBeenCalled()
  })
})
