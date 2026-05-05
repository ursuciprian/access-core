'use client'

import { Suspense, useEffect, useState } from 'react'
import { SessionProvider, signOut, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import MfaQrCode from '@/components/auth/MfaQrCode'
import { getSafeCallbackUrl } from '../verify/navigation'

interface MfaSetupData {
  secret: string
  otpauthUri: string
  issuer: string
}

function MfaSetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'))
  const { data: session, status, update } = useSession()
  const [setup, setSetup] = useState<MfaSetupData | null>(null)
  const [code, setCode] = useState('')
  const [loadingSetup, setLoadingSetup] = useState(false)
  const [loadingEnable, setLoadingEnable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isApproved = Boolean((session?.user as Record<string, unknown> | undefined)?.isApproved)
  const mfaEnabled = Boolean((session?.user as Record<string, unknown> | undefined)?.mfaEnabled)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated' && !isApproved) {
      router.push('/pending-approval')
      return
    }

    if (status === 'authenticated' && mfaEnabled) {
      router.push(callbackUrl)
    }
  }, [callbackUrl, isApproved, mfaEnabled, router, status])

  async function handleStartSetup() {
    setLoadingSetup(true)
    setError(null)

    try {
      const response = await fetch('/api/profile/mfa/setup', { method: 'POST' })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError((data as Record<string, string>).error ?? 'Failed to start MFA setup')
        return
      }

      setSetup(data as MfaSetupData)
      setCode('')
    } finally {
      setLoadingSetup(false)
    }
  }

  async function handleEnable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoadingEnable(true)
    setError(null)

    try {
      const response = await fetch('/api/profile/mfa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError((data as Record<string, string>).error ?? 'Failed to enable MFA')
        return
      }

      await update({ mfaEnabled: true, mfaVerified: true })
      router.push(callbackUrl)
    } finally {
      setLoadingEnable(false)
    }
  }

  if (status === 'loading') {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-secondary)' }}>Loading...</div>
  }

  if (!session?.user) {
    return null
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'rgba(18,18,18,0.94)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>Set up multi-factor authentication</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 0', lineHeight: 1.6 }}>
            Your account has been approved. Before you can use AccessCore, you need to enroll an authenticator app.
          </p>
        </div>

        {error ? (
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '13px',
              color: '#FFB4AB',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        ) : null}

        {!setup ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>What you need</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Use Google Authenticator, 1Password, Authy, Microsoft Authenticator, or another TOTP-compatible app. We will generate a secret, then you’ll confirm setup with a 6-digit code.
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartSetup}
              disabled={loadingSetup}
              style={{
                width: '100%',
                background: loadingSetup ? 'var(--elevated)' : 'linear-gradient(to bottom, var(--accent), var(--accent-strong))',
                border: '1px solid transparent',
                borderRadius: '8px',
                padding: '12px 18px',
                fontSize: '14px',
                fontWeight: 600,
                color: loadingSetup ? 'var(--text-muted)' : '#0A0A0A',
                cursor: loadingSetup ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {loadingSetup ? 'Preparing setup...' : 'Start MFA setup'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleEnable} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>Scan with your authenticator app</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.6 }}>
                Scan this QR code with Google Authenticator, 1Password, Authy, or another TOTP-compatible app. If scanning is not available, use the manual key below.
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                <MfaQrCode value={setup.otpauthUri} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.6 }}>
                Manual key
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '10px',
                  padding: '12px',
                  wordBreak: 'break-all',
                }}
              >
                {setup.secret}
              </div>
            </div>

            <div>
              <label htmlFor="setup-mfa-code" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Enter the 6-digit code from your authenticator app
              </label>
              <input
                id="setup-mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{
                  width: '100%',
                  background: 'var(--elevated)',
                  border: '1px solid var(--border-hover)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '18px',
                  letterSpacing: '0.25em',
                  textAlign: 'center',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'var(--font-mono)',
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loadingEnable || code.length !== 6}
              style={{
                width: '100%',
                background: loadingEnable || code.length !== 6 ? 'var(--elevated)' : 'linear-gradient(to bottom, var(--accent), var(--accent-strong))',
                border: '1px solid transparent',
                borderRadius: '8px',
                padding: '12px 18px',
                fontSize: '14px',
                fontWeight: 600,
                color: loadingEnable || code.length !== 6 ? 'var(--text-muted)' : '#0A0A0A',
                cursor: loadingEnable || code.length !== 6 ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {loadingEnable ? 'Enabling MFA...' : 'Enable MFA and continue'}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            width: '100%',
            marginTop: '12px',
            padding: '10px 14px',
            fontSize: '13px',
            fontWeight: 500,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-strong)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

export default function MfaSetupPage() {
  return (
    <SessionProvider>
      <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-secondary)' }}>Loading...</div>}>
        <MfaSetupContent />
      </Suspense>
    </SessionProvider>
  )
}
