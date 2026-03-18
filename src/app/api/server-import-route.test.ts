import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/import-service', () => ({
  discoverExistingUsers: vi.fn(),
  importUsers: vi.fn(),
}))

import { getServerSession } from 'next-auth'
import { discoverExistingUsers } from '@/lib/import-service'
import { GET } from '@/app/api/servers/[id]/import/route'

describe('GET /api/servers/[id]/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a generic error message instead of leaking the raw exception', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        email: 'admin@example.com',
        role: 'ADMIN',
        isApproved: true,
      },
    } as never)
    vi.mocked(discoverExistingUsers).mockRejectedValue(
      new Error('ENOENT: /srv/openvpn/ccd not found')
    )

    const response = await GET(
      new NextRequest('http://localhost/api/servers/server-1/import'),
      { params: Promise.resolve({ id: 'server-1' }) }
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to load importable users',
    })
  })
})
