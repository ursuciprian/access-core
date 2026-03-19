import { validateServerPaths, validateCommonName, validateCidr, deriveCommonName, passwordSchema } from './validation'

describe('validateServerPaths', () => {
  const validData = {
    ccdPath: '/etc/openvpn/ccd',
    easyRsaPath: '/etc/easy-rsa',
    serverConf: '/etc/openvpn/server.conf',
  }

  it('accepts valid absolute paths', () => {
    const result = validateServerPaths(validData)
    expect(result.success).toBe(true)
  })

  it('rejects paths containing ..', () => {
    const result = validateServerPaths({ ...validData, ccdPath: '/etc/openvpn/../ccd' })
    expect(result.success).toBe(false)
  })

  it('rejects paths with shell metacharacters (semicolon)', () => {
    const result = validateServerPaths({ ...validData, ccdPath: '/etc/openvpn/ccd;ls' })
    expect(result.success).toBe(false)
  })

  it('rejects paths with shell metacharacters (dollar sign)', () => {
    const result = validateServerPaths({ ...validData, easyRsaPath: '/etc/$HOME/easy-rsa' })
    expect(result.success).toBe(false)
  })

  it('rejects paths with spaces', () => {
    const result = validateServerPaths({ ...validData, serverConf: '/etc/open vpn/server.conf' })
    expect(result.success).toBe(false)
  })

  it('rejects paths exceeding 255 characters', () => {
    const longPath = '/' + 'a'.repeat(255)
    const result = validateServerPaths({ ...validData, ccdPath: longPath })
    expect(result.success).toBe(false)
  })

  it('rejects empty strings', () => {
    const result = validateServerPaths({ ...validData, ccdPath: '' })
    expect(result.success).toBe(false)
  })

  it('rejects relative paths (no leading slash)', () => {
    const result = validateServerPaths({ ...validData, ccdPath: 'etc/openvpn/ccd' })
    expect(result.success).toBe(false)
  })
})

describe('validateCommonName', () => {
  it('accepts valid alphanumeric CNs', () => {
    expect(validateCommonName('user1').success).toBe(true)
  })

  it('accepts CNs with dots, dashes, and underscores', () => {
    expect(validateCommonName('user.name_foo-bar').success).toBe(true)
  })

  it('rejects CNs containing ..', () => {
    expect(validateCommonName('user..name').success).toBe(false)
  })

  it('rejects CNs with special characters (@)', () => {
    expect(validateCommonName('user@domain').success).toBe(false)
  })

  it('rejects CNs with spaces', () => {
    expect(validateCommonName('user name').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateCommonName('').success).toBe(false)
  })

  it('rejects CNs exceeding 64 characters', () => {
    expect(validateCommonName('a'.repeat(65)).success).toBe(false)
  })

  it('accepts exactly 64 character CN', () => {
    expect(validateCommonName('a'.repeat(64)).success).toBe(true)
  })
})

describe('validateCidr', () => {
  it('accepts valid /24 CIDR', () => {
    expect(validateCidr('10.0.1.0/24').success).toBe(true)
  })

  it('accepts valid /16 CIDR', () => {
    expect(validateCidr('192.168.0.0/16').success).toBe(true)
  })

  it('accepts /0 CIDR', () => {
    expect(validateCidr('0.0.0.0/0').success).toBe(true)
  })

  it('accepts /32 CIDR', () => {
    expect(validateCidr('10.0.0.1/32').success).toBe(true)
  })

  it('rejects CIDR with prefix > 32', () => {
    expect(validateCidr('10.0.0.0/33').success).toBe(false)
  })

  it('rejects CIDR with octet > 255', () => {
    expect(validateCidr('256.0.0.0/24').success).toBe(false)
  })

  it('rejects plain IP without prefix', () => {
    expect(validateCidr('10.0.0.1').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateCidr('').success).toBe(false)
  })

  it('rejects IPv6 addresses', () => {
    expect(validateCidr('::1/128').success).toBe(false)
  })

  it('rejects malformed CIDR', () => {
    expect(validateCidr('10.0.0/24').success).toBe(false)
  })
})

describe('deriveCommonName', () => {
  it('returns the local part before @', () => {
    expect(deriveCommonName('john@example.com')).toBe('john')
  })

  it('strips + alias suffix', () => {
    expect(deriveCommonName('john+alias@example.com')).toBe('john')
  })

  it('handles email with no + in local part', () => {
    expect(deriveCommonName('alice.smith@company.org')).toBe('alice.smith')
  })

  it('handles multiple + signs — strips from first +', () => {
    expect(deriveCommonName('user+tag+extra@example.com')).toBe('user')
  })
})

describe('passwordSchema', () => {
  it('accepts passwords that are at least 12 characters long', () => {
    expect(passwordSchema.safeParse('correct horse').success).toBe(true)
  })

  it('rejects passwords shorter than 12 characters', () => {
    expect(passwordSchema.safeParse('short-pass').success).toBe(false)
  })
})
