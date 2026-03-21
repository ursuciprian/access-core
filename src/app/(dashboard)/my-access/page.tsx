'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getAccessJourneyState, getLatestRecoveryRequest, type MyAccessEntry, type MyAccessRequestEntry } from './access-journey'

interface ProfileResponse {
  access: MyAccessEntry[]
}

const platformGuides = {
  windows: {
    label: 'Windows',
    downloadHref: 'https://openvpn.net/connect-docs/windows-release-notes.html',
    steps: [
      'Install OpenVPN Connect for Windows.',
      'Download your .ovpn file below.',
      'Open OpenVPN Connect and import the downloaded profile.',
    ],
  },
  macos: {
    label: 'macOS',
    downloadHref: 'https://openvpn.net/connect-docs/macos-release-notes.html',
    steps: [
      'Install OpenVPN Connect for macOS.',
      'Download your .ovpn file below.',
      'Import the profile and approve any macOS network prompts.',
    ],
  },
  linux: {
    label: 'Linux',
    downloadHref: 'https://openvpn.net/connect-docs/linux-clients.html',
    steps: [
      'Install OpenVPN 3 or your preferred OpenVPN client.',
      'Download your .ovpn file below.',
      'Import or run the profile from your client to connect.',
    ],
  },
  ios: {
    label: 'iPhone / iPad',
    downloadHref: 'https://openvpn.net/connect-docs/ios-release-notes.html',
    steps: [
      'Install OpenVPN Connect from the App Store.',
      'Download the .ovpn profile to your device.',
      'Open it in OpenVPN Connect and allow the VPN configuration.',
    ],
  },
  android: {
    label: 'Android',
    downloadHref: 'https://openvpn.net/connect-docs/android-release-notes.html',
    steps: [
      'Install OpenVPN Connect from Google Play.',
      'Download the .ovpn profile to your device.',
      'Import the profile into OpenVPN Connect and connect.',
    ],
  },
} as const

type PlatformKey = keyof typeof platformGuides

const PROFILE_LIST_COLUMNS = 'minmax(240px, 1.9fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr) minmax(150px, 0.95fr) minmax(110px, 0.75fr) 168px'

