import { validateCidr, validateServerPaths } from './validation'

export interface ServerNetworkSettings {
  vpnNetwork: string
  dnsServers: string[]
  searchDomains: string[]
  routeMode: 'NAT' | 'ROUTING'
  splitTunnel: boolean
  compression: 'off' | 'lzo' | 'lz4'
  protocol: 'udp' | 'tcp'
  port: number
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function cidrToServerDirective(cidr: string) {
  const [network, prefix] = cidr.split('/')
  const prefixNum = Number(prefix)
  const maskNum = prefixNum === 0 ? 0 : (~0 << (32 - prefixNum)) >>> 0
  const mask = [
    (maskNum >>> 24) & 255,
    (maskNum >>> 16) & 255,
    (maskNum >>> 8) & 255,
    maskNum & 255,
  ].join('.')

  return `server ${network} ${mask}`
}

function buildManagedLines(settings: ServerNetworkSettings) {
  const lines = [
    '# Managed by AccessCore',
    `port ${settings.port}`,
    `proto ${settings.protocol}`,
    cidrToServerDirective(settings.vpnNetwork),
  ]

  if (settings.compression === 'lz4') {
    lines.push('compress lz4')
  } else if (settings.compression === 'lzo') {
    lines.push('comp-lzo yes')
  }

  if (!settings.splitTunnel) {
    lines.push('push "redirect-gateway def1 bypass-dhcp"')
  }

  for (const dns of settings.dnsServers) {
    lines.push(`push "dhcp-option DNS ${dns}"`)
  }

  for (const domain of settings.searchDomains) {
    lines.push(`push "dhcp-option DOMAIN-SEARCH ${domain}"`)
  }

  lines.push(`# portal-route-mode ${settings.routeMode}`)
  return lines
}

function isManagedLine(trimmed: string) {
  return (
    trimmed === '# Managed by AccessCore' ||
    trimmed.startsWith('# portal-route-mode ') ||
    trimmed.startsWith('port ') ||
    trimmed.startsWith('proto ') ||
    trimmed.startsWith('server ') ||
    trimmed.startsWith('compress ') ||
    trimmed.startsWith('comp-lzo') ||
    trimmed === 'allow-compression yes' ||
    trimmed.startsWith('push "redirect-gateway ') ||
    trimmed.startsWith('push "dhcp-option DNS ') ||
    trimmed.startsWith('push "dhcp-option DOMAIN ') ||
    trimmed.startsWith('push "dhcp-option DOMAIN-SEARCH ')
  )
}

export function applyNetworkSettingsToServerConfig(
  currentConfig: string,
  settings: ServerNetworkSettings
) {
  const filteredLines = currentConfig
    .split(/\r?\n/)
    .filter((line) => !isManagedLine(line.trim()))

  while (filteredLines.length > 0 && filteredLines[filteredLines.length - 1]?.trim() === '') {
    filteredLines.pop()
  }

  const preserved = filteredLines.join('\n').trimEnd()
  return preserved
    ? `${preserved}\n\n${buildManagedLines(settings).join('\n')}\n`
    : `${buildManagedLines(settings).join('\n')}\n`
}

export function validateServerNetworkSettings(settings: ServerNetworkSettings) {
  const cidrValidation = validateCidr(settings.vpnNetwork)
  if (!cidrValidation.success) {
    return { success: false as const, error: 'Invalid VPN network CIDR' }
  }

  if (!Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535) {
    return { success: false as const, error: 'Invalid OpenVPN port' }
  }

  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  for (const dns of settings.dnsServers) {
    if (!ipv4Regex.test(dns)) {
      return { success: false as const, error: `Invalid DNS server: ${dns}` }
    }
    const octets = dns.split('.').map(Number)
    if (octets.some((octet) => octet < 0 || octet > 255)) {
      return { success: false as const, error: `Invalid DNS server: ${dns}` }
    }
  }

  const searchDomainRegex = /^[a-zA-Z0-9.-]+$/
  for (const domain of settings.searchDomains) {
    if (!searchDomainRegex.test(domain)) {
      return { success: false as const, error: `Invalid DNS search domain: ${domain}` }
    }
  }

  return { success: true as const }
}

export function buildApplyNetworkSettingsCommand(input: {
  serverConf: string
  vpnNetwork: string
  routeMode: 'NAT' | 'ROUTING'
  configContent: string
}) {
  const pathValidation = validateServerPaths({
    ccdPath: '/tmp',
    easyRsaPath: '/tmp',
    serverConf: input.serverConf,
  })
  if (!pathValidation.success) {
    throw new Error('Invalid server config path')
  }

  const cidrValidation = validateCidr(input.vpnNetwork)
  if (!cidrValidation.success) {
    throw new Error('Invalid VPN network CIDR')
  }

  const escapedConf = shellEscape(input.serverConf)
  const backupPath = `${input.serverConf}.portal.bak`
  const escapedBackup = shellEscape(backupPath)

  return [
    `cp ${escapedConf} ${escapedBackup} 2>/dev/null || true`,
    `printf '%s' ${shellEscape(input.configContent)} > ${escapedConf}`,
    'DEFAULT_IFACE="$(ip route show default 2>/dev/null | awk \'/default/ {print $5; exit}\')"',
    '[ -n "$DEFAULT_IFACE" ] || DEFAULT_IFACE=eth0',
    `iptables -t nat -D POSTROUTING -s ${shellEscape(input.vpnNetwork)} -o "$DEFAULT_IFACE" -j MASQUERADE 2>/dev/null || true`,
    input.routeMode === 'NAT'
      ? `iptables -t nat -C POSTROUTING -s ${shellEscape(input.vpnNetwork)} -o "$DEFAULT_IFACE" -j MASQUERADE 2>/dev/null || iptables -t nat -A POSTROUTING -s ${shellEscape(input.vpnNetwork)} -o "$DEFAULT_IFACE" -j MASQUERADE`
      : 'true',
    '(command -v systemctl >/dev/null 2>&1 && (systemctl reload openvpn@server || systemctl reload openvpn || systemctl restart openvpn@server || systemctl restart openvpn)) || true',
    '(command -v service >/dev/null 2>&1 && (service openvpn restart || service openvpn-server restart)) || true',
    'pgrep -x openvpn >/dev/null 2>&1 && (pkill -HUP -x openvpn || pkill -HUP -f "openvpn --config" || true) || true',
    'sleep 1',
    `pgrep -x openvpn >/dev/null 2>&1 || (nohup openvpn --config ${escapedConf} >/var/log/openvpn.log 2>&1 & sleep 1)`,
    `pgrep -x openvpn >/dev/null 2>&1 || { cp ${escapedBackup} ${escapedConf} 2>/dev/null || true; nohup openvpn --config ${escapedConf} >/var/log/openvpn.log 2>&1 & sleep 1; exit 1; }`,
  ].join('\n')
}
