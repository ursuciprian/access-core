import { getAccessJourneyState, getLatestRecoveryRequest } from './access-journey'

describe('access journey helpers', () => {
  it('marks active enabled access as ready', () => {
    expect(getAccessJourneyState({
      id: '1',
      approvedAt: '2026-03-21T10:00:00.000Z',
      server: { id: 'server-1', name: 'Prod', hostname: 'vpn.example.com' },
      certStatus: 'ACTIVE',
      certExpiresAt: '2026-06-01T00:00:00.000Z',
      isEnabled: true,
    }, new Date('2026-03-21T10:00:00.000Z'))).toMatchObject({
      label: 'Ready',
      canDownload: true,
      needsRecovery: false,
    })
  })

  it('marks revoked certificates as recovery states', () => {
    expect(getAccessJourneyState({
      id: '1',
      approvedAt: '2026-03-21T10:00:00.000Z',
      server: { id: 'server-1', name: 'Prod', hostname: 'vpn.example.com' },
      certStatus: 'REVOKED',
      certExpiresAt: null,
      isEnabled: true,
    })).toMatchObject({
      label: 'Certificate Revoked',
      canDownload: false,
      needsRecovery: true,
    })
  })

  it('warns when a certificate is nearing expiry', () => {
    expect(getAccessJourneyState({
      id: '1',
      approvedAt: '2026-03-21T10:00:00.000Z',
      server: { id: 'server-1', name: 'Prod', hostname: 'vpn.example.com' },
      certStatus: 'ACTIVE',
      certExpiresAt: '2026-04-01T00:00:00.000Z',
      isEnabled: true,
    }, new Date('2026-03-21T10:00:00.000Z'))).toMatchObject({
      label: 'Expiring Soon',
      canDownload: true,
    })
  })

  it('returns the latest non-approved request for recovery context', () => {
    expect(getLatestRecoveryRequest([
      {
        id: 'req-1',
        status: 'APPROVED',
        serverId: 'server-1',
        server: { name: 'Prod' },
        createdAt: '2026-03-20T10:00:00.000Z',
        reviewNote: null,
      },
      {
        id: 'req-2',
        status: 'EXPIRED',
        serverId: 'server-2',
        server: { name: 'Ops' },
        createdAt: '2026-03-21T10:00:00.000Z',
        reviewNote: 'Timed out',
      },
    ]))?.toMatchObject({
      id: 'req-2',
      status: 'EXPIRED',
    })
  })
})
