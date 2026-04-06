import { NextRequest } from 'next/server'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    adminUser: {
      count: vi.fn(),
    },
  },
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

import { GET } from '@/app/api/admin/users/pending-count/route'

describe('GET /api/admin/users/pending-count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the number of unapproved portal users', async () => {
    prismaMock.adminUser.count.mockResolvedValue(3)

    const response = await GET(new NextRequest('http://localhost/api/admin/users/pending-count'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ count: 3 })
    expect(prismaMock.adminUser.count).toHaveBeenCalledWith({
      where: { isApproved: false },
    })
  })
})
