import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  compare,
  canAttemptLogin,
  clearFailedLoginAttempts,
  recordFailedLoginAttempt,
  authenticateWithLdap,
  isLdapEnabled,
  prisma,
} = vi.hoisted(() => ({
  compare: vi.fn(),
  canAttemptLogin: vi.fn(),
  clearFailedLoginAttempts: vi.fn(),
  recordFailedLoginAttempt: vi.fn(),
  authenticateWithLdap: vi.fn(),
  isLdapEnabled: vi.fn(),
  prisma: {
    adminUser: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    vpnServer: {
      findFirst: vi.fn(),
    },
    accessRequest: {
      create: vi.fn(),
    },
    loginHistory: {
      create: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  compare,
}))

vi.mock('./login-rate-limit', () => ({
  canAttemptLogin,
  clearFailedLoginAttempts,
  recordFailedLoginAttempt,
}))

vi.mock('./ldap', () => ({
  authenticateWithLdap,
  getLdapConfig: vi.fn(() => ({
    syncRoles: true,
  })),
  isLdapEnabled,
  resolveLdapRole: vi.fn((groups: string[]) => {
    if (groups.includes('cn=vpn-admins,ou=groups,dc=example,dc=com')) {
      return 'ADMIN'
    }
    if (groups.includes('cn=vpn-users,ou=groups,dc=example,dc=com')) {
      return 'VIEWER'
    }
    return null
  }),
}))

vi.mock('./prisma', () => ({
  prisma,
}))

vi.mock('./system-settings', async () => {
  const actual = await vi.importActual<typeof import('./system-settings')>('./system-settings')
  return {
    ...actual,
    getEffectiveSystemSettings: vi.fn(async () => ({
      googleSyncEnabled: false,
      autoApproveUsers: true,
      defaultUserRole: 'VIEWER',
      sessionMaxAge: 86400,
      certExpiryWarnDays: 30,
      maintenanceMode: false,
      allowedDomain: 'example.com',
    })),
    getSystemSettingsFallbacks: vi.fn(() => ({
      googleSyncEnabled: false,
      autoApproveUsers: true,
      defaultUserRole: 'VIEWER',
      sessionMaxAge: 86400,
      certExpiryWarnDays: 30,
      maintenanceMode: false,
      allowedDomain: 'example.com',
    })),
  }
})

import { authorizeCredentialsSignIn } from './auth'

describe('LDAP credentials auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canAttemptLogin.mockResolvedValue(true)
    compare.mockResolvedValue(false)
    isLdapEnabled.mockReturnValue(true)
    prisma.adminUser.findUnique.mockResolvedValue(null)
    prisma.adminUser.create.mockResolvedValue({
      id: 'admin-user-1',
      email: 'ldap.user@example.com',
      role: 'VIEWER',
      isApproved: true,
    })
    prisma.vpnServer.findFirst.mockResolvedValue({
      id: 'server-1',
    })
    prisma.accessRequest.create.mockResolvedValue({})
  })

  it('provisions and signs in an LDAP user when local credentials are absent', async () => {
    authenticateWithLdap.mockResolvedValue({
      dn: 'uid=ldap.user,ou=people,dc=example,dc=com',
      email: 'ldap.user@example.com',
      displayName: 'LDAP User',
      groups: ['cn=vpn-admins,ou=groups,dc=example,dc=com'],
    })

    const result = await authorizeCredentialsSignIn({
      email: 'ldap.user@example.com',
      password: 'pw',
    })

    expect(authenticateWithLdap).toHaveBeenCalledWith('ldap.user@example.com', 'pw')
    expect(prisma.adminUser.create).toHaveBeenCalledWith({
      data: {
        email: 'ldap.user@example.com',
        role: 'ADMIN',
        isApproved: true,
      },
    })
    expect(prisma.accessRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'ldap.user@example.com',
        name: 'LDAP User',
        serverId: 'server-1',
      }),
    })
    expect(clearFailedLoginAttempts).toHaveBeenCalledWith('ldap.user@example.com', null)
    expect(result).toMatchObject({
      email: 'ldap.user@example.com',
      authMethod: 'ldap',
      isApproved: true,
    })
  })

  it('prefers local credentials when the local password matches', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 'local-user',
      email: 'admin@example.com',
      password: 'hash',
      role: 'ADMIN',
      isApproved: true,
    })
    compare.mockResolvedValue(true)

    const result = await authorizeCredentialsSignIn({
      email: 'admin@example.com',
      password: 'pw',
    })

    expect(authenticateWithLdap).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      id: 'local-user',
      email: 'admin@example.com',
      authMethod: 'credentials',
    })
  })

  it('records a failed attempt when both local and LDAP auth fail', async () => {
    authenticateWithLdap.mockResolvedValue(null)

    const result = await authorizeCredentialsSignIn({
      email: 'missing@example.com',
      password: 'bad',
    })

    expect(result).toBeNull()
    expect(recordFailedLoginAttempt).toHaveBeenCalledWith('missing@example.com', null)
  })

  it('updates an existing user role from LDAP groups when role sync is enabled', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 'existing-user',
      email: 'ldap.user@example.com',
      password: null,
      role: 'VIEWER',
      isApproved: true,
    })
    prisma.adminUser.update.mockResolvedValue({
      id: 'existing-user',
      email: 'ldap.user@example.com',
      role: 'ADMIN',
      isApproved: true,
    })
    authenticateWithLdap.mockResolvedValue({
      dn: 'uid=ldap.user,ou=people,dc=example,dc=com',
      email: 'ldap.user@example.com',
      displayName: 'LDAP User',
      groups: ['cn=vpn-admins,ou=groups,dc=example,dc=com'],
    })

    const result = await authorizeCredentialsSignIn({
      email: 'ldap.user@example.com',
      password: 'pw',
    })

    expect(prisma.adminUser.update).toHaveBeenCalledWith({
      where: { id: 'existing-user' },
      data: { role: 'ADMIN' },
    })
    expect(result).toMatchObject({
      email: 'ldap.user@example.com',
      role: 'ADMIN',
      authMethod: 'ldap',
    })
  })
})
