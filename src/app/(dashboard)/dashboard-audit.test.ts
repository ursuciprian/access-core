import { extractDashboardAuditEntries } from '@/app/(dashboard)/dashboard-audit'

describe('extractDashboardAuditEntries', () => {
  it('prefers the current audit API entries shape', () => {
    const entries = [{ id: '1', action: 'USER_CREATED', actorEmail: 'admin@example.com', createdAt: '2026-03-20T10:00:00.000Z' }]

    expect(extractDashboardAuditEntries({ entries })).toEqual(entries)
  })

  it('supports the legacy logs shape as a fallback', () => {
    const logs = [{ id: '2', action: 'ACCESS_REQUEST_APPROVED', actorEmail: 'admin@example.com', createdAt: '2026-03-20T11:00:00.000Z' }]

    expect(extractDashboardAuditEntries({ logs })).toEqual(logs)
  })

  it('returns an empty array for invalid payloads', () => {
    expect(extractDashboardAuditEntries(null)).toEqual([])
    expect(extractDashboardAuditEntries({})).toEqual([])
  })
})
