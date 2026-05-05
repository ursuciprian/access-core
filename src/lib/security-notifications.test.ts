import { buildSecurityNotifications } from './security-notifications'

describe('buildSecurityNotifications', () => {
  it('prioritizes critical security operations before review queues', () => {
    const notifications = buildSecurityNotifications({
      pendingPortalUsers: 2,
      pendingVpnRequests: 3,
      failedProvisioning: 1,
      failedSyncJobs: 1,
      expiringCertificates: 4,
      flaggedUsers: 1,
      recentDnsFailures: 0,
    })

    expect(notifications.map((item) => item.id)).toEqual([
      'failed-provisioning',
      'flagged-users',
      'pending-portal-users',
      'pending-vpn-requests',
      'expiring-certificates',
      'failed-sync-jobs',
    ])
  })

  it('does not create empty notifications', () => {
    expect(buildSecurityNotifications({
      pendingPortalUsers: 0,
      pendingVpnRequests: 0,
      failedProvisioning: 0,
      failedSyncJobs: 0,
      expiringCertificates: 0,
      flaggedUsers: 0,
      recentDnsFailures: 0,
    })).toEqual([])
  })
})
