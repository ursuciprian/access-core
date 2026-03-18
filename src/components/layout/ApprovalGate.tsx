'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ApprovalGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  const isApproved = (session?.user as Record<string, unknown>)?.isApproved

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (isApproved === false) {
      router.push('/pending-approval')
    }
  }, [status, isApproved, router])

  if (status === 'loading' || isApproved === false) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: '#555',
      }}>
        Loading...
      </div>
    )
  }

  return <>{children}</>
}
