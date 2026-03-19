import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isAuthSessionActive } from '@/lib/auth-session'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  const authSessionId = typeof token.authSessionId === 'string' ? token.authSessionId : null
  const userId = typeof token.userId === 'string' ? token.userId : null
  const isActive = await isAuthSessionActive(authSessionId, userId)

  return NextResponse.json(
    { valid: isActive },
    {
      status: isActive ? 200 : 401,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
