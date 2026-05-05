import { NextRequest } from 'next/server'

const { prismaMock, logAuditMock, totpMock } = vi.hoisted(() => ({
  prismaMock: {
    adminUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  logAuditMock: vi.fn(),
  totpMock: {
    buildTotpUri: vi.fn(),
    decryptTotpSecret: vi.fn(),
    encryptTotpSecret: vi.fn(),
    generateTotpSecret: vi.fn(),
  },
}))

vi.mock('@/lib/rbac', () => ({
  requireApprovedUser: () => (handler: any) => (request: any) =>
    handler(request, {
      user: {
        email: 'admin@example.com',
        role: 'ADMIN',
        isApproved: true,
      },
    }),
}))

vi.mock('@/lib/features', () => ({
  isTotpMfaEnabled: () => true,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/audit', () => ({
  logAudit: logAuditMock,
}))

vi.mock('@/lib/totp', () => totpMock)

import { POST } from '@/app/api/profile/mfa/setup/route'

function makeRequest() {
  return new NextRequest('http://localhost/api/profile/mfa/setup', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
    },
  })
}

describe('POST /api/profile/mfa/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    totpMock.buildTotpUri.mockImplementation((email: string, issuer: string, secret: string) =>
      `otpauth://totp/${issuer}:${email}?secret=${secret}`
    )
    totpMock.encryptTotpSecret.mockImplementation((secret: string) => `encrypted:${secret}`)
    totpMock.generateTotpSecret.mockReturnValue('NEWSECRET')
  })

  it('generates and stores a pending secret when setup starts for the first time', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      mfaEnabled: false,
      mfaPendingSecret: null,
    })
    prismaMock.adminUser.update.mockResolvedValue({})
    logAuditMock.mockResolvedValue(undefined)
    totpMock.decryptTotpSecret.mockReturnValue(null)

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.secret).toBe('NEWSECRET')
    expect(prismaMock.adminUser.update).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: { mfaPendingSecret: 'encrypted:NEWSECRET' },
    })
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'MFA_SETUP_STARTED' }))
  })

  it('reuses the existing pending secret so scanned authenticator entries stay valid', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      mfaEnabled: false,
      mfaPendingSecret: 'encrypted:EXISTINGSECRET',
    })
    totpMock.decryptTotpSecret.mockReturnValue('EXISTINGSECRET')

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.secret).toBe('EXISTINGSECRET')
    expect(prismaMock.adminUser.update).not.toHaveBeenCalled()
    expect(logAuditMock).not.toHaveBeenCalled()
    expect(totpMock.generateTotpSecret).not.toHaveBeenCalled()
  })
})
