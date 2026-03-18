import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { PUT } from '@/app/api/admin/users/[id]/route'

describe('PUT /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        email: 'admin@example.com',
        role: 'ADMIN',
        isApproved: true,
      },
    } as never)
  })

  it('rejects password resets for SSO-only accounts', async () => {
    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({
      id: 'admin-2',
      email: 'sso@example.com',
      password: null,
      role: 'VIEWER',
      isApproved: true,
    } as never)

    const response = await PUT(
      new NextRequest('http://localhost/api/admin/users/admin-2', {
        method: 'PUT',
        body: JSON.stringify({ password: 'new-password' }),
      }),
      { params: Promise.resolve({ id: 'admin-2' }) } as never
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Password reset is only available for accounts that already use credentials',
    })
  })

  it('rejects self password changes through admin management', async () => {
    vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      password: '$2b$10$hash',
      role: 'ADMIN',
      isApproved: true,
    } as never)

    const response = await PUT(
      new NextRequest('http://localhost/api/admin/users/admin-1', {
        method: 'PUT',
        body: JSON.stringify({ password: 'new-password' }),
      }),
      { params: Promise.resolve({ id: 'admin-1' }) } as never
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Use your profile page to change your own password',
    })
  })
})
