import { prisma } from './prisma'
import { findValidTotpStep, getTotpSecretHash } from './totp'

export async function consumeTotpCode(adminUserId: string, secret: string, code: string, options?: { window?: number; timestamp?: number }) {
  const matchedStep = findValidTotpStep(secret, code, options)
  if (matchedStep === null) {
    return { success: false as const, reason: 'invalid' as const }
  }

  const secretHash = getTotpSecretHash(secret)
  const result = await prisma.adminUser.updateMany({
    where: {
      id: adminUserId,
      NOT: {
        AND: [
          { lastTotpSecretHash: secretHash },
          { lastTotpStep: { gte: matchedStep } },
        ],
      },
    } as any,
    data: {
      lastTotpSecretHash: secretHash,
      lastTotpStep: matchedStep,
    } as any,
  })

  if (result.count === 0) {
    return { success: false as const, reason: 'replayed' as const }
  }

  return { success: true as const, step: matchedStep }
}
