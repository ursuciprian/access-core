import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import type { OAuthConfig } from 'next-auth/providers/oauth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { UserRole } from '@prisma/client'
import { AsyncLocalStorage } from 'node:async_hooks'
import { getEffectiveSystemSettings, getSystemSettingsFallbacks } from './system-settings'
import { authenticateWithLdap, getLdapConfig, isLdapEnabled, resolveLdapRole } from './ldap'
import {
  canAttemptLogin,
  clearFailedLoginAttempts,
  recordFailedLoginAttempt,
} from './login-rate-limit'
import {
  createAuthSession,
  isAuthSessionActive,
  revokeAuthSession,
} from './auth-session'

interface AuthRequestMetadata {
  ip: string | null
  userAgent: string | null
}

const authRequestContext = new AsyncLocalStorage<AuthRequestMetadata>()

function getRequestHeader(headers: Headers, name: string): string | null {
  const value = headers.get(name)?.trim()
  return value ? value : null
}

function trustProxyHeaders() {
  return process.env.TRUST_PROXY_HEADERS === 'true'
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isGoogleSignInAllowed(email: string | null | undefined, options?: {
  allowedDomain?: string | null
}) {
  const normalizedEmail = email ? normalizeEmail(email) : null
  if (!normalizedEmail) {
    return false
  }

  const allowedDomain = options?.allowedDomain?.trim().toLowerCase() || null

  if (!allowedDomain) {
    return false
  }

  const emailDomain = normalizedEmail.split('@')[1] ?? ''
  return emailDomain === allowedDomain
}

function isEmailLike(value: string | null | undefined): value is string {
  if (!value) {
    return false
  }

  const [localPart, domain] = value.trim().split('@')
  return Boolean(localPart) && Boolean(domain)
}

function parseAllowedDomains(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
}

function isVerifiedIdentityClaim(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value === 1
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1'
  }

  return false
}

export function isOidcSignInAllowed(options: {
  email: string | null | undefined
  allowedDomains?: string[]
  emailVerified?: unknown
}) {
  const normalizedEmail = options.email ? normalizeEmail(options.email) : null
  if (!isEmailLike(normalizedEmail)) {
    return false
  }

  if (!isVerifiedIdentityClaim(options.emailVerified)) {
    return false
  }

  return isEmailAllowedByDomains(normalizedEmail, options.allowedDomains ?? [])
}

function isEmailAllowedByDomains(email: string | null | undefined, allowedDomains: string[]): boolean {
  const normalizedEmail = email ? normalizeEmail(email) : null
  if (!normalizedEmail) {
    return false
  }

  if (allowedDomains.length === 0) {
    return true
  }

  const emailDomain = normalizedEmail.split('@')[1] ?? ''
  return allowedDomains.includes(emailDomain)
}

function isOidcSsoEnabled(): boolean {
  return process.env.OIDC_SSO_ENABLED === 'true'
    && Boolean(process.env.OIDC_ISSUER?.trim())
    && Boolean(process.env.OIDC_CLIENT_ID?.trim())
    && Boolean(process.env.OIDC_CLIENT_SECRET?.trim())
}

function getOidcProviderName(): string {
  return process.env.OIDC_PROVIDER_NAME?.trim() || 'SSO'
}

function getOidcProvider(): OAuthConfig<Record<string, unknown>> {
  const issuer = process.env.OIDC_ISSUER!.trim()
  const wellKnown = issuer.endsWith('/.well-known/openid-configuration')
    ? issuer
    : `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`

  return {
    id: 'oidc',
    name: getOidcProviderName(),
    type: 'oauth',
    wellKnown,
    clientId: process.env.OIDC_CLIENT_ID!,
    clientSecret: process.env.OIDC_CLIENT_SECRET!,
    idToken: true,
    checks: ['pkce', 'state'],
    authorization: {
      params: {
        scope: process.env.OIDC_SCOPES?.trim() || 'openid email profile',
      },
    },
    profile(profile) {
      const email = typeof profile.email === 'string' ? profile.email : null

      return {
        id:
          (typeof profile.sub === 'string' && profile.sub)
          || (typeof profile.id === 'string' && profile.id)
          || email
          || crypto.randomUUID(),
        name:
          (typeof profile.name === 'string' && profile.name)
          || (typeof profile.preferred_username === 'string' && profile.preferred_username)
          || email,
        email,
      }
    },
  }
}

function parseClientIp(headers: Headers): string | null {
  if (!trustProxyHeaders()) {
    return null
  }

  const forwardedFor = getRequestHeader(headers, 'x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null
  }

  return getRequestHeader(headers, 'x-real-ip')
}

export async function withAuthRequestMetadata<T>(
  headers: Headers,
  callback: () => Promise<T>
): Promise<T> {
  const metadata: AuthRequestMetadata = {
    ip: parseClientIp(headers),
    userAgent: getRequestHeader(headers, 'user-agent'),
  }

  return authRequestContext.run(metadata, callback)
}

function getAuthRequestMetadata(): AuthRequestMetadata {
  return authRequestContext.getStore() ?? { ip: null, userAgent: null }
}

