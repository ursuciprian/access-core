import {
  buildTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode,
} from './totp'

describe('totp helpers', () => {
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
})
