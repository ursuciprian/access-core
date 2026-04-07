import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const TOTP_PERIOD_SECONDS = 30
const TOTP_DIGITS = 6
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function getMfaEncryptionKey(): Buffer {
  const source = process.env.MFA_ENCRYPTION_KEY?.trim()
  if (!source) {
    throw new Error('MFA_ENCRYPTION_KEY must be configured')
  }

  if (source.length < 32) {
    throw new Error('MFA_ENCRYPTION_KEY must be at least 32 characters long')
  }

  return createHash('sha256').update(source).digest()
}

function normalizeBase32(value: string) {
  return value.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase()
}

export function encodeBase32(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

export function decodeBase32(value: string): Buffer {
  const normalized = normalizeBase32(value)
  let bits = 0
  let current = 0
  const bytes: number[] = []

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) {
      throw new Error('Invalid base32 secret')
    }

    current = (current << 5) | index
    bits += 5

    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20))
}

export function buildTotpUri(email: string, issuer = 'AccessCore', secret: string) {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`
}

export function encryptTotpSecret(secret: string): string {
  const iv = randomBytes(12)
  const key = getMfaEncryptionKey()
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decryptTotpSecret(payload: string | null | undefined): string | null {
  if (!payload) {
    return null
  }

  const [ivB64, tagB64, encryptedB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Invalid MFA secret payload')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getMfaEncryptionKey(),
    Buffer.from(ivB64, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64url')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

export function generateTotpCode(secret: string, timestamp = Date.now()): string {
  const secretBytes = decodeBase32(secret)
  const counter = getTotpStep(timestamp)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  const hmac = createHmac('sha1', secretBytes).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return String(binaryCode % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0')
}

export function getTotpStep(timestamp = Date.now()) {
  return Math.floor(timestamp / 1000 / TOTP_PERIOD_SECONDS)
}

export function getTotpSecretHash(secret: string) {
  return createHash('sha256').update(secret).digest('hex')
}

export function findValidTotpStep(secret: string, code: string, options?: { window?: number; timestamp?: number }) {
  const candidate = code.trim()
  if (!/^\d{6}$/.test(candidate)) {
    return null
  }

  const window = options?.window ?? 1
  const timestamp = options?.timestamp ?? Date.now()
  const baseStep = getTotpStep(timestamp)

  for (let offset = -window; offset <= window; offset += 1) {
    const step = baseStep + offset
    const expected = generateTotpCode(secret, (step * TOTP_PERIOD_SECONDS) * 1000)
    if (timingSafeEqual(Buffer.from(candidate), Buffer.from(expected))) {
      return step
    }
  }

  return null
}

export function verifyTotpCode(secret: string, code: string, options?: { window?: number; timestamp?: number }) {
  return findValidTotpStep(secret, code, options) !== null
}