async function recordFailedLogin(email: string, reason: 'rate_limited' | 'invalid_credentials') {
  const { prisma } = await import('./prisma')
  const metadata = getAuthRequestMetadata()

  try {
    await prisma.auditLog.create({
      data: {
        action: 'LOGIN_FAILED',
        actorEmail: email,
        targetType: 'AUTH',
        targetId: email,
        details: {
          reason,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
        },
      },
    })
  } catch (_error) {
    // Don't block auth if audit logging fails
  }
}

async function recordLogin(userId: string, method: 'credentials' | 'google' | 'ldap' | 'sso') {
  const { prisma } = await import('./prisma')
  const metadata = getAuthRequestMetadata()

  try {
    await prisma.loginHistory.create({
      data: {
        userId,
        method,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      },
    })
    await prisma.adminUser.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    })
  } catch (_error) {
    // Don't block auth if login recording fails
  }
}

async function buildSessionExpiryTimestamp(): Promise<number> {
  const settings = await getEffectiveSystemSettings()
  return Date.now() + settings.sessionMaxAge * 1000
}

async function ensurePortalUser(email: string, name?: string | null, options?: {
  roleOverride?: UserRole | null
  syncRole?: boolean
}) {
  const { prisma } = await import('./prisma')
  const settings = await getEffectiveSystemSettings()
  const normalizedEmail = normalizeEmail(email)
  const desiredRole = options?.roleOverride ?? settings.defaultUserRole

  let adminUser = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
  })

  if (!adminUser) {
    adminUser = await prisma.adminUser.create({
      data: {
        email: normalizedEmail,
        role: desiredRole,
        isApproved: settings.autoApproveUsers,
      },
    })

    if (adminUser.role !== UserRole.ADMIN) {
      const defaultServer =
        (settings.defaultVpnServerId
          ? await prisma.vpnServer.findFirst({
              where: {
                id: settings.defaultVpnServerId,
                isActive: true,
              },
            })
          : null) ??
        await prisma.vpnServer.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        })

      if (defaultServer) {
        await prisma.accessRequest.create({
          data: {
            email: normalizedEmail,
            name: name || undefined,
            serverId: defaultServer.id,
            reason: 'Auto-created on first sign-in',
          },
        })
      }
    }
  } else if (options?.syncRole && options.roleOverride && adminUser.role !== options.roleOverride) {
    adminUser = await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { role: options.roleOverride },
    })
  }

  return adminUser
}

