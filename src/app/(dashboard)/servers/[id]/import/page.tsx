'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ServerSectionNav from '@/components/servers/ServerSectionNav'
import ServerSubpageHeader from '@/components/servers/ServerSubpageHeader'

interface DiscoveredUser {
  commonName: string
  routes: string[]
  certStatus: 'ACTIVE' | 'REVOKED' | 'NONE'
}

interface GroupOption {
  id: string
  name: string
}

interface UserMapping {
  commonName: string
  email: string
  groupIds: string[]
}

interface ImportSummary {
  imported: number
  errors: Array<{ cn: string; error: string }>
}

export default function ImportPage() {
  const params = useParams()
  const serverId = params.id as string

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [discovering, setDiscovering] = useState(false)
  const [discovered, setDiscovered] = useState<DiscoveredUser[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [mappings, setMappings] = useState<UserMapping[]>([])
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [serverManagementEnabled, setServerManagementEnabled] = useState(true)

  useEffect(() => {
    fetch('/api/system/status')
      .then((response) => response.json())
      .then((data) => {
        setServerManagementEnabled(data?.featureFlags?.serverManagementEnabled !== false)
      })
      .catch(() => {})
  }, [])

  async function handleDiscover() {
    if (!serverManagementEnabled) {
      setError('Server management is disabled by environment configuration.')
      return
    }
    setDiscovering(true)
    setError(null)
    try {
      const [discoverRes, serverRes] = await Promise.all([
        fetch(`/api/servers/${serverId}/import`),
        fetch(`/api/servers/${serverId}`),
      ])

      if (!discoverRes.ok) {
        const data = await discoverRes.json()
        throw new Error(data.error ?? 'Discovery failed')
      }

      const discoveredData: DiscoveredUser[] = await discoverRes.json()
      const serverData = serverRes.ok ? await serverRes.json() : {}

      setDiscovered(discoveredData)
      setGroups(Array.isArray(serverData.groups) ? serverData.groups : [])
      setMappings(
        discoveredData.map((u) => ({ commonName: u.commonName, email: '', groupIds: [] }))
      )
      setStep(2)
    } catch (err) {
      setError(String(err))
    } finally {
      setDiscovering(false)
    }
  }

  function updateMapping(index: number, field: 'email', value: string): void
  function updateMapping(index: number, field: 'groupIds', value: string[]): void
  function updateMapping(index: number, field: 'email' | 'groupIds', value: string | string[]) {
    setMappings((prev) => {
      const next = [...prev]
      if (field === 'email') {
        next[index] = { ...next[index], email: value as string }
      } else {
        next[index] = { ...next[index], groupIds: value as string[] }
      }
      return next
    })
  }

  function toggleGroup(index: number, groupId: string) {
    setMappings((prev) => {
      const next = [...prev]
      const current = next[index].groupIds
      next[index] = {
        ...next[index],
        groupIds: current.includes(groupId)
          ? current.filter((id) => id !== groupId)
          : [...current, groupId],
      }
      return next
    })
  }

  async function handleImport() {
    if (!serverManagementEnabled) {
      setError('Server management is disabled by environment configuration.')
      return
    }
    setImporting(true)
    setError(null)
    try {
      const res = await fetch(`/api/servers/${serverId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: mappings }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Import failed')
      }

      setSummary(data)
      setStep(3)
    } catch (err) {
      setError(String(err))
    } finally {
      setImporting(false)
    }
  }

  const certStatusBadge = (status: string) => {
    const styles: Record<string, React.CSSProperties> = {
      ACTIVE: { background: 'rgba(34,197,94,0.15)', color: '#22C55E' },
      REVOKED: { background: 'rgba(239,68,68,0.15)', color: '#EF4444' },
      NONE: { background: 'rgba(255,255,255,0.06)', color: '#555555' },
    }
    return (
      <span
        style={{
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: 500,
          ...(styles[status] ?? styles.NONE),
        }}
      >
        {status}
      </span>
    )
  }

  return (
    <div>
      <ServerSubpageHeader
        backHref={`/servers/${serverId}`}
        backLabel="← Back to Server"
        title="Import VPN Users"
      />

      <div style={{ marginBottom: '16px' }}>
        <ServerSectionNav
          serverId={serverId}
          serverManagementEnabled={serverManagementEnabled}
        />
      </div>

      {!serverManagementEnabled && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '12px',
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.18)',
            borderRadius: '12px',
            fontSize: '0.875rem',
            color: '#93C5FD',
          }}
        >
          Server management is disabled by environment configuration. Import actions are unavailable.
        </div>
      )}

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2rem' }}>
        {(['1', '2', '3'] as const).map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                background: Number(s) <= step ? '#EA7E20' : '#1A1A1A',
                color: Number(s) <= step ? '#FFFFFF' : '#555555',
              }}
            >
              {s}
            </div>
            <span
              style={{
                fontSize: '0.875rem',
                color: Number(s) <= step ? '#F0F0F0' : '#555555',
                fontWeight: Number(s) <= step ? 500 : 400,
              }}
            >
              {['Discover', 'Map Users', 'Results'][i]}
            </span>
            {i < 2 && (
              <div
                style={{
                  width: '32px',
                  height: '1px',
                  background: '#1E1E1E',
                  margin: '0 4px',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '12px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '12px',
            fontSize: '0.875rem',
            color: '#EF4444',
          }}
        >
          {error}
        </div>
      )}

      {/* Step 1: Discover */}
      {step === 1 && (
        <div
          style={{
            background: '#111111',
            borderRadius: '16px',
            border: '1px solid #1E1E1E',
            padding: '24px',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#F0F0F0', marginBottom: '0.5rem' }}>
            Step 1: Discover Existing Users
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#888888', marginBottom: '1rem' }}>
            Scan the server CCD directory and EasyRSA to list all known VPN clients.
          </p>
          <button
            onClick={handleDiscover}
            disabled={discovering || !serverManagementEnabled}
            style={{
              padding: '8px 16px',
              background: (discovering || !serverManagementEnabled) ? 'rgba(234,126,32,0.5)' : '#EA7E20',
              color: '#FFFFFF',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 500,
              border: 'none',
              cursor: (discovering || !serverManagementEnabled) ? 'not-allowed' : 'pointer',
              opacity: (discovering || !serverManagementEnabled) ? 0.5 : 1,
            }}
          >
            {discovering ? 'Discovering...' : 'Discover'}
          </button>
        </div>
      )}

      {/* Step 2: Map users */}
      {step === 2 && (
        <div
          style={{
            background: '#111111',
            borderRadius: '16px',
            border: '1px solid #1E1E1E',
            padding: '24px',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#F0F0F0', marginBottom: '1rem' }}>
            Step 2: Map Users ({discovered.length} found)
          </h3>

          {discovered.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: '#888888' }}>No CCD files found on the server.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1E1E1E' }}>
                      <th style={{ textAlign: 'left', padding: '8px 16px 8px 0', fontWeight: 500, color: '#888888', background: '#1A1A1A' }}>Common Name</th>
                      <th style={{ textAlign: 'left', padding: '8px 16px 8px 0', fontWeight: 500, color: '#888888', background: '#1A1A1A' }}>Cert Status</th>
                      <th style={{ textAlign: 'left', padding: '8px 16px 8px 0', fontWeight: 500, color: '#888888', background: '#1A1A1A' }}>Routes</th>
                      <th style={{ textAlign: 'left', padding: '8px 16px 8px 0', fontWeight: 500, color: '#888888', background: '#1A1A1A' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 500, color: '#888888', background: '#1A1A1A' }}>Groups</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discovered.map((user, i) => (
                      <tr key={user.commonName} style={{ borderBottom: '1px solid #1E1E1E' }}>
                        <td style={{ padding: '12px 16px 12px 0', fontFamily: 'monospace', fontSize: '12px', color: '#F0F0F0' }}>{user.commonName}</td>
                        <td style={{ padding: '12px 16px 12px 0' }}>{certStatusBadge(user.certStatus)}</td>
                        <td style={{ padding: '12px 16px 12px 0', fontSize: '12px', color: '#888888' }}>
                          {user.routes.length > 0 ? user.routes.join(', ') : <span style={{ fontStyle: 'italic' }}>none</span>}
                        </td>
                        <td style={{ padding: '12px 16px 12px 0' }}>
                          <input
                            type="email"
                            value={mappings[i]?.email ?? ''}
                            onChange={(e) => updateMapping(i, 'email', e.target.value)}
                            disabled={!serverManagementEnabled}
                            placeholder="user@example.com"
                            style={{
                              width: '176px',
                              padding: '4px 8px',
                              background: '#1A1A1A',
                              border: '1px solid #333333',
                              borderRadius: '4px',
                              fontSize: '12px',
                              color: '#F0F0F0',
                              outline: 'none',
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px 0' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {groups.map((g) => (
                              <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={mappings[i]?.groupIds.includes(g.id) ?? false}
                                  onChange={() => toggleGroup(i, g.id)}
                                  disabled={!serverManagementEnabled}
                                  style={{ width: '14px', height: '14px', accentColor: '#EA7E20' }}
                                />
                                <span style={{ fontSize: '12px', color: '#F0F0F0' }}>{g.name}</span>
                              </label>
                            ))}
                            {groups.length === 0 && (
                              <span style={{ fontSize: '12px', color: '#555555', fontStyle: 'italic' }}>No groups available</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #1E1E1E',
                    color: '#F0F0F0',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || !serverManagementEnabled || mappings.every((m) => !m.email)}
                  style={{
                    padding: '8px 16px',
                    background: (importing || !serverManagementEnabled || mappings.every((m) => !m.email)) ? 'rgba(234,126,32,0.5)' : '#EA7E20',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    border: 'none',
                    cursor: (importing || !serverManagementEnabled || mappings.every((m) => !m.email)) ? 'not-allowed' : 'pointer',
                    opacity: (importing || !serverManagementEnabled || mappings.every((m) => !m.email)) ? 0.5 : 1,
                  }}
                >
                  {importing ? 'Importing...' : 'Import Users'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && summary && (
        <div
          style={{
            background: '#111111',
            borderRadius: '16px',
            border: '1px solid #1E1E1E',
            padding: '24px',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#F0F0F0', marginBottom: '1rem' }}>
            Step 3: Import Results
          </h3>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div
              style={{
                flex: 1,
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22C55E' }}>{summary.imported}</div>
              <div style={{ fontSize: '0.875rem', color: '#22C55E' }}>Imported</div>
            </div>
            <div
              style={{
                flex: 1,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#EF4444' }}>{summary.errors.length}</div>
              <div style={{ fontSize: '0.875rem', color: '#EF4444' }}>Errors</div>
            </div>
          </div>

          {summary.errors.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#F0F0F0', marginBottom: '8px' }}>Errors</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summary.errors.map((e) => (
                  <div
                    key={e.cn}
                    style={{
                      padding: '8px',
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#F0F0F0' }}>{e.cn}</span>
                    <span style={{ color: '#EF4444', marginLeft: '8px' }}>{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => { setStep(1); setDiscovered([]); setMappings([]); setSummary(null) }}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid #1E1E1E',
              color: '#F0F0F0',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  )
}
