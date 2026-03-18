import { AuthRateLimitScope } from '@prisma/client'
import { prisma } from './prisma'

const WINDOW_MS = 15 * 60 * 1000
const LOCKOUT_MS = 15 * 60 * 1000
const MAX_ATTEMPTS_PER_EMAIL = 5
const MAX_ATTEMPTS_PER_IP = 20

function normalizeKey(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim().toLowerCase()
  return normalized && normalized.length > 0 ? normalized : fallback
}

function getScopeKey(scope: AuthRateLimitScope, value: string | null) {
  return normalizeKey(value, scope === AuthRateLimitScope.EMAIL ? 'unknown-email' : 'unknown-ip')
}

async function getRecord(scopeType: AuthRateLimitScope, scopeKey: string) {
  return prisma.authRateLimit.findUnique({
    where: {
      scopeType_scopeKey: {
        scopeType,
        scopeKey,
      },
    },
  })
}

export async function canAttemptLogin(email: string, ip: string | null, now?: number) {
  const currentTime = new Date(now ?? Date.now())
  const checks: Array<[AuthRateLimitScope, string]> = [
    [AuthRateLimitScope.EMAIL, getScopeKey(AuthRateLimitScope.EMAIL, email)],
  ]

  if (ip) {
    checks.push([AuthRateLimitScope.IP, getScopeKey(AuthRateLimitScope.IP, ip)])
  }

  const records = await Promise.all(checks.map(([scopeType, scopeKey]) => getRecord(scopeType, scopeKey)))
  return records.every((record) => !record?.lockedUntil || record.lockedUntil <= currentTime)
}

async function upsertFailure(scopeType: AuthRateLimitScope, rawKey: string | null, maxAttempts: number, now: Date) {
  const scopeKey = getScopeKey(scopeType, rawKey)
  const record = await getRecord(scopeType, scopeKey)

  if (!record) {
    return prisma.authRateLimit.create({
      data: {
        scopeType,
        scopeKey,
        failures: 1,
        windowStart: now,
        lastAttemptAt: now,
        lockedUntil: maxAttempts <= 1 ? new Date(now.getTime() + LOCKOUT_MS) : null,
      },
    })
  }

  const windowExpired = now.getTime() - record.windowStart.getTime() > WINDOW_MS
  const lockoutExpired = record.lockedUntil !== null && record.lockedUntil <= now
  const nextFailures = windowExpired || lockoutExpired ? 1 : record.failures + 1
  const nextLockedUntil = nextFailures >= maxAttempts ? new Date(now.getTime() + LOCKOUT_MS) : null

  return prisma.authRateLimit.update({
    where: {
      scopeType_scopeKey: {
        scopeType,
        scopeKey,
      },
    },
    data: {
      failures: nextFailures,
      windowStart: windowExpired || lockoutExpired ? now : record.windowStart,
      lastAttemptAt: now,
      lockedUntil: nextLockedUntil,
    },
  })
}

export async function recordFailedLoginAttempt(email: string, ip: string | null, now?: number) {
  const currentTime = new Date(now ?? Date.now())

  await upsertFailure(AuthRateLimitScope.EMAIL, email, MAX_ATTEMPTS_PER_EMAIL, currentTime)
  if (ip) {
    await upsertFailure(AuthRateLimitScope.IP, ip, MAX_ATTEMPTS_PER_IP, currentTime)
  }
}

export async function clearFailedLoginAttempts(email: string, ip: string | null) {
  await prisma.authRateLimit.deleteMany({
    where: {
      OR: [
        {
          scopeType: AuthRateLimitScope.EMAIL,
          scopeKey: getScopeKey(AuthRateLimitScope.EMAIL, email),
        },
        ...(ip
          ? [{
              scopeType: AuthRateLimitScope.IP,
              scopeKey: getScopeKey(AuthRateLimitScope.IP, ip),
            }]
          : []),
      ],
    },
  })
}

export async function resetLoginRateLimitState() {
  await prisma.authRateLimit.deleteMany()
}

export const loginRateLimitConfig = {
  windowMs: WINDOW_MS,
  lockoutMs: LOCKOUT_MS,
  maxAttemptsPerEmail: MAX_ATTEMPTS_PER_EMAIL,
  maxAttemptsPerIp: MAX_ATTEMPTS_PER_IP,
}
