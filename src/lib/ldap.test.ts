import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { startTLS, bind, search, unbind, Client } = vi.hoisted(() => {
  return {
    startTLS: vi.fn(),
    bind: vi.fn(),
    search: vi.fn(),
    unbind: vi.fn(),
    Client: vi.fn(function ClientMock() {
      return {
        startTLS,
        bind,
        search,
        unbind,
      }
    }),
  }
})

vi.mock('ldapts', () => ({
  Client,
}))

import { authenticateWithLdap, getLdapConfig, isLdapEnabled } from './ldap'

describe('ldap helpers', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.LDAP_ENABLED = 'true'
    process.env.LDAP_URL = 'ldaps://ldap.example.com:636'
    process.env.LDAP_BIND_DN = 'cn=svc,dc=example,dc=com'
    process.env.LDAP_BIND_PASSWORD = 'secret'
    process.env.LDAP_BASE_DN = 'dc=example,dc=com'
    process.env.LDAP_USER_FILTER = '(&(objectClass=person)(mail={{login}}))'
    process.env.LDAP_EMAIL_ATTRIBUTE = 'mail'
    process.env.LDAP_DISPLAY_NAME_ATTRIBUTE = 'displayName'
    process.env.LDAP_STARTTLS = 'false'
    process.env.LDAP_TLS_REJECT_UNAUTHORIZED = 'true'
    process.env.LDAP_CONNECT_TIMEOUT_MS = '5000'
    process.env.LDAP_TIMEOUT_MS = '10000'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('detects when LDAP is enabled', () => {
    expect(isLdapEnabled()).toBe(true)
    expect(getLdapConfig()).toMatchObject({
      url: 'ldaps://ldap.example.com:636',
      baseDn: 'dc=example,dc=com',
      bindDn: 'cn=svc,dc=example,dc=com',
    })
  })

  it('returns null when LDAP is not configured', async () => {
    process.env.LDAP_ENABLED = 'false'

    expect(isLdapEnabled()).toBe(false)
    await expect(authenticateWithLdap('user@example.com', 'pw')).resolves.toBeNull()
  })

  it('searches and binds with the discovered user DN', async () => {
    search.mockResolvedValue({
      searchEntries: [
        {
          dn: 'uid=user,ou=people,dc=example,dc=com',
          mail: 'user@example.com',
          displayName: 'Example User',
          memberOf: ['cn=vpn-admins,ou=groups,dc=example,dc=com'],
        },
      ],
      searchReferences: [],
    })

    await expect(authenticateWithLdap('user@example.com', 'pw')).resolves.toEqual({
      dn: 'uid=user,ou=people,dc=example,dc=com',
      email: 'user@example.com',
      displayName: 'Example User',
      groups: ['cn=vpn-admins,ou=groups,dc=example,dc=com'],
    })

    expect(bind).toHaveBeenNthCalledWith(1, 'cn=svc,dc=example,dc=com', 'secret')
    expect(search).toHaveBeenCalledWith(
      'dc=example,dc=com',
      expect.objectContaining({
        filter: '(&(objectClass=person)(mail=user@example.com))',
      })
    )
    expect(bind).toHaveBeenNthCalledWith(2, 'uid=user,ou=people,dc=example,dc=com', 'pw')
    expect(unbind).toHaveBeenCalledOnce()
  })

  it('escapes user input in the LDAP filter', async () => {
    search.mockResolvedValue({ searchEntries: [], searchReferences: [] })

    await authenticateWithLdap('user*)(mail=*)', 'pw')

    expect(search).toHaveBeenCalledWith(
      'dc=example,dc=com',
      expect.objectContaining({
        filter: '(&(objectClass=person)(mail=user\\2a\\29\\28mail=\\2a\\29))',
      })
    )
  })

  it('returns null for invalid credentials', async () => {
    search.mockResolvedValue({
      searchEntries: [
        {
          dn: 'uid=user,ou=people,dc=example,dc=com',
          mail: 'user@example.com',
          memberOf: ['cn=vpn-users,ou=groups,dc=example,dc=com'],
        },
      ],
      searchReferences: [],
    })
    bind
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Invalid Credentials'))

    await expect(authenticateWithLdap('user@example.com', 'badpw')).resolves.toBeNull()
  })
})
