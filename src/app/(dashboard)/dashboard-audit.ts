export interface DashboardAuditEntry {
  id: string
  action: string
  actorEmail: string
  createdAt: string
}

export function extractDashboardAuditEntries(payload: unknown): DashboardAuditEntry[] {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const candidate = payload as {
    entries?: unknown
    logs?: unknown
  }

  if (Array.isArray(candidate.entries)) {
    return candidate.entries as DashboardAuditEntry[]
  }

  if (Array.isArray(candidate.logs)) {
    return candidate.logs as DashboardAuditEntry[]
  }

  return []
}
