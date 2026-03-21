import { buildDashboardAlerts } from '@/lib/dashboard-alerts'

describe('buildDashboardAlerts', () => {
  it('builds ordered actionable alerts for the main risk signals', () => {
    const alerts = buildDashboardAlerts({
      certWarningDays: 30,
      expiringCertCount: 4,
      earliestExpiringCert: {
        commonName: 'alice',
        certExpiresAt: '2026-04-01T00:00:00.000Z',
      },
      failedProvisioningCount: 2,
      oldestFailedProvisioning: {
        email: 'bob@example.com',
        serverName: 'Prod VPN',
      },
      flaggedUserCount: 1,
      latestFlaggedUser: {
        commonName: 'charlie',
        serverName: 'Ops VPN',
      },
      disabledUserCount: 3,
      stalePendingRequestCount: 1,
      staleProcessingRequestCount: 2,
    })

    expect(alerts.map((alert) => alert.id)).toEqual([
      'failed-provisioning',
      'flagged-users',
      'stale-requests',
      'expiring-certs',
      'disabled-users',
    ])
    expect(alerts[0]).toMatchObject({
      severity: 'critical',
      href: '/access-requests',
      ctaLabel: 'Review Requests',
    })
    expect(alerts[3].message).toContain('Earliest known expiry: alice')
  })

  it('omits alerts whose counts are zero', () => {
    const alerts = buildDashboardAlerts({
      certWarningDays: 30,
      expiringCertCount: 0,
      failedProvisioningCount: 0,
      flaggedUserCount: 0,
      disabledUserCount: 0,
      stalePendingRequestCount: 0,
      staleProcessingRequestCount: 0,
    })

    expect(alerts).toEqual([])
  })

  it('describes stale pending and processing requests together', () => {
    const alerts = buildDashboardAlerts({
      certWarningDays: 30,
      expiringCertCount: 0,
      failedProvisioningCount: 0,
      flaggedUserCount: 0,
      disabledUserCount: 0,
      stalePendingRequestCount: 2,
      staleProcessingRequestCount: 1,
    })

    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({
      id: 'stale-requests',
      severity: 'warning',
      count: 3,
    })
    expect(alerts[0].message).toContain('2 pending >24h')
    expect(alerts[0].message).toContain('1 processing >30m')
  })
})
