'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import ServerSectionNav from '@/components/servers/ServerSectionNav'
import ServerSubpageHeader from '@/components/servers/ServerSubpageHeader'

interface MismatchedFile {
  cn: string
  expected: string
  actual: string
}

interface DriftResult {
  missing: string[]
  extra: string[]
  mismatched: MismatchedFile[]
}

export default function DriftPage() {
  const params = useParams()
  const serverId = params.id as string

  const [checking, setChecking] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [result, setResult] = useState<DriftResult | null>(null)
  const [reconciled, setReconciled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedCn, setExpandedCn] = useState<string | null>(null)

  async function handleCheck() {
    setChecking(true)
    setError(null)
    setResult(null)
    setReconciled(false)
    try {
      const res = await fetch(`/api/servers/${serverId}/drift`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Drift check failed')
      }
      setResult(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setChecking(false)
    }
  }

  async function handleReconcile() {
    setReconciling(true)
    setError(null)
    try {
      const res = await fetch(`/api/servers/${serverId}/drift`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Reconciliation failed')
      }
      setReconciled(true)
      setResult(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setReconciling(false)
    }
  }

  const hasDrift =
    result !== null &&
    (result.missing.length > 0 || result.extra.length > 0 || result.mismatched.length > 0)

  return (
    <div>
      <ServerSubpageHeader
        backHref={`/servers/${serverId}`}
        backLabel="← Back to Server"
        title="Drift Detection"
      />

      <div style={{ marginBottom: '16px' }}>
        <ServerSectionNav serverId={serverId} />
      </div>

      {error && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.875rem',
            color: '#F87171',
          }}
        >
          {error}
        </div>
      )}

      {reconciled && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.875rem',
            color: '#4ADE80',
          }}
        >
          Reconciliation complete. All CCD files have been pushed to the server.
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          onClick={handleCheck}
          disabled={checking || reconciling}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--button-primary)',
            color: 'var(--button-primary-text)',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            cursor: checking || reconciling ? 'not-allowed' : 'pointer',
            opacity: checking || reconciling ? 0.5 : 1,
            fontFamily: 'inherit',
          }}
        >
          {checking ? 'Checking...' : 'Check Drift'}
        </button>

        {hasDrift && (
          <button
            onClick={handleReconcile}
            disabled={reconciling || checking}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--button-primary)',
              color: 'var(--button-primary-text)',
              borderRadius: '12px',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              cursor: reconciling || checking ? 'not-allowed' : 'pointer',
              opacity: reconciling || checking ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            {reconciling ? 'Reconciling...' : 'Reconcile'}
          </button>
        )}
      </div>

      {result !== null && !hasDrift && (
        <div
          style={{
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#4ADE80', fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
            No drift detected
          </div>
          <div style={{ color: '#22C55E', fontSize: '0.875rem' }}>
            All CCD files match the database state.
          </div>
        </div>
      )}

      {hasDrift && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Summary counts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div
              style={{
                background: 'rgba(245,158,11,0.15)',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#FBBF24' }}>{result.missing.length}</div>
              <div style={{ fontSize: '0.875rem', color: '#F59E0B' }}>Missing files</div>
              <div style={{ fontSize: '0.75rem', color: '#D97706', marginTop: '0.125rem' }}>In DB, not on server</div>
            </div>
            <div
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#F87171' }}>{result.extra.length}</div>
              <div style={{ fontSize: '0.875rem', color: '#EF4444' }}>Extra files</div>
              <div style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '0.125rem' }}>On server, not in DB</div>
            </div>
            <div
              style={{
                background: 'rgba(234,126,32,0.15)',
                border: '1px solid rgba(234,126,32,0.3)',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#60A5FA' }}>{result.mismatched.length}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--accent)' }}>Mismatched files</div>
              <div style={{ fontSize: '0.75rem', color: '#2563EB', marginTop: '0.125rem' }}>Content differs</div>
            </div>
          </div>

          {/* Missing files */}
          {result.missing.length > 0 && (
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border)',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                Missing CCD Files ({result.missing.length})
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {result.missing.map((cn) => (
                  <span
                    key={cn}
                    style={{
                      padding: '0.25rem 0.625rem',
                      background: 'rgba(245,158,11,0.15)',
                      color: '#FBBF24',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {cn}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Extra files */}
          {result.extra.length > 0 && (
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border)',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                Extra CCD Files ({result.extra.length})
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {result.extra.map((cn) => (
                  <span
                    key={cn}
                    style={{
                      padding: '0.25rem 0.625rem',
                      background: 'rgba(239,68,68,0.15)',
                      color: '#F87171',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {cn}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Mismatched files */}
          {result.mismatched.length > 0 && (
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border)',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                Mismatched CCD Files ({result.mismatched.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {result.mismatched.map((item) => (
                  <div
                    key={item.cn}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => setExpandedCn(expandedCn === item.cn ? null : item.cn)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.625rem 1rem',
                        background: 'var(--elevated)',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.cn}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {expandedCn === item.cn ? 'Hide diff' : 'Show diff'}
                      </span>
                    </button>
                    {expandedCn === item.cn && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          background: 'var(--surface-2)',
                        }}
                      >
                        <div style={{ padding: '0.75rem', borderRight: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                            Expected (DB)
                          </div>
                          <pre
                            style={{
                              fontSize: '0.75rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-secondary)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              margin: 0,
                            }}
                          >
                            {item.expected || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>empty</span>}
                          </pre>
                        </div>
                        <div style={{ padding: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                            Actual (Server)
                          </div>
                          <pre
                            style={{
                              fontSize: '0.75rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-secondary)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              margin: 0,
                            }}
                          >
                            {item.actual || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>empty</span>}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
