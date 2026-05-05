import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { isMfaOnboardingRequired } from '@/lib/features'
import {
  isValidMfaVerificationCookie,
  MFA_VERIFICATION_COOKIE,
} from '@/lib/mfa-cookie'

function getSafeCallbackPath(value: string | null) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001F\u007F]/.test(value)
  ) {
    return '/'
  }

  return value
}

export default withAuth(
  async function middleware(req) {
    if (req.method === 'TRACE') {
      return new NextResponse(null, {
        status: 405,
        headers: {
          Allow: 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
        },
      })
    }

    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    const allowMfaVerification =
      pathname === '/mfa/verify' ||
      pathname === '/mfa/setup' ||
      pathname.startsWith('/api/profile/mfa') ||
      pathname.startsWith('/api/auth/mfa')

    if (token && token.isApproved === false) {
      const allowPendingApproval =
        pathname === '/pending-approval' ||
        pathname.startsWith('/api/access-requests') ||
        pathname === '/api/servers/public'

      if (!allowPendingApproval) {
        return NextResponse.redirect(new URL('/pending-approval', req.url))
      }
    }

    if (
      token &&
      token.isApproved === true &&
      isMfaOnboardingRequired() &&
      token.mfaEnabled !== true &&
      !allowMfaVerification
    ) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Forbidden: Multi-factor authentication setup required' },
          { status: 403 }
        )
      }

      const setupUrl = new URL('/mfa/setup', req.url)
      const callbackPath = `${pathname}${req.nextUrl.search ?? ''}`
      if (pathname !== '/mfa/setup' && callbackPath && callbackPath !== '/mfa/setup') {
        setupUrl.searchParams.set('callbackUrl', callbackPath)
      }
      return NextResponse.redirect(setupUrl)
    }

    const hasServerIssuedMfaVerification =
      typeof token?.userId === 'string' &&
      typeof token?.authSessionId === 'string' &&
      await isValidMfaVerificationCookie(
        req.cookies.get(MFA_VERIFICATION_COOKIE)?.value,
        token.userId,
        token.authSessionId
      )

    if (
      pathname === '/mfa/verify' &&
      token?.mfaEnabled === true &&
      hasServerIssuedMfaVerification
    ) {
      const callbackUrl = req.nextUrl.searchParams.get('callbackUrl')
      const destination = getSafeCallbackPath(callbackUrl)
      return NextResponse.redirect(new URL(destination, req.url))
    }

    if (
      token &&
      token.mfaEnabled === true &&
      !hasServerIssuedMfaVerification &&
      !allowMfaVerification
    ) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Forbidden: Multi-factor authentication required' },
          { status: 403 }
        )
      }

      return NextResponse.redirect(new URL('/mfa/verify', req.url))
    }

    return NextResponse.next()
  },
  {
  callbacks: {
    authorized: async ({ req, token }) => {
      if (!token) return false

      const expiresAt = typeof token.sessionExpiresAt === 'number' ? token.sessionExpiresAt : null
      if (expiresAt !== null && Date.now() > expiresAt) {
        return false
      }

      if (typeof token.authSessionId !== 'string' || typeof token.userId !== 'string') {
        return false
      }

      try {
        const response = await fetch(new URL('/api/auth/validate-session', req.url), {
          headers: {
            cookie: req.headers.get('cookie') ?? '',
          },
          cache: 'no-store',
        })
        return response.ok
      } catch {
        return false
      }
    },
  },
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: [
    '/((?!login|mfa/verify|request-access|api/auth|api/health|_next/static|_next/image|favicon.ico|icon.svg).*)',
  ],
}
