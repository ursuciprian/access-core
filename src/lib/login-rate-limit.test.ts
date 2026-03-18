const { store, prismaMock } = vi.hoisted(() => {
  const store = new Map<string, any>()

  function getKey(scopeType: string, scopeKey: string) {
    return `${scopeType}:${scopeKey}`
  }

  return {
    store,
    prismaMock: {
      authRateLimit: {
        findUnique: vi.fn(async ({ where }: any) => {
          const key = getKey(
            where.scopeType_scopeKey.scopeType,
            where.scopeType_scopeKey.scopeKey
          )
          return store.get(key) ?? null
        }),
        create: vi.fn(async ({ data }: any) => {
          const key = getKey(data.scopeType, data.scopeKey)
          const record = {
            id: key,
            createdAt: data.windowStart,
            updatedAt: data.lastAttemptAt,
            ...data,
          }
          store.set(key, record)
          return record
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const key = getKey(
            where.scopeType_scopeKey.scopeType,
            where.scopeType_scopeKey.scopeKey
          )
          const record = {
            ...store.get(key),
            ...data,
            updatedAt: data.lastAttemptAt ?? new Date(),
          }
          store.set(key, record)
          return record
        }),
        deleteMany: vi.fn(async ({ where }: any = {}) => {
          if (!where) {
            const count = store.size
            store.clear()
            return { count }
          }

          let count = 0
          const conditions = where.OR ?? []
          for (const condition of conditions) {
            const key = getKey(condition.scopeType, condition.scopeKey)
            if (store.delete(key)) {
              count += 1
            }
          }
          return { count }
        }),
      },
    },
  }
})

vi.mock('./prisma', () => ({
  prisma: prismaMock,
}))

import {
  canAttemptLogin,
  clearFailedLoginAttempts,
  loginRateLimitConfig,
  recordFailedLoginAttempt,
  resetLoginRateLimitState,
} from './login-rate-limit'

describe('login rate limiting', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    store.clear()
    await resetLoginRateLimitState()
  })

  it('locks an email after repeated failures', async () => {
    const email = 'user@example.com'
    const ip = '127.0.0.1'

    for (let attempt = 0; attempt < loginRateLimitConfig.maxAttemptsPerEmail; attempt += 1) {
      await expect(canAttemptLogin(email, ip)).resolves.toBe(true)
      await recordFailedLoginAttempt(email, ip)
    }

    await expect(canAttemptLogin(email, ip)).resolves.toBe(false)
  })

  it('locks an IP after repeated failures across accounts', async () => {
    const ip = '127.0.0.2'

    for (let attempt = 0; attempt < loginRateLimitConfig.maxAttemptsPerIp; attempt += 1) {
      await recordFailedLoginAttempt(`user${attempt}@example.com`, ip)
    }

    await expect(canAttemptLogin('fresh@example.com', ip)).resolves.toBe(false)
  })

  it('clears rate limit state after a successful login', async () => {
    const email = 'user@example.com'
    const ip = '127.0.0.3'

    await recordFailedLoginAttempt(email, ip)
    await clearFailedLoginAttempts(email, ip)

    await expect(canAttemptLogin(email, ip)).resolves.toBe(true)
  })

  it('expires lockouts after the configured time window', async () => {
    const email = 'user@example.com'
    const ip = '127.0.0.4'
    const start = 1_000

    for (let attempt = 0; attempt < loginRateLimitConfig.maxAttemptsPerEmail; attempt += 1) {
      await recordFailedLoginAttempt(email, ip, start)
    }

    await expect(canAttemptLogin(email, ip, start + 1)).resolves.toBe(false)
    await expect(
      canAttemptLogin(email, ip, start + loginRateLimitConfig.lockoutMs + 1)
    ).resolves.toBe(true)
  })
})
