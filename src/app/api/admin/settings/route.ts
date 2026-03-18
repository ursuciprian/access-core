export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod/v4'
import { authOptions } from '@/lib/auth'
import { getEffectiveSystemSettings, upsertSystemSettings } from '@/lib/system-settings'
import { logAudit } from '@/lib/audit'
import { getFeatureFlags } from '@/lib/features'
import { getLdapConfig } from '@/lib/ldap'

const updateSettingsSchema = z.object({
  googleSyncEnabled: z.boolean(),
  autoApproveUsers: z.boolean(),
  defaultUserRole: z.enum(['ADMIN', 'VIEWER']),
  defaultVpnServerId: z.string().trim().min(1).nullable(),
  sessionMaxAgeHours: z.number().int().min(1).max(24 * 30),
  certExpiryWarnDays: z.number().int().min(1).max(365),
  maintenanceMode: z.boolean(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const settings = await getEffectiveSystemSettings()
  const featureFlags = getFeatureFlags()
  const ldapConfig = getLdapConfig()
  const { prisma } = await import('@/lib/prisma')
  const servers = await prisma.vpnServer.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      hostname: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    googleSyncEnabled: settings.googleSyncEnabled,
    autoApproveUsers: settings.autoApproveUsers,
    defaultUserRole: settings.defaultUserRole,
    defaultVpnServerId: settings.defaultVpnServerId,
    sessionMaxAgeHours: Math.max(1, Math.round(settings.sessionMaxAge / 3600)),
    certExpiryWarnDays: settings.certExpiryWarnDays,
    maintenanceMode: settings.maintenanceMode,
    allowedDomain: settings.allowedDomain,
    availableVpnServers: servers,
    featureFlags,
    ldap: ldapConfig ? {
      enabled: true,
      url: ldapConfig.url,
      bindDn: ldapConfig.bindDn,
      baseDn: ldapConfig.baseDn,
      userFilter: ldapConfig.userFilter,
      emailAttribute: ldapConfig.emailAttribute,
      displayNameAttribute: ldapConfig.displayNameAttribute,
      groupAttribute: ldapConfig.groupAttribute,
      adminGroups: ldapConfig.adminGroups,
      viewerGroups: ldapConfig.viewerGroups,
      syncRoles: ldapConfig.syncRoles,
      startTls: ldapConfig.startTls,
      tlsRejectUnauthorized: ldapConfig.tlsRejectUnauthorized,
    } : {
      enabled: false,
      url: null,
      bindDn: null,
      baseDn: null,
      userFilter: null,
      emailAttribute: null,
      displayNameAttribute: null,
      groupAttribute: null,
      adminGroups: [],
      viewerGroups: [],
      syncRoles: false,
      startTls: false,
      tlsRejectUnauthorized: true,
    },
  })
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  await upsertSystemSettings({
    googleSyncEnabled: parsed.data.googleSyncEnabled,
    autoApproveUsers: parsed.data.autoApproveUsers,
    defaultUserRole: parsed.data.defaultUserRole,
    defaultVpnServerId: parsed.data.defaultVpnServerId,
    sessionMaxAge: parsed.data.sessionMaxAgeHours * 3600,
    certExpiryWarnDays: parsed.data.certExpiryWarnDays,
    maintenanceMode: parsed.data.maintenanceMode,
  })

  await logAudit({
    action: 'SETTINGS_UPDATED',
    actorEmail: session.user.email,
    targetType: 'ADMIN_USER',
    targetId: session.user.email,
    details: parsed.data,
  })

  return NextResponse.json({ success: true })
}
