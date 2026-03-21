export type DashboardAlertSeverity = 'critical' | 'warning' | 'info'

export interface DashboardAlertItem {
  id: string
  severity: DashboardAlertSeverity
  title: string
  message: string
  href: string
  ctaLabel: string
  count: number
}

interface AlertSample {
  email?: string | null
  commonName?: string | null
  serverName?: string | null
  timestamp?: string | Date | null
}

export interface DashboardAlertInput {
  certWarningDays: number
  expiringCertCount: number
  earliestExpiringCert?: AlertSample & {
    certExpiresAt?: string | Date | null
  }
  failedProvisioningCount: number
  oldestFailedProvisioning?: AlertSample
  flaggedUserCount: number
  latestFlaggedUser?: AlertSample
  disabledUserCount: number
  stalePendingRequestCount: number
  staleProcessingRequestCount: number
}

export function buildDashboardAlerts(input: DashboardAlertInput): DashboardAlertItem[] {
  const alerts: DashboardAlertItem[] = []

  if (input.failedProvisioningCount > 0) {
    alerts.push({
      id: 'failed-provisioning',
      severity: 'critical',
      title: 'Provisioning failures need a retry',
      message: `${input.failedProvisioningCount} request${pluralize(input.failedProvisioningCount)} are waiting for admin recovery.${formatFailureContext(input.oldestFailedProvisioning)}`,
      href: '/access-requests',
      ctaLabel: 'Review Requests',
      count: input.failedProvisioningCount,
    })
  }

  if (input.flaggedUserCount > 0) {
    alerts.push({
      id: 'flagged-users',
      severity: 'critical',
      title: 'Flagged VPN users need review',
      message: `${input.flaggedUserCount} flagged user${pluralize(input.flaggedUserCount)} currently need investigation.${formatFlaggedContext(input.latestFlaggedUser)}`,
      href: '/flagged',
      ctaLabel: 'Open Flagged Users',
      count: input.flaggedUserCount,
    })
  }

  const staleRequestCount = input.stalePendingRequestCount + input.staleProcessingRequestCount
  if (staleRequestCount > 0) {
    const staleParts: string[] = []
    if (input.stalePendingRequestCount > 0) {
      staleParts.push(`${input.stalePendingRequestCount} pending >24h`)
    }
    if (input.staleProcessingRequestCount > 0) {
      staleParts.push(`${input.staleProcessingRequestCount} processing >30m`)
    }

    alerts.push({
      id: 'stale-requests',
      severity: 'warning',
      title: 'Access request backlog is aging',
      message: `${staleRequestCount} request${pluralize(staleRequestCount)} have been sitting longer than expected (${staleParts.join(', ')}).`,
      href: '/access-requests',
      ctaLabel: 'Inspect Backlog',
      count: staleRequestCount,
    })
  }

  if (input.expiringCertCount > 0) {
    alerts.push({
      id: 'expiring-certs',
      severity: 'warning',
      title: 'Certificates are nearing expiry',
      message: `${input.expiringCertCount} active certificate${pluralize(input.expiringCertCount)} expire within ${input.certWarningDays} day${pluralize(input.certWarningDays)}.${formatExpiryContext(input.earliestExpiringCert)}`,
      href: '/users',
      ctaLabel: 'Review Users',
      count: input.expiringCertCount,
    })
  }

  if (input.disabledUserCount > 0) {
    alerts.push({
      id: 'disabled-users',
      severity: 'info',
      title: 'Disabled VPN users are present',
      message: `${input.disabledUserCount} VPN user${pluralize(input.disabledUserCount)} are currently disabled and may need cleanup or re-enablement.`,
      href: '/users',
      ctaLabel: 'Review Users',
      count: input.disabledUserCount,
    })
  }

  return alerts
}

function pluralize(count: number) {
  return count === 1 ? '' : 's'
}

function formatFailureContext(sample?: AlertSample) {
  if (!sample) return ''

  const subject = sample.email || sample.commonName
  if (!subject) return ''

  return ` Oldest failed item: ${subject}${sample.serverName ? ` on ${sample.serverName}` : ''}.`
}

function formatFlaggedContext(sample?: AlertSample) {
  if (!sample) return ''

  const subject = sample.email || sample.commonName
  if (!subject) return ''

  return ` Latest review target: ${subject}${sample.serverName ? ` on ${sample.serverName}` : ''}.`
}

function formatExpiryContext(sample?: DashboardAlertInput['earliestExpiringCert']) {
  if (!sample?.certExpiresAt) return ''

  const subject = sample.email || sample.commonName
  if (!subject) return ''

  const expiryDate = new Date(sample.certExpiresAt)
  if (Number.isNaN(expiryDate.getTime())) return ''

  return ` Earliest known expiry: ${subject} on ${expiryDate.toLocaleDateString()}.`
}
