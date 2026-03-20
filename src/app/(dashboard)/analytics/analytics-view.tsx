'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import AnalyticsClient from './analytics-client'
import type {
  AnalyticsAuditEntry,
  AnalyticsBreakdownItem,
  AnalyticsLinePoint,
  AnalyticsSeries,
  AnalyticsServerTrafficItem,
  AnalyticsViewData,
} from './analytics-types'

type Viewport = 'phone' | 'tablet' | 'desktop'

const cardStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '20px',
}

const rowCardStyle: CSSProperties = {
  background: '#0A0A0A',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  padding: '14px',
}

export default function AnalyticsView({
  data,
  initialEntries,
  totalEntries,
}: {
  data: AnalyticsViewData
  initialEntries: AnalyticsAuditEntry[]
  totalEntries: number
}) {
  const viewport = useAnalyticsViewport()
  const compact = viewport === 'phone'
  const pulseColumns = viewport === 'desktop' ? 'repeat(3, minmax(0, 1fr))' : viewport === 'tablet' ? 'repeat(2, minmax(0, 1fr))' : '1fr'
  const chartColumns = viewport === 'desktop' ? 'repeat(2, minmax(0, 1fr))' : '1fr'

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <section style={{ ...cardStyle, padding: compact ? '16px' : '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: compact ? '17px' : '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Operations Pulse
            </h2>
            <p style={{ fontSize: '13px', color: '#666666', margin: '8px 0 0', lineHeight: 1.6 }}>
              Core platform stats across activity, traffic, requests, and certificate coverage.
            </p>
          </div>
          <span style={badgeStyle('var(--accent)')}>
            {data.activeServerCount} active server{data.activeServerCount === 1 ? '' : 's'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: pulseColumns, gap: '12px' }}>
          {data.metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} compact={compact} />
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: chartColumns, gap: '16px' }}>
        <ChartCard title="Activity Trend" subtitle="Administrative activity over the last seven days." badge={`Avg ${data.dailyAverage}/day`} badgeColor="#60A5FA" compact={compact}>
          <LineChart points={data.activityTrend} color="var(--accent)" viewport={viewport} />
        </ChartCard>

        <ChartCard title="Connected Users Trend" subtitle="Recorded active connections by day across the last seven days." badge={`Peak ${data.peakConnectedUsers}`} badgeColor="#22C55E" compact={compact}>
          <LineChart points={data.connectedUsersTrend} color="#22C55E" viewport={viewport} />
        </ChartCard>

        <ChartCard title="Traffic Trend" subtitle="Recorded session traffic by day from connection history." badge={`Peak ${data.peakTraffic}`} badgeColor="var(--accent)" compact={compact}>
          <LineChart points={data.trafficTrend} color="#F97316" viewport={viewport} />
        </ChartCard>

        <ChartCard title="Inbound Traffic" subtitle="Daily inbound traffic across recorded and live VPN sessions." badge={`Peak ${data.peakInboundTraffic}`} badgeColor="#22C55E" compact={compact}>
          <LineChart points={data.inboundTrafficTrend} color="#22C55E" viewport={viewport} />
        </ChartCard>

        <ChartCard title="Outbound Traffic" subtitle="Daily outbound traffic across recorded and live VPN sessions." badge={`Peak ${data.peakOutboundTraffic}`} badgeColor="#60A5FA" compact={compact}>
          <LineChart points={data.outboundTrafficTrend} color="#60A5FA" viewport={viewport} />
        </ChartCard>

        <ChartCard title="Operator Activity" subtitle="Daily activity trend for the most active operators." badge={data.topOperatorCount > 0 ? `${data.topOperatorCount} operators` : 'No activity'} badgeColor="#60A5FA" compact={compact}>
          {data.operatorSeries.length === 0 ? <EmptyState text="No recent operator activity." /> : <MultiLineChart series={data.operatorSeries} viewport={viewport} />}
        </ChartCard>

        <ChartCard title="Provisioning Pipeline" subtitle="Current request distribution across pipeline states." badge={`${data.openRequestCount} requests`} badgeColor="#F59E0B" compact={compact}>
          <PieChart data={data.requestBreakdown} compact={compact} />
        </ChartCard>

        <ChartCard title="Certificate Status" subtitle="Current certificate posture across the VPN user base." badge={`${data.certificateCoverage}% coverage`} badgeColor="#60A5FA" compact={compact}>
          <PieChart data={data.certificateBreakdown} compact={compact} />
        </ChartCard>
      </div>

      <section style={{ ...cardStyle, padding: compact ? '16px' : '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Server Traffic</h3>
            <p style={{ fontSize: '12px', color: '#666666', margin: '6px 0 0', lineHeight: 1.5 }}>
              Live traffic per server based on current connected sessions. Use it to spot the busiest VPN endpoints quickly.
            </p>
          </div>
          <span style={badgeStyle('#60A5FA')}>
            {data.serverTraffic.length} server{data.serverTraffic.length === 1 ? '' : 's'}
          </span>
        </div>

        {data.serverTraffic.length === 0 ? (
          <EmptyState text="No active servers available for traffic analysis." />
        ) : (
          <div style={{ overflowX: 'auto', marginInline: '-4px', paddingInline: '4px' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', background: '#0A0A0A', minWidth: '760px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(90px, 120px) minmax(120px, 150px) minmax(120px, 150px) minmax(220px, 1.2fr)', gap: '16px', padding: '12px 14px', borderBottom: '1px solid var(--border)', background: '#101010' }}>
                <TrafficHeaderCell label="Server" />
                <TrafficHeaderCell label="Sessions" />
                <TrafficHeaderCell label="Inbound" />
                <TrafficHeaderCell label="Outbound" />
                <TrafficHeaderCell label="Traffic Mix" />
              </div>

              {data.serverTraffic.map((server, index) => (
                <ServerTrafficRow key={server.id} server={server} maxServerTraffic={data.maxServerTraffic} isLast={index === data.serverTraffic.length - 1} />
              ))}
            </div>
          </div>
        )}
      </section>

      <AnalyticsClient initialEntries={initialEntries} totalEntries={totalEntries} />
    </div>
  )
}

function useAnalyticsViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>('desktop')

  useEffect(() => {
    const phoneMedia = window.matchMedia('(max-width: 720px)')
    const tabletMedia = window.matchMedia('(max-width: 1080px)')
    const sync = () => {
      if (phoneMedia.matches) setViewport('phone')
      else if (tabletMedia.matches) setViewport('tablet')
      else setViewport('desktop')
    }

    sync()
    phoneMedia.addEventListener('change', sync)
    tabletMedia.addEventListener('change', sync)
    return () => {
      phoneMedia.removeEventListener('change', sync)
      tabletMedia.removeEventListener('change', sync)
    }
  }, [])

  return viewport
}

function MetricCard({ label, value, accent, helper, compact }: { label: string; value: string; accent: string; helper: string; compact: boolean }) {
  return (
    <div style={{ background: '#0A0A0A', border: '1px solid var(--border)', borderRadius: '14px', padding: compact ? '12px' : '14px', minHeight: compact ? '102px' : '108px', display: 'grid', alignContent: 'start' }}>
      <div style={{ fontSize: '11px', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: compact ? '22px' : '24px', fontWeight: 700, color: accent }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.45 }}>{helper}</div>
    </div>
  )
}

