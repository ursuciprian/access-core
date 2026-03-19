const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const MFA_VERIFICATION_COOKIE = 'accesscore_mfa_verified'

function getCookieSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required for MFA cookie signing')
  }
  return secret
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

async function importSigningKey() {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getCookieSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function signPayload(payload: string) {
  const key = await importSigningKey()
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toBase64Url(new Uint8Array(signature))
}

export async function createMfaVerificationCookieValue(
  userId: string,
  authSessionId: string,
  expiresAt: number
) {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ userId, authSessionId, expiresAt }))
  )
  const signature = await signPayload(payload)
  return `${payload}.${signature}`
}

export async function isValidMfaVerificationCookie(
  cookieValue: string | undefined | null,
  expectedUserId: string,
  expectedAuthSessionId: string,
  now = Date.now()
) {
  if (!cookieValue) {
    return false
  }

  const [payload, signature] = cookieValue.split('.')
  if (!payload || !signature) {
    return false
  }

  const key = await importSigningKey()
  const isValidSignature = await crypto.subtle.verify(
    'HMAC',
    key,
    fromBase64Url(signature),
    encoder.encode(payload)
  )
  if (!isValidSignature) {
    return false
  }

  try {
    const parsed = JSON.parse(decoder.decode(fromBase64Url(payload))) as {
      userId?: unknown
      authSessionId?: unknown
      expiresAt?: unknown
    }

    return (
      typeof parsed.userId === 'string' &&
      parsed.userId === expectedUserId &&
      typeof parsed.authSessionId === 'string' &&
      parsed.authSessionId === expectedAuthSessionId &&
      typeof parsed.expiresAt === 'number' &&
      parsed.expiresAt > now
    )
  } catch {
    return false
  }
}
