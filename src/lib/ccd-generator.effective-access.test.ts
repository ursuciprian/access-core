vi.mock('@/lib/prisma', () => ({
  prisma: {
    vpnUser: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { generateCcdForUser } from './ccd-generator'

describe('generateCcdForUser effective access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes active temporary-access group routes and excludes expired ones', async () => {
    vi.mocked(prisma.vpnUser.findUnique).mockResolvedValue({
      id: 'user-1',
      staticIp: null,
      server: { vpnNetwork: '10.8.0.0/24' },
      groups: [
        {
          group: {
            cidrBlocks: [{ cidr: '10.0.1.0/24' }],
          },
        },
      ],
      temporaryAccess: [
        {
          group: {
            cidrBlocks: [{ cidr: '10.0.2.0/24' }],
          },
        },
      ],
    } as never)

    const result = await generateCcdForUser('user-1')

    expect(result).toContain('push "route 10.0.1.0 255.255.255.0"')
    expect(result).toContain('push "route 10.0.2.0 255.255.255.0"')
    expect(prisma.vpnUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          temporaryAccess: expect.objectContaining({
            where: expect.objectContaining({
              isActive: true,
            }),
          }),
        }),
      })
    )
  })
})
