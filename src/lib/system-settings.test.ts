const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    systemSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock('./prisma', () => ({
  prisma: prismaMock,
}))

import { UserRole } from '@prisma/client'
import { getEffectiveSystemSettings } from './system-settings'

describe('getEffectiveSystemSettings', () => {
  const originalEnv = {
    GOOGLE_SYNC_ENABLED: process.env.GOOGLE_SYNC_ENABLED,
    AUTO_APPROVE_USERS: process.env.AUTO_APPROVE_USERS,
    DEFAULT_USER_ROLE: process.env.DEFAULT_USER_ROLE,
    DEFAULT_VPN_SERVER_ID: process.env.DEFAULT_VPN_SERVER_ID,
    SESSION_MAX_AGE: process.env.SESSION_MAX_AGE,
    CERT_EXPIRY_WARN_DAYS: process.env.CERT_EXPIRY_WARN_DAYS,
    MAINTENANCE_MODE: process.env.MAINTENANCE_MODE,
    GOOGLE_ALLOWED_DOMAIN: process.env.GOOGLE_ALLOWED_DOMAIN,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_SYNC_ENABLED = 'true'
    process.env.AUTO_APPROVE_USERS = 'false'
    process.env.DEFAULT_USER_ROLE = UserRole.ADMIN
    process.env.DEFAULT_VPN_SERVER_ID = 'server-1'
    process.env.SESSION_MAX_AGE = '3600'
    process.env.CERT_EXPIRY_WARN_DAYS = '15'
    process.env.MAINTENANCE_MODE = 'true'
    process.env.GOOGLE_ALLOWED_DOMAIN = 'example.com'
  })

  afterAll(() => {
    process.env.GOOGLE_SYNC_ENABLED = originalEnv.GOOGLE_SYNC_ENABLED
    process.env.AUTO_APPROVE_USERS = originalEnv.AUTO_APPROVE_USERS
    process.env.DEFAULT_USER_ROLE = originalEnv.DEFAULT_USER_ROLE
    process.env.DEFAULT_VPN_SERVER_ID = originalEnv.DEFAULT_VPN_SERVER_ID
    process.env.SESSION_MAX_AGE = originalEnv.SESSION_MAX_AGE
    process.env.CERT_EXPIRY_WARN_DAYS = originalEnv.CERT_EXPIRY_WARN_DAYS
    process.env.MAINTENANCE_MODE = originalEnv.MAINTENANCE_MODE
    process.env.GOOGLE_ALLOWED_DOMAIN = originalEnv.GOOGLE_ALLOWED_DOMAIN
  })

  it('returns environment fallbacks when the SystemSettings table is missing', async () => {
    prismaMock.systemSettings.findUnique.mockRejectedValue({
      code: 'P2021',
      message: 'The table `public.SystemSettings` does not exist in the current database.',
    })

    await expect(getEffectiveSystemSettings()).resolves.toEqual({
      googleSyncEnabled: true,
      autoApproveUsers: false,
      defaultUserRole: UserRole.ADMIN,
      defaultVpnServerId: 'server-1',
      sessionMaxAge: 3600,
      certExpiryWarnDays: 15,
      maintenanceMode: true,
      allowedDomain: 'example.com',
    })
  })
})