function ChartCard({ title, subtitle, badge, badgeColor, children, compact }: { title: string; subtitle: string; badge?: string; badgeColor?: string; children: ReactNode; compact: boolean }) {
  return (
    <section style={{ ...cardStyle, padding: compact ? '14px' : '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
          <p style={{ fontSize: '12px', color: '#666666', margin: '6px 0 0', lineHeight: 1.5 }}>{subtitle}</p>
        </div>
        {badge ? <span style={badgeStyle(badgeColor ?? 'var(--text-secondary)')}>{badge}</span> : null}
      </div>
      {children}
    </section>
  )
}

function LineChart({ points, color, viewport }: { points: AnalyticsLinePoint[]; color: string; viewport: Viewport }) {
  const maxValue = Math.max(...points.map((point) => point.value), 1)
  const width = 480
  const height = viewport === 'phone' ? 104 : 122
  const paddingX = viewport === 'phone' ? 12 : 16
  const paddingY = viewport === 'phone' ? 10 : 12
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2
  const visiblePoints = points.filter((_, index) => shouldDisplayXAxisLabel(index, points.length, viewport))
  const polyline = points
    .map((point, index) => {
      const x = paddingX + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth)
      const y = paddingY + chartHeight - (point.value / maxValue) * chartHeight
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: viewport === 'phone' ? '112px' : '128px', overflow: 'visible' }} preserveAspectRatio="none">
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="var(--border)" strokeWidth="1" />
        <polyline fill="none" stroke={color} strokeWidth={viewport === 'phone' ? '2.5' : '3'} strokeLinejoin="round" strokeLinecap="round" points={polyline} />
        {points.map((point, index) => {
          const x = paddingX + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth)
          const y = paddingY + chartHeight - (point.value / maxValue) * chartHeight
          return <circle key={`${point.date}-${index}`} cx={x} cy={y} r={viewport === 'phone' ? '3.5' : '4'} fill={color} />
        })}
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visiblePoints.length}, minmax(0, 1fr))`, gap: '8px' }}>
        {visiblePoints.map((point) => (
          <div key={point.date} style={{ textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {point.label ?? point.value}
            </div>
            <div style={{ fontSize: '11px', color: '#666666', marginTop: '4px' }}>{formatShortDay(point.date)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MultiLineChart({ series, viewport }: { series: AnalyticsSeries[]; viewport: Viewport }) {
  const width = 480
  const height = viewport === 'phone' ? 104 : 122
  const paddingX = viewport === 'phone' ? 12 : 16
  const paddingY = viewport === 'phone' ? 10 : 12
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2
  const maxValue = Math.max(...series.flatMap((item) => item.points.map((point) => point.value)), 1)
  const axisLabels = (series[0]?.points ?? []).filter((_, index, arr) => shouldDisplayXAxisLabel(index, arr.length, viewport)).map((point) => point.date)

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: viewport === 'phone' ? '112px' : '128px', overflow: 'visible' }} preserveAspectRatio="none">
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="var(--border)" strokeWidth="1" />
        {series.map((item) => {
          const polyline = item.points
            .map((point, index) => {
              const x = paddingX + (item.points.length === 1 ? chartWidth / 2 : (index / (item.points.length - 1)) * chartWidth)
              const y = paddingY + chartHeight - (point.value / maxValue) * chartHeight
              return `${x},${y}`
            })
            .join(' ')

          return <polyline key={item.label} fill="none" stroke={item.color} strokeWidth={viewport === 'phone' ? '2.25' : '2.5'} strokeLinejoin="round" strokeLinecap="round" points={polyline} />
        })}
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(axisLabels.length, 1)}, minmax(0, 1fr))`, gap: '8px' }}>
        {axisLabels.map((label) => (
          <div key={label} style={{ textAlign: 'center', fontSize: '11px', color: '#666666' }}>
            {formatShortDay(label)}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {series.map((item) => (
          <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', minWidth: 0 }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '9999px', background: item.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function PieChart({ data, compact }: { data: AnalyticsBreakdownItem[]; compact: boolean }) {
  const totalValue = data.reduce((sum, item) => sum + item.value, 0)
  const nonZeroItems = data.filter((item) => item.value > 0)
  let currentAngle = -90
  const chartSize = compact ? 136 : 148

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <svg viewBox="0 0 160 160" style={{ width: `${chartSize}px`, height: `${chartSize}px`, justifySelf: 'center', overflow: 'visible' }} aria-label="Pie chart">
        <circle cx="80" cy="80" r="58" fill="#0A0A0A" stroke="var(--border)" strokeWidth="1" />
        {totalValue > 0 ? (
          nonZeroItems.length === 1 ? (
            <circle cx="80" cy="80" r="58" fill={nonZeroItems[0].color} />
          ) : (
            nonZeroItems.map((item) => {
              const angle = (item.value / totalValue) * 360
              const startAngle = currentAngle
              const endAngle = currentAngle + angle
              currentAngle = endAngle
              return <path key={item.label} d={describePieSlice(80, 80, 58, startAngle, endAngle)} fill={item.color} stroke="var(--surface)" strokeWidth="2" />
            })
          )
        ) : null}
        <circle cx="80" cy="80" r="34" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
        <text x="80" y="74" textAnchor="middle" style={{ fill: 'var(--text-primary)', fontSize: compact ? '16px' : '18px', fontWeight: 700 }}>{totalValue}</text>
        <text x="80" y="94" textAnchor="middle" style={{ fill: '#666666', fontSize: '11px' }}>{totalValue === 1 ? 'item' : 'items'}</text>
      </svg>

      <div style={{ display: 'grid', gap: '10px', minWidth: 0 }}>
        {data.map((item) => (
          <div key={item.label} style={{ ...rowCardStyle, padding: compact ? '10px' : '12px', display: 'grid', gap: '6px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', minWidth: 0 }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '9999px', background: item.color, display: 'inline-block', flexShrink: 0 }} />
                {item.label}
              </span>
              <span style={badgeStyle(item.color)}>
                {item.value}
                {' · '}
                {totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0}%
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{item.helper}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ServerTrafficRow({ server, maxServerTraffic, isLast }: { server: AnalyticsServerTrafficItem; maxServerTraffic: number; isLast: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(90px, 120px) minmax(120px, 150px) minmax(120px, 150px) minmax(220px, 1.2fr)', gap: '16px', padding: '14px', borderBottom: isLast ? 'none' : '1px solid var(--border)', alignItems: 'center' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.name}</div>
        <div style={{ fontSize: '11px', color: '#666666', marginTop: '4px' }}>{server.totalTraffic > 0 ? `${formatBytes(server.totalTraffic)} total live traffic` : 'No live traffic right now'}</div>
      </div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: server.liveSessions > 0 ? '#22C55E' : 'var(--text-secondary)' }}>{server.liveSessions}</div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#22C55E' }}>{formatBytes(server.bytesIn)}</div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>{formatBytes(server.bytesOut)}</div>
      <div style={{ display: 'grid', gap: '6px' }}>
        <div style={{ height: '8px', borderRadius: '9999px', background: '#171717', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max((server.totalTraffic / maxServerTraffic) * 100, server.totalTraffic > 0 ? 6 : 0)}%`, height: '100%', background: 'linear-gradient(90deg, #22C55E 0%, var(--accent) 100%)', borderRadius: '9999px' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#666666' }}>{server.totalTraffic > 0 ? `${Math.round((server.totalTraffic / maxServerTraffic) * 100)}% of busiest server` : 'Idle'}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            In {server.bytesIn > 0 || server.bytesOut > 0 ? Math.round((server.bytesIn / Math.max(server.totalTraffic, 1)) * 100) : 0}% / Out {server.bytesIn > 0 || server.bytesOut > 0 ? Math.round((server.bytesOut / Math.max(server.totalTraffic, 1)) * 100) : 0}%
          </span>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{text}</p>
}

function TrafficHeaderCell({ label }: { label: string }) {
  return <div style={{ fontSize: '10px', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{label}</div>
}

function badgeStyle(color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    fontWeight: 700,
    color,
    background: `${color}18`,
    border: `1px solid ${color}22`,
    borderRadius: '9999px',
    padding: '4px 8px',
    whiteSpace: 'normal',
  }
}

function shouldDisplayXAxisLabel(index: number, total: number, viewport: Viewport) {
  if (viewport === 'desktop') return true
  if (viewport === 'tablet') return index % 2 === 0 || index === total - 1
  return index === 0 || index === Math.floor((total - 1) / 2) || index === total - 1
}

function describePieSlice(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return [`M ${cx} ${cy}`, `L ${start.x} ${start.y}`, `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`, 'Z'].join(' ')
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180
  return { x: cx + radius * Math.cos(angleInRadians), y: cy + radius * Math.sin(angleInRadians) }
}

function formatShortDay(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en', { weekday: 'short' })
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, unitIndex)
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
