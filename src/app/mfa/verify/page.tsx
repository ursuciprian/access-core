'use client'

import { useEffect, useState } from 'react'
import { SessionProvider, signOut, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { getPostVerifyDestination, getSafeCallbackUrl } from './navigation'

function MfaVerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status, update } = useSession()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'))
  const isApproved = Boolean((session?.user as Record<string, unknown> | undefined)?.isApproved)
  const destination = getPostVerifyDestination({ callbackUrl, isApproved })

  useEffect(() => {
    if (status === 'loading') {
      return
    }

    if (!session?.user) {
      router.replace('/login')
      return
    }

    const user = session.user as Record<string, unknown>
    if (user.mfaEnabled === true && user.mfaVerified === true) {
      router.replace(destination)
    }
  }, [destination, router, session, status])

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError((data as Record<string, string>).error ?? 'Verification failed')
        return
      }

      void update({ mfaVerified: true, mfaEnabled: true }).catch(() => undefined)
      window.location.assign(destination)
    } catch {
      setError('Verification succeeded, but we could not continue your sign-in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-secondary)' }}>Loading...</div>
  }

  if (!session?.user || ((session.user as Record<string, unknown>).mfaEnabled === true && (session.user as Record<string, unknown>).mfaVerified === true)) {
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
          maxWidth: '420px',
          background: 'rgba(18,18,18,0.94)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>Verify your sign-in</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 0', lineHeight: 1.6 }}>
            Enter the 6-digit code from your authenticator app to continue to AccessCore.
          </p>
        </div>

        {error && (
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
        )}

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label htmlFor="mfa-code" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Authenticator Code
            </label>
            <input
              id="mfa-code"
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
            disabled={loading || code.length !== 6}
            style={{
              width: '100%',
              background: loading || code.length !== 6 ? 'var(--elevated)' : 'linear-gradient(to bottom, var(--accent), var(--accent-strong))',
              border: '1px solid transparent',
              borderRadius: '8px',
              padding: '12px 18px',
              fontSize: '14px',
              fontWeight: 600,
              color: loading || code.length !== 6 ? 'var(--text-muted)' : '#0A0A0A',
              cursor: loading || code.length !== 6 ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Verifying...' : 'Verify and continue'}
          </button>
        </form>

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
            borderRadius: '10px',
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

export default function MfaVerifyPage() {
  return (
    <SessionProvider>
      <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-secondary)' }}>Loading...</div>}>
        <MfaVerifyContent />
      </Suspense>
    </SessionProvider>
  )
}
