'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  CredentialsSignin: 'Incorrect email or password.',
  AccessDenied: 'Sign-in is not allowed for this account.',
  default: 'Something went wrong. Please try again.',
}

function LoginContent() {
  const params = useSearchParams()
  const router = useRouter()
  const error = params.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [providers, setProviders] = useState<Record<string, { id: string; name: string }> | null>(null)

  useEffect(() => {
    fetch('/api/auth/providers')
      .then((response) => response.json())
      .then((data) => setProviders(data))
      .catch(() => setProviders({}))
  }, [])

  const googleProvider = providers?.google
  const oidcProvider = providers?.oidc

  const errorMessage = localError
    ? localError
    : error
      ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default)
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setLocalError(ERROR_MESSAGES.invalid_credentials)
    } else {
      router.push('/')
    }
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
          maxWidth: '400px',
          background: '#111111',
          border: '1px solid #1E1E1E',
          borderRadius: '16px',
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              margin: '0 auto 16px',
              background: 'rgba(59, 130, 246, 0.15)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EA7E20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#F0F0F0',
              marginBottom: '6px',
            }}
          >
            AccessCore
          </h1>
          <p style={{ fontSize: '13px', color: '#888888' }}>
            Sign in to manage VPN access and operations.
          </p>
        </div>

        {/* Error state */}
        {errorMessage && (
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '13px',
              color: '#EF4444',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Credentials form */}
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="email"
              style={{ fontSize: '12px', color: '#888888', fontWeight: 500 }}
            >
              Email or username
            </label>
            <input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{
                background: '#1A1A1A',
                border: '1px solid #333333',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '14px',
                color: '#F0F0F0',
                outline: 'none',
                fontFamily: 'inherit',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="password"
              style={{ fontSize: '12px', color: '#888888', fontWeight: 500 }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="********"
              style={{
                background: '#1A1A1A',
                border: '1px solid #333333',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '14px',
                color: '#F0F0F0',
                outline: 'none',
                fontFamily: 'inherit',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#1A1A1A' : '#EA7E20',
              border: '1px solid transparent',
              borderRadius: '8px',
              padding: '12px 18px',
              fontSize: '14px',
              fontWeight: 600,
              color: loading ? '#555555' : '#FFFFFF',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 150ms',
              fontFamily: 'inherit',
              marginTop: '4px',
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* External sign-in options */}
        {(googleProvider || oidcProvider) && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, height: '1px', background: '#1E1E1E' }} />
              <span style={{ fontSize: '11px', color: '#444444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: '#1E1E1E' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {oidcProvider && (
                <button
                  type="button"
                  onClick={() => signIn(oidcProvider.id, { callbackUrl: '/' })}
                  style={secondaryAuthButtonStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#555555' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333333' }}
                >
                  Continue with {oidcProvider.name}
                </button>
              )}

              {googleProvider && (
                <button
                  type="button"
                  onClick={() => signIn(googleProvider.id, { callbackUrl: '/' })}
                  style={secondaryAuthButtonStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#555555' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333333' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Sign in with Google
                </button>
              )}
            </div>
          </>
        )}

        <p style={{ fontSize: '11px', color: '#444444', textAlign: 'center' }}>
          Access restricted to authorized users.
        </p>
      </div>
    </div>
  )
}

const secondaryAuthButtonStyle: React.CSSProperties = {
  width: '100%',
  background: '#1A1A1A',
  border: '1px solid #333333',
  borderRadius: '8px',
  padding: '12px 18px',
  fontSize: '14px',
  fontWeight: 500,
  color: '#F0F0F0',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  transition: 'border-color 150ms',
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
