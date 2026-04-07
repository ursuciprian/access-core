import { beforeEach, describe, expect, it, vi } from 'vitest'

const { updateManyMock } = vi.hoisted(() => ({
  updateManyMock: vi.fn(),
}))

vi.mock('./prisma', () => ({
  prisma: {
    adminUser: {
      updateMany: updateManyMock,
    },
  },
}))

import { generateTotpCode, getTotpStep } from './totp'
import { consumeTotpCode } from './totp-verification'

describe('consumeTotpCode', () => {
  const secret = 'JBSWY3DPEHPK3PXP'
  const timestamp = 1_710_000_000_000

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid codes before touching the database', async () => {
    const result = await consumeTotpCode('admin-1', secret, '000000', { timestamp })

    expect(result).toEqual({ success: false, reason: 'invalid' })
    expect(updateManyMock).not.toHaveBeenCalled()
  })

  it('stores the matched step for valid codes', async () => {
    updateManyMock.mockResolvedValue({ count: 1 })
    const code = generateTotpCode(secret, timestamp)

    const result = await consumeTotpCode('admin-1', secret, code, { timestamp })

    expect(result).toEqual({ success: true, step: getTotpStep(timestamp) })
    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'admin-1' }),
        data: expect.objectContaining({ lastTotpStep: getTotpStep(timestamp) }),
      })
    )
  })

  it('rejects replayed codes when the same step was already consumed', async () => {
    updateManyMock.mockResolvedValue({ count: 0 })
    const code = generateTotpCode(secret, timestamp)

    const result = await consumeTotpCode('admin-1', secret, code, { timestamp })

    expect(result).toEqual({ success: false, reason: 'replayed' })
  })
})
