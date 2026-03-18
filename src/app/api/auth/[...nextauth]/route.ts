import NextAuth from 'next-auth'
import { authOptions, withAuthRequestMetadata } from '@/lib/auth'

const handler = NextAuth(authOptions)

export async function GET(request: Request, context: Parameters<typeof handler>[1]): Promise<Response> {
  return withAuthRequestMetadata<Response>(request.headers, async () => handler(request, context) as Promise<Response>)
}

export async function POST(request: Request, context: Parameters<typeof handler>[1]): Promise<Response> {
  return withAuthRequestMetadata<Response>(request.headers, async () => handler(request, context) as Promise<Response>)
}
