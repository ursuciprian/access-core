export type SecurityNotificationSeverity = 'critical' | 'warning' | 'info'

export interface SecurityNotification {
  id: string
  severity: SecurityNotificationSeverity
  title: string
  message: string
  href: string
  count: number
}

export interface SecurityNotificationInput {
  pendingPortalUsers: number
  pendingVpnRequests: number
  failedProvisioning: number
  failedSyncJobs: number
  expiringCertificates: number
  flaggedUsers: number
  recentDnsFailures: number
}

export function buildSecurityNotifications(input: SecurityNotificationInput): SecurityNotification[] {
  const notifications: SecurityNotification[] = []

  if (input.failedProvisioning > 0) {
    notifications.push({
      id: 'failed-provisioning',
      severity: 'critical',
      title: 'Provisioning failed',
      message: `${input.failedProvisioning} VPN request${plural(input.failedProvisioning)} need admin retry or rejection.`,
      href: '/access-requests',
      count: input.failedProvisioning,
    })
  }

  if (input.flaggedUsers > 0) {
    notifications.push({
      id: 'flagged-users',
      severity: 'critical',
      title: 'Flagged VPN users',
      message: `${input.flaggedUsers} user${plural(input.flaggedUsers)} are flagged for manual security review.`,
      href: '/flagged',
      count: input.flaggedUsers,
    })
  }

  if (input.pendingPortalUsers > 0) {
    notifications.push({
      id: 'pending-portal-users',
      severity: 'warning',
      title: 'Portal approvals waiting',
      message: `${input.pendingPortalUsers} portal user${plural(input.pendingPortalUsers)} are waiting for approval.`,
      href: '/admin',
      count: input.pendingPortalUsers,
    })
  }

  if (input.pendingVpnRequests > 0) {
    notifications.push({
      id: 'pending-vpn-requests',
      severity: 'warning',
      title: 'VPN requests waiting',
      message: `${input.pendingVpnRequests} VPN request${plural(input.pendingVpnRequests)} are waiting for review.`,
      href: '/access-requests',
      count: input.pendingVpnRequests,
    })
  }

  if (input.expiringCertificates > 0) {
    notifications.push({
      id: 'expiring-certificates',
      severity: 'warning',
      title: 'Certificates near expiry',
      message: `${input.expiringCertificates} active certificate${plural(input.expiringCertificates)} are inside the renewal window.`,
      href: '/users',
      count: input.expiringCertificates,
    })
  }

  if (input.failedSyncJobs > 0) {
    notifications.push({
      id: 'failed-sync-jobs',
      severity: 'warning',
      title: 'Sync jobs failed',
      message: `${input.failedSyncJobs} sync job${plural(input.failedSyncJobs)} failed and may need retry.`,
      href: '/sync',
      count: input.failedSyncJobs,
    })
  }

  if (input.recentDnsFailures > 0) {
    notifications.push({
      id: 'dns-health-failures',
      severity: 'warning',
      title: 'DNS health checks failed',
      message: `${input.recentDnsFailures} recent DNS check${plural(input.recentDnsFailures)} reported resolver failures.`,
      href: '/servers',
      count: input.recentDnsFailures,
    })
  }

  return notifications
}

function plural(count: number) {
  return count === 1 ? '' : 's'
}
