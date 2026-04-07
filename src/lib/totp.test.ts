import {
  buildTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  findValidTotpStep,
  generateTotpCode,
  generateTotpSecret,
  getTotpSecretHash,
  verifyTotpCode,
} from './totp'

describe('totp helpers', () => {
  beforeEach(() => {
    process.env.MFA_ENCRYPTION_KEY = '12345678901234567890123456789012'
  })

  afterEach(() => {
    delete process.env.MFA_ENCRYPTION_KEY
  })

  it('generates a valid secret and verifies its current code', () => {
    const secret = generateTotpSecret()
    const code = generateTotpCode(secret, 1_710_000_000_000)

    expect(secret).toMatch(/^[A-Z2-7]+$/)
    expect(code).toMatch(/^\d{6}$/)
    expect(verifyTotpCode(secret, code, { timestamp: 1_710_000_000_000 })).toBe(true)
  })

  it('encrypts and decrypts the TOTP secret losslessly', () => {
    const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP')

    expect(decryptTotpSecret(encrypted)).toBe('JBSWY3DPEHPK3PXP')
  })

  it('builds an otpauth URI with issuer and email', () => {
    const uri = buildTotpUri('alice@example.com', 'AccessCore', 'JBSWY3DPEHPK3PXP')

    expect(uri).toContain('otpauth://totp/')
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP')
    expect(uri).toContain('issuer=AccessCore')
  })

  it('requires MFA_ENCRYPTION_KEY to be configured', () => {
    delete process.env.MFA_ENCRYPTION_KEY

    expect(() => encryptTotpSecret('JBSWY3DPEHPK3PXP')).toThrow('MFA_ENCRYPTION_KEY must be configured')
  })

  it('returns the matched TOTP step for a valid code', () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const timestamp = 1_710_000_000_000
    const code = generateTotpCode(secret, timestamp)

    expect(findValidTotpStep(secret, code, { timestamp })).toBe(Math.floor(timestamp / 1000 / 30))
  })

  it('builds a stable secret hash for replay protection', () => {
    expect(getTotpSecretHash('JBSWY3DPEHPK3PXP')).toHaveLength(64)
    expect(getTotpSecretHash('JBSWY3DPEHPK3PXP')).toBe(getTotpSecretHash('JBSWY3DPEHPK3PXP'))
  })
})
