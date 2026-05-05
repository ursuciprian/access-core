const REMOTE_HOST_REGEX = /^[A-Za-z0-9.-]+$/
const CONFIG_TOKEN_REGEX = /^[A-Za-z0-9._-]+$/

export function isSafeOpenVpnRemoteHost(hostname: string) {
  const value = hostname.trim()
  return (
    value.length > 0 &&
    value.length <= 255 &&
    REMOTE_HOST_REGEX.test(value) &&
    !value.includes('..') &&
    !value.startsWith('.') &&
    !value.endsWith('.')
  )
}

export function getSafeOpenVpnPort(value: string | undefined, fallback = '1194') {
  const trimmed = value?.trim()
  if (!trimmed || !/^\d{1,5}$/.test(trimmed)) {
    return fallback
  }

  const port = Number(trimmed)
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? String(port) : fallback
}

export function getSafeOpenVpnProtocol(value: string | undefined, fallback = 'udp') {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'udp' || normalized === 'tcp' ? normalized : fallback
}

export function getSafeOpenVpnConfigToken(value: string | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length <= 128 && CONFIG_TOKEN_REGEX.test(trimmed) ? trimmed : fallback
}

export function buildOvpnAttachmentFilename(commonName: string, serverName: string) {
  const safeCommonName = sanitizeFilenamePart(commonName) || 'profile'
  const safeServerName = sanitizeFilenamePart(serverName) || 'server'
  return `${safeCommonName}-${safeServerName}.ovpn`
}

function sanitizeFilenamePart(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 80)
}
