import { NextResponse } from 'next/server'
import { MFA_VERIFICATION_COOKIE } from './mfa-cookie'

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
