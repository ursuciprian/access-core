import {
  buildOvpnAttachmentFilename,
  getSafeOpenVpnConfigToken,
  getSafeOpenVpnPort,
  getSafeOpenVpnProtocol,
  isSafeOpenVpnRemoteHost,
} from './openvpn-profile'

describe('openvpn-profile helpers', () => {
  it('allows simple DNS names, IPv4 addresses, and localhost remote hosts', () => {
    expect(isSafeOpenVpnRemoteHost('vpn.example.com')).toBe(true)
    expect(isSafeOpenVpnRemoteHost('10.0.0.10')).toBe(true)
    expect(isSafeOpenVpnRemoteHost('localhost')).toBe(true)
  })

  it('rejects remote hosts that could inject OpenVPN directives', () => {
    expect(isSafeOpenVpnRemoteHost('vpn.example.com\nscript-security 2')).toBe(false)
    expect(isSafeOpenVpnRemoteHost('vpn.example.com remote evil.example 1194')).toBe(false)
    expect(isSafeOpenVpnRemoteHost('..vpn.example.com')).toBe(false)
  })

  it('normalizes unsafe config tokens to safe defaults', () => {
    expect(getSafeOpenVpnProtocol('tcp')).toBe('tcp')
    expect(getSafeOpenVpnProtocol('udp\nremote evil.example')).toBe('udp')
    expect(getSafeOpenVpnPort('443')).toBe('443')
    expect(getSafeOpenVpnPort('1194\nremote evil.example')).toBe('1194')
    expect(getSafeOpenVpnConfigToken('AES-256-GCM', 'AES-256-GCM')).toBe('AES-256-GCM')
    expect(getSafeOpenVpnConfigToken('AES-256-GCM\nremote evil.example', 'AES-256-GCM')).toBe('AES-256-GCM')
  })

  it('builds a content-disposition-safe attachment filename', () => {
    expect(buildOvpnAttachmentFilename('alice', 'Prod VPN')).toBe('alice-Prod-VPN.ovpn')
    expect(buildOvpnAttachmentFilename('alice', 'Prod"\r\nX-Injected: 1')).toBe('alice-Prod-X-Injected-1.ovpn')
  })
})
