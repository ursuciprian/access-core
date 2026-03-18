import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}))

vi.mock('@/lib/cert-service', () => ({
  generateCert: vi.fn(),
  revokeCert: vi.fn(),
}))

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    accessRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminUser: {
      updateMany: vi.fn(),
    },
    vpnUser: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    vpnUserGroup: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { getServerSession } from 'next-auth'
import { generateCert, revokeCert } from '@/lib/cert-service'
import { PATCH } from '@/app/api/access-requests/[id]/route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/access-requests/request-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const baseRequest = {
  id: 'request-1',
  email: 'alice@example.com',
  name: 'Alice',
  serverId: 'server-1',
  groupIds: ['group-1'],
  reason: 'Need access',
  status: 'PENDING',
}

const createdUser = {
  id: 'user-1',
  email: 'alice@example.com',
  commonName: 'alice',
  certStatus: 'NONE',
  certCreatedAt: null,
  isEnabled: false,
  server: {
    id: 'server-1',
    name: 'Server 1',
    easyRsaPath: '/etc/easyrsa',
    ccdPath: '/etc/openvpn/ccd',
    serverConf: '/etc/openvpn/server.conf',
  },
}

describe('PATCH /api/access-requests/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        email: 'admin@example.com',
        role: 'ADMIN',
      },
    } as never)
  })

  it('only marks the request approved after certificate provisioning succeeds', async () => {
    prismaMock.accessRequest.findUnique.mockResolvedValue(baseRequest)
    prismaMock.accessRequest.update
      .mockResolvedValueOnce({ ...baseRequest, status: 'PROCESSING' })
      .mockResolvedValueOnce({ ...baseRequest, status: 'APPROVED' })
    prismaMock.vpnUser.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.email) {
        return null
      }
      return null
    })
    prismaMock.vpnUser.create.mockResolvedValue(createdUser)
    prismaMock.vpnUserGroup.createMany.mockResolvedValue({ count: 1 })
    prismaMock.vpnUser.update.mockResolvedValue({ ...createdUser, certStatus: 'ACTIVE', isEnabled: true })
    prismaMock.adminUser.updateMany.mockResolvedValue({ count: 1 })
    vi.mocked(generateCert).mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' } as never)

    const response = await PATCH(
      makeRequest({ action: 'approve', reviewNote: 'looks good' }),
      { params: Promise.resolve({ id: 'request-1' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: 'APPROVED' })
    expect(prismaMock.accessRequest.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PROCESSING' }),
      })
    )
    expect(vi.mocked(generateCert)).toHaveBeenCalledWith(
      createdUser.server,
      createdUser.commonName
    )
    expect(prismaMock.adminUser.updateMany).toHaveBeenCalledWith({
      where: { email: baseRequest.email, isApproved: false },
      data: { isApproved: true },
    })
    expect(vi.mocked(revokeCert)).not.toHaveBeenCalled()
  })

  it('moves the request to FAILED and keeps it retryable when provisioning fails', async () => {
    prismaMock.accessRequest.findUnique.mockResolvedValue(baseRequest)
    prismaMock.accessRequest.update
      .mockResolvedValueOnce({ ...baseRequest, status: 'PROCESSING' })
      .mockResolvedValueOnce({ ...baseRequest, status: 'FAILED' })
    prismaMock.vpnUser.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.email) {
        return null
      }
      return null
    })
    prismaMock.vpnUser.create.mockResolvedValue(createdUser)
    prismaMock.vpnUserGroup.createMany.mockResolvedValue({ count: 1 })
    prismaMock.vpnUser.update.mockResolvedValue({ ...createdUser, isEnabled: false })
    vi.mocked(generateCert).mockRejectedValue(new Error('easyrsa failed'))

    const response = await PATCH(
      makeRequest({ action: 'approve' }),
      { params: Promise.resolve({ id: 'request-1' }) }
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: 'Access provisioning failed. The request has been left in a retryable state.',
    })
    expect(prismaMock.accessRequest.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      })
    )
    expect(prismaMock.adminUser.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.vpnUser.update).toHaveBeenCalledWith({
      where: { id: createdUser.id },
      data: { isEnabled: false },
    })
  })
})