export async function authorizeCredentialsSignIn(credentials?: {
  email?: string | null
  password?: string | null
}) {
  if (!credentials?.email || !credentials?.password) {
    return null
  }

  const login = normalizeEmail(credentials.email)
  const metadata = getAuthRequestMetadata()
  if (!(await canAttemptLogin(login, metadata.ip))) {
    await recordFailedLogin(login, 'rate_limited')
    return null
  }

  const { prisma } = await import('./prisma')
  const adminUser = await prisma.adminUser.findUnique({
    where: { email: login },
  })

  if (adminUser?.password) {
    const isValid = await compare(credentials.password, adminUser.password)
    if (isValid) {
      await clearFailedLoginAttempts(login, metadata.ip)

      return {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        isApproved: adminUser.isApproved,
        authMethod: 'credentials',
        mfaEnabled: adminUser.mfaEnabled,
      }
    }
  }

  if (isLdapEnabled()) {
    try {
      const ldapIdentity = await authenticateWithLdap(login, credentials.password)
      if (ldapIdentity) {
        const ldapConfig = getLdapConfig()
        const mappedRole = resolveLdapRole(ldapIdentity.groups)
        const portalUser = await ensurePortalUser(ldapIdentity.email, ldapIdentity.displayName, {
          roleOverride: mappedRole ? UserRole[mappedRole] : null,
          syncRole: ldapConfig?.syncRoles ?? false,
        })
        await clearFailedLoginAttempts(login, metadata.ip)

        return {
          id: portalUser.id,
          email: portalUser.email,
          role: portalUser.role,
          isApproved: portalUser.isApproved,
          authMethod: 'ldap',
          mfaEnabled: portalUser.mfaEnabled,
        }
      }
    } catch (error) {
      console.error('LDAP authentication failed', {
        login,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  await recordFailedLoginAttempt(login, metadata.ip)
  await recordFailedLogin(login, 'invalid_credentials')
  return null
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        return authorizeCredentialsSignIn(credentials)
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    ...(isOidcSsoEnabled() ? [getOidcProvider()] : []),
  ],
  session: {
    strategy: 'jwt',
    maxAge: getSystemSettingsFallbacks().sessionMaxAge,
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const email = normalizeEmail(profile?.email ?? user.email ?? '')
        if (!isGoogleSignInAllowed(email, {
          allowedDomain: process.env.GOOGLE_ALLOWED_DOMAIN,
        })) {
          return false
        }

        user.email = email
      } else if (account?.provider === 'oidc') {
        const email = typeof profile?.email === 'string' ? profile.email : user.email
        const allowedDomains = parseAllowedDomains(process.env.OIDC_ALLOWED_DOMAINS)
        if (!isOidcSignInAllowed({
          email,
          allowedDomains,
          emailVerified: (profile as Record<string, unknown> | undefined)?.email_verified,
        })) {
          return false
        }

        user.email = normalizeEmail(email!)
      }
      return true
    },
    async jwt({ token, user, account, trigger, session }) {
      if (trigger === 'update') {
        if (typeof (session as Record<string, unknown> | undefined)?.mfaVerified === 'boolean') {
          token.mfaVerified = Boolean((session as Record<string, unknown>).mfaVerified)
        }
        if (typeof (session as Record<string, unknown> | undefined)?.mfaEnabled === 'boolean') {
          token.mfaEnabled = Boolean((session as Record<string, unknown>).mfaEnabled)
        }
      }

      const metadata = getAuthRequestMetadata()

      if (account?.provider === 'credentials' && user && 'role' in user) {
        const sessionExpiresAt = await buildSessionExpiryTimestamp()
        token.role = user.role
        token.isApproved = Boolean((user as Record<string, unknown>).isApproved)
        token.userId = user.id
        token.mfaEnabled = Boolean((user as Record<string, unknown>).mfaEnabled)
        token.mfaVerified = !Boolean((user as Record<string, unknown>).mfaEnabled)
        token.sessionExpiresAt = sessionExpiresAt
        token.authSessionId = await createAuthSession({
          userId: user.id,
          method: ((user as Record<string, unknown>).authMethod as 'credentials' | 'ldap' | undefined) ?? 'credentials',
          expiresAt: sessionExpiresAt,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
        })
        await recordLogin(
          user.id,
          ((user as Record<string, unknown>).authMethod as 'credentials' | 'ldap' | undefined) ?? 'credentials'
        )
      } else if (account?.provider === 'google' && user?.email) {
        const email = normalizeEmail(user.email)
        const settings = await getEffectiveSystemSettings()
        const adminUser = await ensurePortalUser(email, user.name)
        const sessionExpiresAt = Date.now() + settings.sessionMaxAge * 1000

        token.role = adminUser.role
        token.isApproved = adminUser.isApproved
        token.userId = adminUser.id
        token.mfaEnabled = adminUser.mfaEnabled
        token.mfaVerified = !adminUser.mfaEnabled
        token.sessionExpiresAt = sessionExpiresAt
        token.authSessionId = await createAuthSession({
          userId: adminUser.id,
          method: 'google',
          expiresAt: sessionExpiresAt,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
        })
        await recordLogin(adminUser.id, 'google')
      } else if (account?.provider === 'oidc' && user?.email) {
        const email = normalizeEmail(user.email)
        const settings = await getEffectiveSystemSettings()
        const adminUser = await ensurePortalUser(email, user.name)
        const sessionExpiresAt = Date.now() + settings.sessionMaxAge * 1000

        token.role = adminUser.role
        token.isApproved = adminUser.isApproved
        token.userId = adminUser.id
        token.mfaEnabled = adminUser.mfaEnabled
        token.mfaVerified = !adminUser.mfaEnabled
        token.sessionExpiresAt = sessionExpiresAt
        token.authSessionId = await createAuthSession({
          userId: adminUser.id,
          method: 'sso',
          expiresAt: sessionExpiresAt,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
        })
        await recordLogin(adminUser.id, 'sso')
      } else if (token.email) {
        // Re-check role and approval status from DB on each token refresh
        const { prisma } = await import('./prisma')
        const adminUser = await prisma.adminUser.findUnique({
          where: { email: normalizeEmail(token.email as string) },
        })
        if (!adminUser) {
          return {}
        }

        const sessionIsActive = await isAuthSessionActive(
          typeof token.authSessionId === 'string' ? token.authSessionId : null,
          adminUser.id
        )
        if (!sessionIsActive) {
          return {}
        }

        token.role = adminUser.role
        token.isApproved = adminUser.isApproved
        token.userId = adminUser.id
        token.mfaEnabled = adminUser.mfaEnabled
        if (!adminUser.mfaEnabled) {
          token.mfaVerified = true
        } else if (typeof token.mfaVerified !== 'boolean') {
          token.mfaVerified = false
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as Record<string, unknown>).id = token.userId as string | undefined
        (session.user as Record<string, unknown>).role = token.role
        ;(session.user as Record<string, unknown>).isApproved = token.isApproved
        ;(session.user as Record<string, unknown>).sessionExpiresAt = token.sessionExpiresAt as number | undefined
        ;(session.user as Record<string, unknown>).mfaEnabled = Boolean(token.mfaEnabled)
        ;(session.user as Record<string, unknown>).mfaVerified = Boolean(token.mfaVerified ?? !token.mfaEnabled)
        ;(session.user as Record<string, unknown>).authSessionId = token.authSessionId as string | undefined
      }
      return session
    },
  },
  events: {
    async signOut(message) {
      const token = 'token' in message ? message.token as Record<string, unknown> | null : null
      await revokeAuthSession(
        typeof token?.authSessionId === 'string' ? token.authSessionId : null,
        typeof token?.email === 'string' ? token.email : null
      )
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
}
