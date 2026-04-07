import { NextRequest, NextResponse } from 'next/server'

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function parseOrigin(value: string | null): string | null {
  if (!value) {
    return null
  }

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function getTrustedOrigins(request: NextRequest): Set<string> {
  const origins = new Set<string>()
  const requestOrigin = parseOrigin(request.nextUrl.origin)

  if (requestOrigin) {
    origins.add(requestOrigin)
  }

  const configuredOrigins = [
    process.env.NEXTAUTH_URL,
    ...(process.env.CSRF_TRUSTED_ORIGINS?.split(',') ?? []),
  ]

  for (const candidate of configuredOrigins) {
    const origin = parseOrigin(candidate?.trim() ?? null)
    if (origin) {
      origins.add(origin)
    }
  }

  return origins
}

export function isMutationMethod(method: string): boolean {
  return MUTATION_METHODS.has(method.toUpperCase())
}

export function enforceTrustedOriginForMutation(request: NextRequest): NextResponse | null {
  if (!isMutationMethod(request.method)) {
    return null
  }

  const trustedOrigins = getTrustedOrigins(request)
  const origin = parseOrigin(request.headers.get('origin'))

  if (origin && trustedOrigins.has(origin)) {
    return null
  }

  const refererOrigin = parseOrigin(request.headers.get('referer'))

  if (refererOrigin && trustedOrigins.has(refererOrigin)) {
    return null
  }

  return NextResponse.json(
    { error: 'Forbidden: cross-site request blocked' },
    { status: 403 }
  )
}
