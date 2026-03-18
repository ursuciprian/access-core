'use client'

import { Suspense, useEffect, useState } from 'react'
import { SessionProvider, signOut, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import MfaQrCode from '@/components/auth/MfaQrCode'

interface MfaSetupData {
  secret: string
  otpauthUri: string
  issuer: string
}

function MfaSetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
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
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A', color: '#888888' }}>Loading...</div>
  }

  if (!session?.user) {
    return null
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0A0A0A',
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
          background: '#111111',
          border: '1px solid #1E1E1E',
          borderRadius: '16px',
          padding: '32px',
        }}
      >
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#F0F0F0', margin: 0 }}>Set up multi-factor authentication</h1>
          <p style={{ fontSize: '13px', color: '#888888', margin: '8px 0 0', lineHeight: 1.6 }}>
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
              color: '#EF4444',
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
                background: '#151515',
                border: '1px solid #1E1E1E',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#F0F0F0', marginBottom: '8px' }}>What you need</div>
              <div style={{ fontSize: '13px', color: '#888888', lineHeight: 1.6 }}>
                Use Google Authenticator, 1Password, Authy, Microsoft Authenticator, or another TOTP-compatible app. We will generate a secret, then you’ll confirm setup with a 6-digit code.
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartSetup}
              disabled={loadingSetup}
              style={{
                width: '100%',
                background: loadingSetup ? '#1A1A1A' : '#EA7E20',
                border: '1px solid transparent',
                borderRadius: '8px',
                padding: '12px 18px',
                fontSize: '14px',
                fontWeight: 600,
                color: loadingSetup ? '#555555' : '#FFFFFF',
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
                background: '#151515',
                border: '1px solid #1E1E1E',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#F0F0F0', marginBottom: '10px' }}>Scan with your authenticator app</div>
              <div style={{ fontSize: '13px', color: '#888888', marginBottom: '14px', lineHeight: 1.6 }}>
                Scan this QR code with Google Authenticator, 1Password, Authy, or another TOTP-compatible app. If scanning is not available, use the manual key below.
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                <MfaQrCode value={setup.otpauthUri} />
              </div>
              <div style={{ fontSize: '12px', color: '#888888', marginBottom: '10px', lineHeight: 1.6 }}>
                Manual key
              </div>
              <div
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '14px',
                  color: '#F0F0F0',
                  background: '#1A1A1A',
                  border: '1px solid #2A2A2A',
                  borderRadius: '8px',
                  padding: '12px',
                  wordBreak: 'break-all',
                }}
              >
                {setup.secret}
              </div>
            </div>

            <div>
              <label htmlFor="setup-mfa-code" style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888888', marginBottom: '6px' }}>
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
                  background: '#1A1A1A',
                  border: '1px solid #333333',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '18px',
                  letterSpacing: '0.25em',
                  textAlign: 'center',
                  color: '#F0F0F0',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'ui-monospace, monospace',
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loadingEnable || code.length !== 6}
              style={{
                width: '100%',
                background: loadingEnable || code.length !== 6 ? '#1A1A1A' : '#EA7E20',
                border: '1px solid transparent',
                borderRadius: '8px',
                padding: '12px 18px',
                fontSize: '14px',
                fontWeight: 600,
                color: loadingEnable || code.length !== 6 ? '#555555' : '#FFFFFF',
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
            color: '#888888',
            border: '1px solid #2A2A2A',
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
      <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A', color: '#888888' }}>Loading...</div>}>
        <MfaSetupContent />
      </Suspense>
    </SessionProvider>
  )
}
