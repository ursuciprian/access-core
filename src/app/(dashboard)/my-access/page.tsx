'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface ApprovedAccess {
  id: string
  server: { id: string; name: string; hostname: string }
  createdAt: string
}

export default function MyAccessPage() {
  const { data: session } = useSession()
  const [approved, setApproved] = useState<ApprovedAccess[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/access-requests?status=APPROVED&mine=true')
      .then(r => r.json())
      .then(data => setApproved(Array.isArray(data) ? data : []))
      .catch(() => setApproved([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: 'var(--text-muted)' }}>Loading...</div>
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Assigned Access</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>Download your VPN configuration files and certificates.</p>
      </div>

      {approved.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 0',
          background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)',
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
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>No approved access yet.</p>
          <a
            href="/request-access"
            style={{
              display: 'inline-block', padding: '8px 20px',
              background: 'var(--button-primary)', color: 'var(--button-primary-text)', fontSize: '14px',
              fontWeight: 600, borderRadius: '12px', textDecoration: 'none',
            }}
          >
            Request Access
          </a>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {approved.map(a => (
            <div key={a.id} style={{
              background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)',
              padding: '24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'rgba(34,197,94,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    {a.server.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{a.server.hostname}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Download .ovpn config */}
                <a
                  href={`/api/servers/${a.server.id}/download-config`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', background: 'var(--elevated)', borderRadius: '8px',
                    border: '1px solid var(--border-strong)', textDecoration: 'none',
                    fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
                    cursor: 'pointer', transition: 'border-color 150ms',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download OpenVPN Config (.ovpn)
                </a>

                {/* OpenVPN Connect links */}
                <div style={{
                  padding: '12px 14px', background: 'var(--elevated)', borderRadius: '8px',
                  border: '1px solid var(--border-strong)',
                }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 500 }}>
                    INSTALL OPENVPN CLIENT
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Windows', href: 'https://openvpn.net/client/client-connect-vpn-for-windows/' },
                      { label: 'macOS', href: 'https://openvpn.net/client-connect-vpn-for-mac-os/' },
                      { label: 'Linux', href: 'https://openvpn.net/cloud-docs/owner/connectors/connector-user-guides/openvpn-3-client-for-linux.html' },
                      { label: 'iOS', href: 'https://apps.apple.com/app/openvpn-connect/id590379981' },
                      { label: 'Android', href: 'https://play.google.com/store/apps/details?id=net.openvpn.openvpn' },
                    ].map(link => (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '4px 10px', background: 'rgba(234,126,32,0.1)',
                          border: '1px solid rgba(234,126,32,0.2)', borderRadius: '6px',
                          fontSize: '12px', color: 'var(--accent)', textDecoration: 'none',
                          fontWeight: 500,
                        }}
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '12px' }}>
                Approved on {new Date(a.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
