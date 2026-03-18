import { Client } from 'ldapts'

export interface LdapConfig {
  enabled: boolean
  url: string
  bindDn: string | null
  bindPassword: string | null
  baseDn: string
  userFilter: string
  emailAttribute: string
  displayNameAttribute: string
  groupAttribute: string
  adminGroups: string[]
  viewerGroups: string[]
  syncRoles: boolean
  startTls: boolean
  tlsRejectUnauthorized: boolean
  connectTimeoutMs: number
  timeoutMs: number
}

export interface LdapIdentity {
  dn: string
  email: string
  displayName: string | null
  groups: string[]
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback
  }

  return value === '1' || value.toLowerCase() === 'true'
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function getLdapConfig(): LdapConfig | null {
  const enabled = parseBoolean(process.env.LDAP_ENABLED, false)
  if (!enabled) {
    return null
  }

  const url = process.env.LDAP_URL?.trim()
  const baseDn = process.env.LDAP_BASE_DN?.trim()

  if (!url || !baseDn) {
    return null
  }

  return {
    enabled,
    url,
    bindDn: process.env.LDAP_BIND_DN?.trim() || null,
    bindPassword: process.env.LDAP_BIND_PASSWORD ?? null,
    baseDn,
    userFilter: process.env.LDAP_USER_FILTER?.trim() || '(&(objectClass=person)(mail={{login}}))',
    emailAttribute: process.env.LDAP_EMAIL_ATTRIBUTE?.trim() || 'mail',
    displayNameAttribute: process.env.LDAP_DISPLAY_NAME_ATTRIBUTE?.trim() || 'displayName',
    groupAttribute: process.env.LDAP_GROUP_ATTRIBUTE?.trim() || 'memberOf',
    adminGroups: (process.env.LDAP_ADMIN_GROUPS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    viewerGroups: (process.env.LDAP_VIEWER_GROUPS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    syncRoles: parseBoolean(process.env.LDAP_SYNC_ROLES, true),
    startTls: parseBoolean(process.env.LDAP_STARTTLS, false),
    tlsRejectUnauthorized: parseBoolean(process.env.LDAP_TLS_REJECT_UNAUTHORIZED, true),
    connectTimeoutMs: parseInteger(process.env.LDAP_CONNECT_TIMEOUT_MS, 5000),
    timeoutMs: parseInteger(process.env.LDAP_TIMEOUT_MS, 10000),
  }
}

export function isLdapEnabled(): boolean {
  return getLdapConfig() !== null
}

function escapeFilterValue(value: string): string {
  return value
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00')
}

function renderFilter(template: string, login: string): string {
  return template.replace(/\{\{\s*login\s*\}\}/g, escapeFilterValue(login))
}

function readEntryAttribute(entry: Record<string, unknown>, attribute: string): string | null {
  const value = entry[attribute]

  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim())
    return typeof first === 'string' ? first.trim() : null
  }

  return null
}

function readEntryAttributeList(entry: Record<string, unknown>, attribute: string): string[] {
  const value = entry[attribute]

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeGroupName(value: string): string {
  return value.trim().toLowerCase()
}

export function resolveLdapRole(groups: string[]): 'ADMIN' | 'VIEWER' | null {
  const config = getLdapConfig()
  if (!config) {
    return null
  }

  const normalizedGroups = new Set(groups.map(normalizeGroupName))
  if (config.adminGroups.some((group) => normalizedGroups.has(group))) {
    return 'ADMIN'
  }

  if (config.viewerGroups.some((group) => normalizedGroups.has(group))) {
    return 'VIEWER'
  }

  return null
}

async function createConfiguredLdapClient(config: LdapConfig): Promise<Client> {
  const client = new Client({
    url: config.url,
    timeout: config.timeoutMs,
    connectTimeout: config.connectTimeoutMs,
    tlsOptions: {
      rejectUnauthorized: config.tlsRejectUnauthorized,
    },
  })

  if (config.startTls) {
    await client.startTLS({
      rejectUnauthorized: config.tlsRejectUnauthorized,
    })
  }

  if (config.bindDn && config.bindPassword) {
    await client.bind(config.bindDn, config.bindPassword)
  }

  return client
}

async function searchForIdentity(client: Client, config: LdapConfig, login: string): Promise<LdapIdentity | null> {
  const result = await client.search(config.baseDn, {
    scope: 'sub',
    filter: renderFilter(config.userFilter, login),
    sizeLimit: 2,
    timeLimit: Math.max(1, Math.ceil(config.timeoutMs / 1000)),
    attributes: [config.emailAttribute, config.displayNameAttribute, config.groupAttribute],
  })

  if (result.searchEntries.length !== 1) {
    return null
  }

  const entry = result.searchEntries[0] as Record<string, unknown> & { dn?: string }
  const userDn = typeof entry.dn === 'string' ? entry.dn : null
  if (!userDn) {
    return null
  }

  const email = readEntryAttribute(entry, config.emailAttribute) ?? login
  const displayName = readEntryAttribute(entry, config.displayNameAttribute)
  const groups = readEntryAttributeList(entry, config.groupAttribute)

  return {
    dn: userDn,
    email,
    displayName,
    groups,
  }
}

export async function inspectLdapIdentity(login: string): Promise<LdapIdentity | null> {
  const config = getLdapConfig()
  if (!config || !login) {
    return null
  }

  if (config.bindDn && !config.bindPassword) {
    throw new Error('LDAP_BIND_PASSWORD is required when LDAP_BIND_DN is configured')
  }

  const client = await createConfiguredLdapClient(config)

  try {
    return await searchForIdentity(client, config, login)
  } finally {
    try {
      await client.unbind()
    } catch {
      // Ignore cleanup failures.
    }
  }
}

export async function testLdapConnectivity(): Promise<void> {
  const config = getLdapConfig()
  if (!config) {
    throw new Error('LDAP is disabled')
  }

  if (config.bindDn && !config.bindPassword) {
    throw new Error('LDAP_BIND_PASSWORD is required when LDAP_BIND_DN is configured')
  }

  const client = await createConfiguredLdapClient(config)

  try {
    return
  } finally {
    try {
      await client.unbind()
    } catch {
      // Ignore cleanup failures.
    }
  }
}

export async function authenticateWithLdap(login: string, password: string): Promise<LdapIdentity | null> {
  const config = getLdapConfig()
  if (!config || !login || !password) {
    return null
  }

  if (config.bindDn && !config.bindPassword) {
    throw new Error('LDAP_BIND_PASSWORD is required when LDAP_BIND_DN is configured')
  }

  const client = await createConfiguredLdapClient(config)

  try {
    const identity = await searchForIdentity(client, config, login)
    if (!identity) {
      return null
    }

    await client.bind(identity.dn, password)

    return identity
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      if (
        message.includes('invalid credentials')
        || message.includes('invalid dn syntax')
        || message.includes('constraint violation')
      ) {
        return null
      }
    }

    throw error
  } finally {
    try {
      await client.unbind()
    } catch {
      // Ignore unbind failures during auth cleanup.
    }
  }
}