export default function MyAccessPage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [requests, setRequests] = useState<MyAccessRequestEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState<PlatformKey>('windows')

  useEffect(() => {
    Promise.all([
      fetch('/api/profile').then((response) => response.json()),
      fetch('/api/access-requests?mine=true').then((response) => response.json()),
    ])
      .then(([profileData, requestData]) => {
        setProfile(profileData as ProfileResponse)
        setRequests(Array.isArray(requestData) ? requestData : [])
      })
      .catch(() => {
        setProfile({ access: [] })
        setRequests([])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: 'var(--text-muted)' }}>Loading...</div>
  }

  const accessEntries = profile?.access ?? []
  const recoveryEntry = accessEntries.find((entry) => getAccessJourneyState(entry).needsRecovery) ?? null
  const latestRecoveryRequest = getLatestRecoveryRequest(requests)
  const selectedGuide = platformGuides[platform]

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {accessEntries.length === 0 ? (
        <section style={{
          textAlign: 'center',
          padding: '48px 24px',
          background: 'var(--surface)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            width: '48px', height: '48px', margin: '0 auto 16px',
            background: 'rgba(234,126,32,0.15)', borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <p style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>No approved VPN access is ready yet.</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
            {latestRecoveryRequest
              ? `Your latest request for ${latestRecoveryRequest.server.name} is ${latestRecoveryRequest.status.toLowerCase()}.`
              : 'Request access to start your VPN setup.'}
          </p>
          <Link
            href="/request-access"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '40px',
              padding: '0 16px',
              borderRadius: '12px',
              textDecoration: 'none',
              background: 'var(--button-primary)',
              color: 'var(--button-primary-text)',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {latestRecoveryRequest ? 'Request Access Again' : 'Request Access'}
          </Link>
        </section>
      ) : (
        <section
          style={{
            display: 'grid',
            gap: '12px',
            borderRadius: '16px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>VPN Profiles</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                Each server has its own OpenVPN profile. Download the one you want to use.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(recoveryEntry || latestRecoveryRequest) && (
                  <Link
                    href="/request-access"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '34px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#FCA5A5',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Request Recovery
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div
            id="vpn-profiles"
            style={{
              background: 'var(--surface)',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: PROFILE_LIST_COLUMNS,
              gap: '12px',
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              background: '#0F0F0F',
              alignItems: 'center',
            }}>
              <ListHeader>Server</ListHeader>
              <ListHeader align="center">Status</ListHeader>
              <ListHeader align="center">Certificate</ListHeader>
              <ListHeader align="center">Expiry</ListHeader>
              <ListHeader align="center">Account</ListHeader>
              <ListHeader align="right">Actions</ListHeader>
            </div>
            <div style={{ display: 'grid' }}>
              {accessEntries.map((entry, index) => {
                const state = getAccessJourneyState(entry)

                return (
                  <section
                    key={entry.id}
                    id={`vpn-profile-${entry.id}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: PROFILE_LIST_COLUMNS,
                      gap: '12px',
                      padding: '18px',
                      alignItems: 'center',
                      borderBottom: index === accessEntries.length - 1 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{entry.server.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{entry.server.hostname}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
                        {state.message}
                        {state.expiryHint ? ` ${state.expiryHint}` : ''}
                      </div>
                    </div>

                    <div style={{ minWidth: 0, display: 'flex', justifyContent: 'center' }}>
                      <ToneBadge tone={state.tone}>{state.label}</ToneBadge>
                    </div>

                    <ListValue align="center">
                      <ToneBadge tone={getCertificateTone(entry.certStatus)}>
                        {formatStatusLabel(entry.certStatus)}
                      </ToneBadge>
                    </ListValue>
                    <ListValue align="center">{entry.certExpiresAt ? new Date(entry.certExpiresAt).toLocaleDateString() : 'No expiry reported'}</ListValue>
                    <ListValue align="center">
                      <ToneBadge tone={entry.isEnabled ? '#22C55E' : '#EF4444'}>
                        {entry.isEnabled ? 'Enabled' : 'Disabled'}
                      </ToneBadge>
                    </ListValue>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', minWidth: 0 }}>
                      {state.canDownload ? (
                        <a
                          href={`/api/servers/${entry.server.id}/download-config`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '36px',
                            padding: '0 12px',
                            borderRadius: '10px',
                            textDecoration: 'none',
                            background: 'var(--button-primary)',
                            color: 'var(--button-primary-text)',
                            fontSize: '12px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >Download .ovpn</a>
                      ) : (
                        <Link
                          href="/request-access"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '36px',
                            padding: '0 12px',
                            borderRadius: '10px',
                            textDecoration: 'none',
                            background: 'var(--button-primary)',
                            color: 'var(--button-primary-text)',
                            fontSize: '12px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >Request Recovery</Link>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <section
        id="vpn-setup-guide"
        style={{
        background: 'var(--surface)',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        padding: '24px',
      }}
      >
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Setup Guide</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.6 }}>
            Pick your device, install OpenVPN Connect, then import the profile you downloaded from the correct server card above.
          </p>
          </div>
          <a
            href={selectedGuide.downloadHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '36px',
              padding: '0 12px',
              borderRadius: '10px',
              textDecoration: 'none',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            Download OpenVPN Connect
          </a>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {(Object.keys(platformGuides) as PlatformKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setPlatform(key)}
              style={{
                padding: '8px 12px',
                borderRadius: '9999px',
                border: platform === key ? '1px solid rgba(234,126,32,0.3)' : '1px solid var(--border)',
                background: platform === key ? 'rgba(234,126,32,0.12)' : 'transparent',
                color: platform === key ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {platformGuides[key].label}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {selectedGuide.steps.map((step, index) => (
            <div key={step} style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#0A0A0A',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '9999px',
                background: 'rgba(234,126,32,0.14)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {index + 1}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.55 }}>{step}</div>
            </div>
          ))}
          <div style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(234,126,32,0.08)',
            border: '1px solid rgba(234,126,32,0.16)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}>
            You can usually import the same <code style={{ color: 'var(--text-primary)' }}>.ovpn</code> profile on multiple devices, but it will behave as one shared VPN identity.
          </div>
        </div>
      </section>
    </div>
  )
}

function ListHeader({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <div style={{
      fontSize: '11px',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      fontWeight: 700,
      textAlign: align,
      display: 'flex',
      justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
      alignItems: 'center',
    }}>
      {children}
    </div>
  )
}

function ListValue({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <div style={{
      fontSize: '13px',
      color: 'var(--text-primary)',
      fontWeight: 500,
      textAlign: align,
      display: 'flex',
      justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
      alignItems: 'center',
    }}>
      {children}
    </div>
  )
}

function ToneBadge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 10px',
      borderRadius: '9999px',
      background: `${tone}14`,
      color: tone,
      fontSize: '11px',
      fontWeight: 700,
      whiteSpace: 'nowrap',
      textAlign: 'center',
    }}>
      {children}
    </span>
  )
}

function getCertificateTone(status: string) {
  switch (status) {
    case 'ACTIVE':
      return '#22C55E'
    case 'REVOKED':
    case 'EXPIRED':
      return '#EF4444'
    default:
      return '#F59E0B'
  }
}

function formatStatusLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
