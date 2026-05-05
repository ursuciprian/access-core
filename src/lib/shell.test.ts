import {
  buildListDirectoryCommand,
  buildReadCcdCommand,
  buildShowCertCommand,
} from './shell'

describe('shell command builders', () => {
  it('escapes server paths and common names when reading CCD files', () => {
    expect(buildReadCcdCommand('/etc/openvpn/ccd', 'alice')).toBe("cat '/etc/openvpn/ccd/alice'")
  })

  it('rejects malicious CCD paths before building list commands', () => {
    expect(() => buildListDirectoryCommand('/etc/openvpn/ccd; touch /tmp/pwned')).toThrow(
      'Invalid directory path'
    )
  })

  it('rejects malicious common names before building read commands', () => {
    expect(() => buildReadCcdCommand('/etc/openvpn/ccd', 'alice;touch')).toThrow(
      'Invalid common name'
    )
  })

  it('escapes Easy-RSA paths and common names when showing certificates', () => {
    expect(buildShowCertCommand('/etc/openvpn/easy-rsa', 'alice')).toBe(
      "cd '/etc/openvpn/easy-rsa' && ./easyrsa show-cert 'alice' 2>/dev/null || echo \"NOT_FOUND\""
    )
  })

  it('rejects malicious Easy-RSA paths before building certificate commands', () => {
    expect(() => buildShowCertCommand('/etc/openvpn/easy-rsa$(id)', 'alice')).toThrow(
      'Invalid Easy-RSA path'
    )
  })
})
