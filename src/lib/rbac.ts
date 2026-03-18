import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from './auth'
import { UserRole } from '@prisma/client'

interface SessionUser {
  name?: string | null
  email?: string | null
  image?: string | null
  role?: UserRole
  isApproved?: boolean
}

interface AuthenticatedSession {
  user: SessionUser
}

type RouteHandler = (
  req: NextRequest,
  session: AuthenticatedSession,
  context: any
) => Promise<NextResponse>

function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 })
}

async function getRequiredSession() {
  return await getServerSession(authOptions) as AuthenticatedSession | null
}

export async function requireSession(options?: {
  admin?: boolean
  approved?: boolean
}): Promise<NextResponse | AuthenticatedSession> {
  const requireApproved = options?.approved ?? true
  const session = await getRequiredSession()

  if (!session?.user?.email) {
    return unauthorizedResponse()
  }

  if (requireApproved && session.user.isApproved === false) {
    return forbiddenResponse('Forbidden: Account approval required')
  }

  if (options?.admin && session.user.role !== UserRole.ADMIN) {
    return forbiddenResponse('Forbidden: Admin access required')
  }

  return session
}

export function requireRole(role: UserRole) {
  return function (handler: RouteHandler) {
    return async function (req: NextRequest, context: any) {
      const result = await requireSession({
        admin: role === UserRole.ADMIN,
        approved: true,
      })
      if (result instanceof NextResponse) {
        return result
      }

      return handler(req, result, context)
    }
  }
}

export function requireAuth() {
  return function (handler: RouteHandler) {
    return async function (req: NextRequest, context: any) {
      const result = await requireSession({ approved: false })
      if (result instanceof NextResponse) {
        return result
      }

      return handler(req, result, context)
    }
  }
}

export function requireApprovedUser() {
  return function (handler: RouteHandler) {
    return async function (req: NextRequest, context: any) {
      const result = await requireSession({ approved: true })
      if (result instanceof NextResponse) {
        return result
      }

      return handler(req, result, context)
    }
  }
}

export function requireAdmin() {
  return function (handler: RouteHandler) {
    return async function (req: NextRequest, context: any) {
      const result = await requireSession({ admin: true, approved: true })
      if (result instanceof NextResponse) {
        return result
      }

      return handler(req, result, context)
    }
  }
}
