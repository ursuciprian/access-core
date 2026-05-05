import { describe, expect, it } from 'vitest'
import {
  applyNetworkSettingsToServerConfig,
  buildApplyNetworkSettingsCommand,
  validateServerNetworkSettings,
  type ServerNetworkSettings,
} from './server-network-config'

const settings: ServerNetworkSettings = {
  vpnNetwork: '10.8.0.0/24',
  dnsServers: ['8.8.8.8', '1.1.1.1'],
  searchDomains: ['corp.example.com', 'internal.local'],
  internalDomains: ['interna.example.com'],
  routeMode: 'NAT',
  splitTunnel: false,
  compression: 'lz4',
  protocol: 'udp',
  port: 1194,
}

describe('validateServerNetworkSettings', () => {
  it('accepts a valid network settings payload', () => {
    expect(validateServerNetworkSettings(settings)).toEqual({ success: true })
  })

  it('rejects invalid DNS servers', () => {
    expect(
      validateServerNetworkSettings({
        ...settings,
        dnsServers: ['999.1.1.1'],
      })
    ).toEqual({
      success: false,
      error: 'Invalid DNS server: 999.1.1.1',
    })
  })

  it('rejects invalid internal domains', () => {
    expect(
      validateServerNetworkSettings({
        ...settings,
        internalDomains: ['internal_domain.example.com'],
      })
    ).toEqual({
      success: false,
      error: 'Invalid DNS domain: internal_domain.example.com',
    })
  })
})

describe('applyNetworkSettingsToServerConfig', () => {
  it('replaces previously managed lines and preserves unrelated directives', () => {
    const currentConfig = [
      'dev tun',
      'topology subnet',
      'port 443',
      'proto tcp',
      'server 10.9.0.0 255.255.255.0',
      'push "dhcp-option DNS 9.9.9.9"',
      'push "redirect-gateway def1 bypass-dhcp"',
      'keepalive 10 60',
      '# portal-route-mode ROUTING',
      '',
    ].join('\n')

    const updated = applyNetworkSettingsToServerConfig(currentConfig, settings)

    expect(updated).toContain('dev tun')
    expect(updated).toContain('topology subnet')
    expect(updated).toContain('keepalive 10 60')
    expect(updated).toContain('# Managed by AccessCore')
    expect(updated).toContain('port 1194')
    expect(updated).toContain('proto udp')
    expect(updated).toContain('server 10.8.0.0 255.255.255.0')
    expect(updated).toContain('compress lz4')
    expect(updated).toContain('push "dhcp-option DNS 8.8.8.8"')
    expect(updated).toContain('push "dhcp-option DOMAIN-SEARCH corp.example.com"')
    expect(updated).toContain('push "dhcp-option DOMAIN-SEARCH interna.example.com"')
    expect(updated).toContain('# portal-route-mode NAT')
    expect(updated).not.toContain('port 443')
    expect(updated).not.toContain('proto tcp')
    expect(updated).not.toContain('push "dhcp-option DNS 9.9.9.9"')
  })

  it('creates a clean config block when the file is empty', () => {
    const updated = applyNetworkSettingsToServerConfig('', settings)

    expect(updated.startsWith('# Managed by AccessCore')).toBe(true)
    expect(updated).toContain('server 10.8.0.0 255.255.255.0')
  })
})

describe('buildApplyNetworkSettingsCommand', () => {
  it('includes backup, config write, NAT management, and openvpn reload/start fallbacks', () => {
    const command = buildApplyNetworkSettingsCommand({
      serverConf: '/etc/openvpn/server.conf',
      vpnNetwork: '10.8.0.0/24',
      routeMode: 'NAT',
      configContent: applyNetworkSettingsToServerConfig('', settings),
    })

    expect(command).toContain("cp '/etc/openvpn/server.conf' '/etc/openvpn/server.conf.portal.bak'")
    expect(command).toContain("printf '%s'")
    expect(command).toContain("iptables -t nat -A POSTROUTING -s '10.8.0.0/24'")
    expect(command).toContain('systemctl reload openvpn@server')
    expect(command).toContain('service openvpn restart')
    expect(command).toContain("nohup openvpn --config '/etc/openvpn/server.conf'")
  })

  it('omits NAT append logic when route mode is routing', () => {
    const command = buildApplyNetworkSettingsCommand({
      serverConf: '/etc/openvpn/server.conf',
      vpnNetwork: '10.8.0.0/24',
      routeMode: 'ROUTING',
      configContent: applyNetworkSettingsToServerConfig('', settings),
    })

    expect(command).not.toContain('iptables -t nat -A POSTROUTING')
  })
})
