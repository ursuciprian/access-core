export interface AnalyticsAuditEntry {
  id: string
  action: string
  actorEmail: string
  createdAt: string
  targetType: string
  targetId: string
  details?: Record<string, unknown> | null
}

export interface AnalyticsMetric {
  label: string
  value: string
  accent: string
  helper: string
}

export interface AnalyticsLinePoint {
  date: string
  value: number
  label?: string
}

export interface AnalyticsSeries {
  label: string
  color: string
  points: AnalyticsLinePoint[]
}

export interface AnalyticsBreakdownItem {
  label: string
  value: number
  color: string
  helper: string
}

export interface AnalyticsServerTrafficItem {
  id: string
  name: string
  liveSessions: number
  bytesIn: number
  bytesOut: number
  totalTraffic: number
}

export interface AnalyticsViewData {
  activeServerCount: number
  metrics: AnalyticsMetric[]
  activityTrend: AnalyticsLinePoint[]
  connectedUsersTrend: AnalyticsLinePoint[]
  trafficTrend: AnalyticsLinePoint[]
  inboundTrafficTrend: AnalyticsLinePoint[]
  outboundTrafficTrend: AnalyticsLinePoint[]
  operatorSeries: AnalyticsSeries[]
  requestBreakdown: AnalyticsBreakdownItem[]
  certificateBreakdown: AnalyticsBreakdownItem[]
  dailyAverage: number
  peakConnectedUsers: number
  peakTraffic: string
  peakInboundTraffic: string
  peakOutboundTraffic: string
  topOperatorCount: number
  openRequestCount: number
  certificateCoverage: number
  serverTraffic: AnalyticsServerTrafficItem[]
  maxServerTraffic: number
}
