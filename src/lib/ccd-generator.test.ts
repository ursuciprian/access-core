import { cidrToSubnetMask, generateCcdContent, buildCcdWriteCommand } from './ccd-generator'

describe('cidrToSubnetMask', () => {
  it('converts /24 to 255.255.255.0', () => {
    const result = cidrToSubnetMask('10.0.1.0/24')
    expect(result).toEqual({ ip: '10.0.1.0', mask: '255.255.255.0' })
  })

  it('converts /16 to 255.255.0.0', () => {
    const result = cidrToSubnetMask('192.168.0.0/16')
    expect(result).toEqual({ ip: '192.168.0.0', mask: '255.255.0.0' })
  })

  it('converts /8 to 255.0.0.0', () => {
    const result = cidrToSubnetMask('10.0.0.0/8')
    expect(result).toEqual({ ip: '10.0.0.0', mask: '255.0.0.0' })
  })

  it('converts /32 to 255.255.255.255', () => {
    const result = cidrToSubnetMask('192.168.1.1/32')
    expect(result).toEqual({ ip: '192.168.1.1', mask: '255.255.255.255' })
  })

  it('converts /0 to 0.0.0.0', () => {
    const result = cidrToSubnetMask('0.0.0.0/0')
    expect(result).toEqual({ ip: '0.0.0.0', mask: '0.0.0.0' })
  })

  it('preserves the network IP as-is', () => {
    const result = cidrToSubnetMask('172.16.5.0/20')
    expect(result.ip).toBe('172.16.5.0')
  })
})

describe('generateCcdContent', () => {
  it('generates a push route line for each route', () => {
    const routes = [
      { ip: '10.0.1.0', mask: '255.255.255.0' },
      { ip: '10.0.2.0', mask: '255.255.255.0' },
    ]
    const result = generateCcdContent(routes)
    expect(result).toBe(
      'push "route 10.0.1.0 255.255.255.0"\npush "route 10.0.2.0 255.255.255.0"'
    )
  })

  it('deduplicates routes with the same ip and mask', () => {
    const routes = [
      { ip: '10.0.1.0', mask: '255.255.255.0' },
      { ip: '10.0.1.0', mask: '255.255.255.0' },
      { ip: '10.0.2.0', mask: '255.255.255.0' },
    ]
    const result = generateCcdContent(routes)
    const lines = result.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('push "route 10.0.1.0 255.255.255.0"')
    expect(lines[1]).toBe('push "route 10.0.2.0 255.255.255.0"')
  })

  it('returns empty string for empty routes array', () => {
    expect(generateCcdContent([])).toBe('')
  })

  it('does not deduplicate routes with different masks', () => {
    const routes = [
      { ip: '10.0.1.0', mask: '255.255.255.0' },
      { ip: '10.0.1.0', mask: '255.255.0.0' },
    ]
    const result = generateCcdContent(routes)
    const lines = result.split('\n')
    expect(lines).toHaveLength(2)
  })
})

describe('buildCcdWriteCommand', () => {
  it('produces a heredoc cat command followed by chmod with shell-escaped paths', () => {
    const result = buildCcdWriteCommand('/etc/openvpn/ccd', 'user1', 'push "route 10.0.1.0 255.255.255.0"')
    expect(result).toBe(
      [
        "cat > '/etc/openvpn/ccd/user1' << 'CCDEOF'",
        'push "route 10.0.1.0 255.255.255.0"',
        'CCDEOF',
        "chmod 644 '/etc/openvpn/ccd/user1'",
      ].join('\n')
    )
  })

  it('uses shell-escaped ccdPath and commonName in both lines', () => {
    const result = buildCcdWriteCommand('/custom/path', 'myuser', '')
    expect(result).toContain("cat > '/custom/path/myuser'")
    expect(result).toContain("chmod 644 '/custom/path/myuser'")
  })

  it('embeds the ccdContent between the heredoc markers', () => {
    const content = 'push "route 192.168.1.0 255.255.255.0"\npush "route 10.0.0.0 255.0.0.0"'
    const result = buildCcdWriteCommand('/etc/openvpn/ccd', 'testuser', content)
    const lines = result.split('\n')
    // content lines sit between the heredoc open and CCDEOF
    expect(lines[1]).toBe('push "route 192.168.1.0 255.255.255.0"')
    expect(lines[2]).toBe('push "route 10.0.0.0 255.0.0.0"')
    expect(lines[3]).toBe('CCDEOF')
  })

  it('rejects command injection via semicolon in commonName', () => {
    expect(() => buildCcdWriteCommand('/etc/openvpn/ccd', 'user; rm -rf /', 'content')).toThrow()
  })

  it('rejects command injection via backtick in commonName', () => {
    expect(() => buildCcdWriteCommand('/etc/openvpn/ccd', 'user`whoami`', 'content')).toThrow()
  })

  it('rejects command injection via $() in commonName', () => {
    expect(() => buildCcdWriteCommand('/etc/openvpn/ccd', 'user$(id)', 'content')).toThrow()
  })

  it('rejects path traversal in commonName', () => {
    expect(() => buildCcdWriteCommand('/etc/openvpn/ccd', '../../../etc/passwd', 'content')).toThrow()
  })

  it('rejects pipe in commonName', () => {
    expect(() => buildCcdWriteCommand('/etc/openvpn/ccd', 'user | cat /etc/shadow', 'content')).toThrow()
  })

  it('rejects semicolon in ccdPath', () => {
    expect(() => buildCcdWriteCommand('/etc/openvpn/ccd; rm -rf /', 'user1', 'content')).toThrow()
  })

  it('rejects backtick in ccdPath', () => {
    expect(() => buildCcdWriteCommand('/etc/openvpn/ccd`whoami`', 'user1', 'content')).toThrow()
  })

  it('rejects $() in ccdPath', () => {
    expect(() => buildCcdWriteCommand('/etc/openvpn/ccd$(id)', 'user1', 'content')).toThrow()
  })
})
