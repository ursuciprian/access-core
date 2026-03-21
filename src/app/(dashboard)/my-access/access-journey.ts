export const ACCESS_CERT_WARNING_DAYS = 30

export interface MyAccessEntry {
  id: string
  approvedAt: string
  server: { id: string; name: string; hostname: string }
  certStatus: string
  certExpiresAt: string | null
  isEnabled: boolean
}

export interface AccessJourneyState {
  tone: string
  label: string
  message: string
  canDownload: boolean
  needsRecovery: boolean
  expiryHint: string | null
}

export interface MyAccessRequestEntry {
  id: string
  status: string
  serverId: string
  server: { name: string }
  createdAt: string
  reviewNote: string | null
}

export function getAccessJourneyState(
  entry: MyAccessEntry,
  now = new Date(),
  warningDays = ACCESS_CERT_WARNING_DAYS
): AccessJourneyState {
  if (!entry.isEnabled) {
    return {
      tone: '#EF4444',
      label: 'Recovery Needed',
      message: 'Access has been disabled for this server. Request access again to restore your VPN configuration.',
      canDownload: false,
      needsRecovery: true,
      expiryHint: null,
    }
  }

  if (entry.certStatus === 'REVOKED') {
    return {
      tone: '#EF4444',
      label: 'Certificate Revoked',
      message: 'This certificate is no longer trusted. Request a new VPN setup to get back online.',
      canDownload: false,
      needsRecovery: true,
      expiryHint: null,
    }
  }

  if (entry.certStatus !== 'ACTIVE') {
    return {
      tone: '#F59E0B',
      label: 'Not Ready Yet',
      message: 'Your access is approved, but the certificate is not ready to download yet. Request recovery if this stays blocked.',
      canDownload: false,
      needsRecovery: true,
      expiryHint: null,
    }
  }

  const expiryHint = getExpiryHint(entry.certExpiresAt, now, warningDays)
  if (expiryHint) {
    return {
      tone: '#F59E0B',
      label: 'Expiring Soon',
      message: 'Your VPN profile still works, but you should plan a renewal soon to avoid interruption.',
      canDownload: true,
      needsRecovery: false,
      expiryHint,
    }
  }

  return {
    tone: '#22C55E',
    label: 'Ready',
    message: 'Your VPN profile is ready to download and import into OpenVPN Connect.',
    canDownload: true,
    needsRecovery: false,
    expiryHint: null,
  }
}

export function getLatestRecoveryRequest(requests: MyAccessRequestEntry[]) {
  return requests.find((request) => request.status !== 'APPROVED') ?? null
}

function getExpiryHint(certExpiresAt: string | null, now: Date, warningDays: number) {
  if (!certExpiresAt) {
    return null
  }

  const expiryDate = new Date(certExpiresAt)
  if (Number.isNaN(expiryDate.getTime())) {
    return null
  }

  const diffMs = expiryDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays > warningDays) {
    return null
  }

  if (diffDays <= 0) {
    return 'Certificate has expired.'
  }

  return `Certificate expires in ${diffDays} day${diffDays === 1 ? '' : 's'}.`
}
