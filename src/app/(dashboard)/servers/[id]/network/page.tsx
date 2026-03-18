'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useToast } from '@/components/ui/ToastProvider'
import ServerSectionNav from '@/components/servers/ServerSectionNav'
import ServerSubpageHeader from '@/components/servers/ServerSubpageHeader'

interface NetworkSettings {
  vpnNetwork: string
  dnsServers: string[]
  searchDomains: string[]
  routeMode: string
  splitTunnel: boolean
  compression: string
  protocol: string
  port: number
}

const cardStyle: React.CSSProperties = {
  background: '#111111',
  border: '1px solid #1E1E1E',
  borderRadius: '16px',
  padding: '20px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: '#1A1A1A',
  border: '1px solid #333333',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#F0F0F0',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: '#888888',
  marginBottom: '4px',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#F0F0F0',
  marginBottom: '16px',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: '32px',
}

const hintStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#555555',
  marginTop: '4px',
}

export default function ServerNetworkPage() {
  const params = useParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serverName, setServerName] = useState('')
  const [form, setForm] = useState<NetworkSettings>({
    vpnNetwork: '10.8.0.0/24',
    dnsServers: [],
    searchDomains: [],
    routeMode: 'NAT',
    splitTunnel: false,
    compression: 'off',
    protocol: 'udp',
    port: 1194,
  })
  const [dnsInput, setDnsInput] = useState('')
  const [domainsInput, setDomainsInput] = useState('')
  const [serverManagementEnabled, setServerManagementEnabled] = useState(true)

  useEffect(() => {
    fetch(`/api/servers/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) return
        setServerName(data.name || '')
        setForm({
          vpnNetwork: data.vpnNetwork || '10.8.0.0/24',
          dnsServers: data.dnsServers || [],
          searchDomains: data.searchDomains || [],
          routeMode: data.routeMode || 'NAT',
          splitTunnel: data.splitTunnel ?? false,
          compression: data.compression || 'off',
          protocol: data.protocol || 'udp',
          port: data.port || 1194,
        })
        setDnsInput((data.dnsServers || []).join(', '))
        setDomainsInput((data.searchDomains || []).join(', '))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.id])

  useEffect(() => {
    fetch('/api/system/status')
      .then((response) => response.json())
      .then((data) => {
        setServerManagementEnabled(data?.featureFlags?.serverManagementEnabled !== false)
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        vpnNetwork: form.vpnNetwork,
        dnsServers: dnsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        searchDomains: domainsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        routeMode: form.routeMode,
        splitTunnel: form.splitTunnel,
        compression: form.compression,
        protocol: form.protocol,
        port: form.port,
      }
      const res = await fetch(`/api/servers/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast('Network settings saved', 'success')
      } else {
        const data = await res.json()
        toast(data.error || 'Failed to save', 'error')
      }
    } catch {
      toast('Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <div style={{ height: '14px', width: '120px', background: '#1A1A1A', borderRadius: '4px', marginBottom: '24px' }} />
        <div style={{ height: '24px', width: '240px', background: '#1A1A1A', borderRadius: '4px', marginBottom: '24px' }} />
        <div style={{ ...cardStyle, height: '400px' }} />
      </div>
    )
  }

  return (
    <div>
      <ServerSubpageHeader
        backHref={`/servers/${params.id}`}
        backLabel={`← Back to ${serverName || 'Server'}`}
        title="Network Settings"
      />

      <div style={{ marginBottom: '16px' }}>
        <ServerSectionNav
          serverId={params.id as string}
          serverManagementEnabled={serverManagementEnabled}
        />
      </div>

      {!serverManagementEnabled && (
        <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', color: '#93C5FD', fontSize: '13px' }}>
          Server management is disabled by environment configuration. Network settings are currently read-only.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* VPN Network & Port */}
        <div style={cardStyle}>
          <h3 style={sectionTitleStyle}>VPN Network</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', gap: '16px', alignItems: 'start' }}>
            <div>
              <label style={labelStyle}>VPN Network (CIDR)</label>
              <input
                type="text"
                value={form.vpnNetwork}
                onChange={(e) => setForm({ ...form, vpnNetwork: e.target.value })}
                disabled={!serverManagementEnabled}
                style={inputStyle}
                placeholder="10.8.0.0/24"
              />
              <p style={hintStyle}>Subnet for VPN clients, e.g. 10.8.0.0/24</p>
            </div>
            <div>
              <label style={labelStyle}>Port</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 0 })}
                disabled={!serverManagementEnabled}
                style={inputStyle}
                min={1}
                max={65535}
              />
            </div>
          </div>
        </div>

        {/* Protocol & Routing */}
        <div style={cardStyle}>
          <h3 style={sectionTitleStyle}>Protocol &amp; Routing</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Protocol</label>
              <select
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value })}
                disabled={!serverManagementEnabled}
                style={selectStyle}
              >
                <option value="udp">UDP</option>
                <option value="tcp">TCP</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Route Mode</label>
              <select
                value={form.routeMode}
                onChange={(e) => setForm({ ...form, routeMode: e.target.value })}
                disabled={!serverManagementEnabled}
                style={selectStyle}
              >
                <option value="NAT">NAT</option>
                <option value="ROUTING">Routing</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#F0F0F0' }}>Split Tunnel</span>
              <p style={{ ...hintStyle, marginTop: '2px' }}>Only route VPN-specific traffic through the tunnel</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, splitTunnel: !form.splitTunnel })}
              disabled={!serverManagementEnabled}
              style={{
                width: '40px',
                height: '22px',
                borderRadius: '11px',
                border: 'none',
                cursor: serverManagementEnabled ? 'pointer' : 'not-allowed',
                opacity: serverManagementEnabled ? 1 : 0.5,
                position: 'relative',
                background: form.splitTunnel ? '#EA7E20' : '#333333',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  left: form.splitTunnel ? '20px' : '2px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  transition: 'left 0.2s',
                }}
              />
            </button>
          </div>
        </div>

        {/* DNS */}
        <div style={cardStyle}>
          <h3 style={sectionTitleStyle}>DNS</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>DNS Servers</label>
              <input
                type="text"
                value={dnsInput}
                onChange={(e) => setDnsInput(e.target.value)}
                disabled={!serverManagementEnabled}
                style={inputStyle}
                placeholder="8.8.8.8, 1.1.1.1"
              />
              <p style={hintStyle}>Comma-separated list of DNS server IPs</p>
            </div>
            <div>
              <label style={labelStyle}>Search Domains</label>
              <input
                type="text"
                value={domainsInput}
                onChange={(e) => setDomainsInput(e.target.value)}
                disabled={!serverManagementEnabled}
                style={inputStyle}
                placeholder="corp.example.com, internal.local"
              />
              <p style={hintStyle}>Comma-separated list of DNS search domains</p>
            </div>
          </div>
        </div>

        {/* Compression */}
        <div style={cardStyle}>
          <h3 style={sectionTitleStyle}>Compression</h3>
          <div style={{ maxWidth: '240px' }}>
            <label style={labelStyle}>Compression</label>
            <select
              value={form.compression}
              onChange={(e) => setForm({ ...form, compression: e.target.value })}
              disabled={!serverManagementEnabled}
              style={selectStyle}
            >
              <option value="off">Off</option>
              <option value="lzo">LZO</option>
              <option value="lz4">LZ4</option>
            </select>
          </div>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4px' }}>
          <button
            onClick={handleSave}
            disabled={saving || !serverManagementEnabled}
            style={{
              padding: '8px 20px',
              background: '#EA7E20',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '10px',
              border: 'none',
              cursor: saving || !serverManagementEnabled ? 'not-allowed' : 'pointer',
              opacity: saving || !serverManagementEnabled ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
