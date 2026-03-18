import { UserRole, type SystemSettings } from '@prisma/client'
import { prisma } from './prisma'

export interface EffectiveSystemSettings {
  googleSyncEnabled: boolean
  autoApproveUsers: boolean
  defaultUserRole: UserRole
  defaultVpnServerId: string | null
  sessionMaxAge: number
  certExpiryWarnDays: number
  maintenanceMode: boolean
  allowedDomain: string | null
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  return value === '1' || value.toLowerCase() === 'true'
}

function parseIntegerEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseRoleEnv(value: string | undefined, fallback: UserRole): UserRole {
  return value === UserRole.ADMIN || value === UserRole.VIEWER ? value : fallback
}

export function getSystemSettingsFallbacks(): EffectiveSystemSettings {
  return {
    googleSyncEnabled: parseBooleanEnv(process.env.GOOGLE_SYNC_ENABLED, false),
    autoApproveUsers: parseBooleanEnv(process.env.AUTO_APPROVE_USERS, false),
    defaultUserRole: parseRoleEnv(process.env.DEFAULT_USER_ROLE, UserRole.VIEWER),
    defaultVpnServerId: process.env.DEFAULT_VPN_SERVER_ID?.trim() || null,
    sessionMaxAge: parseIntegerEnv(process.env.SESSION_MAX_AGE, 24 * 60 * 60),
    certExpiryWarnDays: parseIntegerEnv(process.env.CERT_EXPIRY_WARN_DAYS, 30),
    maintenanceMode: parseBooleanEnv(process.env.MAINTENANCE_MODE, false),
    allowedDomain: process.env.GOOGLE_ALLOWED_DOMAIN?.trim() || null,
  }
}

export async function getEffectiveSystemSettings(): Promise<EffectiveSystemSettings> {
  const fallbacks = getSystemSettingsFallbacks()
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'global' },
  })

  if (!settings) {
    return fallbacks
  }

  return {
    googleSyncEnabled: settings.googleSyncEnabled,
    autoApproveUsers: settings.autoApproveUsers,
    defaultUserRole: settings.defaultUserRole,
    defaultVpnServerId: settings.defaultVpnServerId ?? fallbacks.defaultVpnServerId,
    sessionMaxAge: settings.sessionMaxAge,
    certExpiryWarnDays: settings.certExpiryWarnDays,
    maintenanceMode: settings.maintenanceMode,
    allowedDomain: fallbacks.allowedDomain,
  }
}

export async function upsertSystemSettings(
  data: Pick<
    SystemSettings,
    'googleSyncEnabled' | 'autoApproveUsers' | 'defaultUserRole' | 'defaultVpnServerId' | 'sessionMaxAge' | 'certExpiryWarnDays' | 'maintenanceMode'
  >
) {
  return prisma.systemSettings.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      ...data,
    },
    update: data,
  })
}
