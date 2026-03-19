import { prisma } from './prisma'

interface CreateAuthSessionOptions {
  userId: string
  method: 'credentials' | 'google' | 'ldap' | 'sso'
  expiresAt: number
  ip?: string | null
  userAgent?: string | null
}

export async function createAuthSession(options: CreateAuthSessionOptions) {
  const session = await prisma.authSession.create({
    data: {
      userId: options.userId,
      method: options.method,
      ip: options.ip ?? null,
      userAgent: options.userAgent ?? null,
      expiresAt: new Date(options.expiresAt),
      lastSeenAt: new Date(),
    },
    select: { id: true },
  })

  return session.id
}

export async function isAuthSessionActive(sessionId: string | null | undefined, userId: string | null | undefined) {
  if (!sessionId || !userId) {
    return false
  }

  const session = await prisma.authSession.findFirst({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  })

  return Boolean(session)
}

export async function revokeAuthSession(sessionId: string | null | undefined, revokedBy?: string | null) {
  if (!sessionId) {
    return
  }

  await prisma.authSession.updateMany({
    where: {
      id: sessionId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokedBy: revokedBy ?? null,
    },
  })
}

export async function revokeUserAuthSessions(options: {
  userId: string
  revokedBy?: string | null
  excludeSessionId?: string | null
}) {
  await prisma.authSession.updateMany({
    where: {
      userId: options.userId,
      revokedAt: null,
      ...(options.excludeSessionId ? { id: { not: options.excludeSessionId } } : {}),
    },
    data: {
      revokedAt: new Date(),
      revokedBy: options.revokedBy ?? null,
    },
  })
}
