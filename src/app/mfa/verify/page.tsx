'use client'

import { useState } from 'react'
import { SessionProvider, signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

function MfaVerifyContent() {
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      await update({ mfaVerified: true, mfaEnabled: true })
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A', color: '#888888' }}>Loading...</div>
  }

  if (!session?.user) {
    router.push('/login')
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
          maxWidth: '420px',
          background: '#111111',
          border: '1px solid #1E1E1E',
          borderRadius: '16px',
          padding: '32px',
        }}
      >
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#F0F0F0', margin: 0 }}>Verify your sign-in</h1>
          <p style={{ fontSize: '13px', color: '#888888', margin: '8px 0 0', lineHeight: 1.6 }}>
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
              color: '#EF4444',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label htmlFor="mfa-code" style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888888', marginBottom: '6px' }}>
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
            disabled={loading || code.length !== 6}
            style={{
              width: '100%',
              background: loading || code.length !== 6 ? '#1A1A1A' : '#EA7E20',
              border: '1px solid transparent',
              borderRadius: '8px',
              padding: '12px 18px',
              fontSize: '14px',
              fontWeight: 600,
              color: loading || code.length !== 6 ? '#555555' : '#FFFFFF',
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

export default function MfaVerifyPage() {
  return (
    <SessionProvider>
      <MfaVerifyContent />
    </SessionProvider>
  )
}
