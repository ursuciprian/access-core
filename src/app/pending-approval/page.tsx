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
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '440px', background: 'rgba(18,18,18,0.94)',
        border: '1px solid var(--border)', borderRadius: '20px',
        padding: '40px 32px', textAlign: 'center',
        boxShadow: '0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        {/* Waiting icon */}
        <div style={{
          width: '56px', height: '56px', margin: '0 auto 20px',
          background: 'linear-gradient(180deg, rgba(255,183,125,0.18), rgba(255,140,0,0.10))', borderRadius: '14px',
          border: '1px solid rgba(255,183,125,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.03em' }}>
          Pending Approval
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
          Your access request has been submitted. An administrator will review and approve your account shortly.
        </p>

        {/* User info */}
        <div style={{
          padding: '14px', background: 'var(--elevated)', borderRadius: '12px',
          marginBottom: '24px', border: '1px solid var(--border-strong)',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Signed in as</p>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {session?.user?.email}
          </p>
          <span style={{
            display: 'inline-block', marginTop: '8px',
            padding: '3px 10px', borderRadius: '9999px', fontSize: '11px',
            fontWeight: 700, background: 'rgba(255,183,125,0.15)', color: 'var(--accent)',
          }}>
            AWAITING APPROVAL
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            style={{
              padding: '10px 20px', background: 'linear-gradient(to bottom, var(--accent), var(--accent-strong))', color: '#0A0A0A',
              fontSize: '14px', fontWeight: 700, borderRadius: '10px',
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
              color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600,
              borderRadius: '10px', border: '1px solid var(--border-strong)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Sign Out
          </button>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '24px' }}>
          Contact your administrator if you need immediate access.
        </p>
      </div>
    </div>
  )
}
