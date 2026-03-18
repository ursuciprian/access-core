'use client'

import { SessionProvider, useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function PendingApprovalPage() {
  return (
    <SessionProvider>
      <PendingApprovalContent />
    </SessionProvider>
  )
}

function PendingApprovalContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [checking, setChecking] = useState(false)

  const isApproved = (session?.user as Record<string, unknown>)?.isApproved
  const role = (session?.user as Record<string, unknown>)?.role as string

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
    // If already approved, redirect to dashboard
    if (isApproved) {
      router.push('/')
    }
  }, [status, isApproved, router])

  const handleCheckStatus = async () => {
    setChecking(true)
    // Force session refresh by reloading
    window.location.reload()
  }

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0A0A0A',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '440px', background: '#111',
        border: '1px solid #1E1E1E', borderRadius: '16px',
        padding: '40px 32px', textAlign: 'center',
      }}>
        {/* Waiting icon */}
        <div style={{
          width: '56px', height: '56px', margin: '0 auto 20px',
          background: 'rgba(234,126,32,0.15)', borderRadius: '14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EA7E20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#F0F0F0', marginBottom: '8px' }}>
          Pending Approval
        </h1>
        <p style={{ fontSize: '14px', color: '#888', marginBottom: '24px', lineHeight: 1.6 }}>
          Your access request has been submitted. An administrator will review and approve your account shortly.
        </p>

        {/* User info */}
        <div style={{
          padding: '14px', background: '#1A1A1A', borderRadius: '10px',
          marginBottom: '24px', border: '1px solid #2A2A2A',
        }}>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '4px' }}>Signed in as</p>
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#F0F0F0' }}>
            {session?.user?.email}
          </p>
          <span style={{
            display: 'inline-block', marginTop: '8px',
            padding: '3px 10px', borderRadius: '9999px', fontSize: '11px',
            fontWeight: 600, background: 'rgba(234,126,32,0.15)', color: '#EA7E20',
          }}>
            AWAITING APPROVAL
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            style={{
              padding: '10px 20px', background: '#EA7E20', color: '#FFF',
              fontSize: '14px', fontWeight: 600, borderRadius: '8px',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              opacity: checking ? 0.5 : 1,
            }}
          >
            {checking ? 'Checking...' : 'Check Status'}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              padding: '10px 20px', background: 'transparent',
              color: '#888', fontSize: '14px', fontWeight: 500,
              borderRadius: '8px', border: '1px solid #2A2A2A',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Sign Out
          </button>
        </div>

        <p style={{ fontSize: '11px', color: '#444', marginTop: '24px' }}>
          Contact your administrator if you need immediate access.
        </p>
      </div>
    </div>
  )
}
