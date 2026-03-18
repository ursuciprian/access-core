export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { requireAdmin } from '@/lib/rbac'
import { getLdapConfig, inspectLdapIdentity, resolveLdapRole, testLdapConnectivity } from '@/lib/ldap'

const ldapTestSchema = z.object({
  login: z.string().trim().min(1).max(200).optional(),
})

export const POST = requireAdmin()(async (request: NextRequest) => {
  const body = await request.json().catch(() => ({}))
  const parsed = ldapTestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const config = getLdapConfig()
  if (!config) {
    return NextResponse.json({ error: 'LDAP is disabled by environment configuration' }, { status: 409 })
  }

  try {
    await testLdapConnectivity()

    if (!parsed.data.login) {
      return NextResponse.json({
        ok: true,
        mode: 'connectivity',
        message: 'Successfully connected to LDAP and completed the service bind.',
      })
    }

    const identity = await inspectLdapIdentity(parsed.data.login)
    if (!identity) {
      return NextResponse.json({
        ok: true,
        mode: 'lookup',
        found: false,
        message: 'LDAP is reachable, but no matching user was found for that login.',
      })
    }

    return NextResponse.json({
      ok: true,
      mode: 'lookup',
      found: true,
      identity: {
        dn: identity.dn,
        email: identity.email,
        displayName: identity.displayName,
        groups: identity.groups,
        mappedRole: resolveLdapRole(identity.groups),
      },
    })
  } catch (error) {
    console.error('LDAP diagnostics failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'LDAP diagnostics failed' }, { status: 500 })
  }
})
