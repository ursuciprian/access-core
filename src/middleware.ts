import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { isMfaOnboardingRequired } from '@/lib/features'

export default withAuth(
  function middleware(req) {
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
        pathname.startsWith('/api/access-requests')

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

    if (token && token.mfaEnabled === true && token.mfaVerified !== true && !allowMfaVerification) {
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
    authorized: ({ token }) => {
      if (!token) return false

      const expiresAt = typeof token.sessionExpiresAt === 'number' ? token.sessionExpiresAt : null
      if (expiresAt !== null && Date.now() > expiresAt) {
        return false
      }

      return true
    },
  },
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: [
    '/((?!login|mfa/verify|request-access|api/auth|api/servers/public|api/health|_next/static|_next/image|favicon.ico|icon.svg).*)',
  ],
}
