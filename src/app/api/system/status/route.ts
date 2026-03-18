export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getEffectiveSystemSettings } from '@/lib/system-settings'
import { getFeatureFlags } from '@/lib/features'
import { requireApprovedUser } from '@/lib/rbac'

export const GET = requireApprovedUser()(async () => {
  const settings = await getEffectiveSystemSettings()
  const featureFlags = getFeatureFlags()

  return NextResponse.json({
    maintenanceMode: settings.maintenanceMode,
    featureFlags,
  })
})
