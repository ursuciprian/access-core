import { isIP } from 'node:net'

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase()
  return normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')
}

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split('.').map((part) => Number.parseInt(part, 10))
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) {
    return false
  }

  const [first, second] = octets
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function isPrivateIpv6(hostname: string) {
  const normalized = normalizeIpLiteral(hostname).toLowerCase()
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:')
  )
}

function normalizeIpLiteral(hostname: string) {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1)
  }

  return hostname
}

function isBlockedIpLiteral(hostname: string) {
  const normalized = normalizeIpLiteral(hostname)
  const version = isIP(normalized)
  if (version === 4) {
    return isPrivateIpv4(normalized)
  }
  if (version === 6) {
    return isPrivateIpv6(normalized)
  }
  return false
}

export function validateAgentUrl(agentUrl: string) {
  try {
    const parsed = new URL(agentUrl.trim())

    if (parsed.protocol !== 'https:') {
      return { success: false as const, error: 'Agent URL must use HTTPS' }
    }

    if (parsed.username || parsed.password) {
      return { success: false as const, error: 'Agent URL must not include embedded credentials' }
    }

    if (parsed.search || parsed.hash) {
      return { success: false as const, error: 'Agent URL must not include query parameters or fragments' }
    }

    if (isLocalHostname(parsed.hostname) || isBlockedIpLiteral(parsed.hostname)) {
      return { success: false as const, error: 'Agent URL must not target localhost, link-local, or private IP ranges' }
    }

    return {
      success: true as const,
      data: `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`,
    }
  } catch {
    return { success: false as const, error: 'Agent URL must be a valid absolute URL' }
  }
}
