import { NextResponse } from 'next/server'
import { createMfaVerificationCookieValue, MFA_VERIFICATION_COOKIE } from './mfa-cookie'

const SESSION_COOKIE_NAMES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
]

export function clearAuthCookies(response: NextResponse) {
  for (const name of SESSION_COOKIE_NAMES) {
    response.cookies.set({
      name,
      value: '',
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: name.startsWith('__Secure-'),
    })
  }

  response.cookies.set({
    name: MFA_VERIFICATION_COOKIE,
    value: '',
    expires: new Date(0),
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function applyMfaVerificationCookie(
  response: NextResponse,
  sessionUser: Record<string, unknown> | null | undefined,
): Promise<boolean> {
  const userId = typeof sessionUser?.id === 'string' ? sessionUser.id : null
  const authSessionId =
    typeof sessionUser?.authSessionId === 'string' ? sessionUser.authSessionId : null
  const sessionExpiresAt =
    typeof sessionUser?.sessionExpiresAt === 'number' ? sessionUser.sessionExpiresAt : null

  if (!userId || !authSessionId || !sessionExpiresAt) {
    return false
  }

  response.cookies.set({
    name: MFA_VERIFICATION_COOKIE,
    value: await createMfaVerificationCookieValue(userId, authSessionId, sessionExpiresAt),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(sessionExpiresAt),
  })

  return true
}
