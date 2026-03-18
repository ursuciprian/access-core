'use client'

import React from 'react'

const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`

const shimmerBackground: React.CSSProperties = {
  background: 'linear-gradient(90deg, #1A1A1A 25%, #252525 50%, #1A1A1A 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s ease-in-out infinite',
  borderRadius: '6px',
}

function ShimmerStyle() {
  return <style>{shimmerKeyframes}</style>
}

export function SkeletonLine({ width = '100%', height = '14px' }: { width?: string; height?: string }) {
  return (
    <>
      <ShimmerStyle />
      <div style={{ ...shimmerBackground, width, height }} />
    </>
  )
}

export function SkeletonCard({ height = '120px' }: { height?: string }) {
  return (
    <>
      <ShimmerStyle />
      <div
        style={{
          background: '#111111',
          border: '1px solid #1E1E1E',
          borderRadius: '16px',
          padding: '20px',
          height,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          justifyContent: 'center',
        }}
      >
        <SkeletonLine width="40%" height="14px" />
        <SkeletonLine width="70%" height="16px" />
        <SkeletonLine width="55%" height="12px" />
        <SkeletonLine width="30%" height="12px" />
      </div>
    </>
  )
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      <ShimmerStyle />
      <div style={{ background: '#111111', borderRadius: '16px', border: '1px solid #1E1E1E', overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: '16px',
            padding: '12px 20px',
            background: '#1A1A1A',
            borderBottom: '1px solid #1E1E1E',
          }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <SkeletonLine key={`h-${i}`} width="60%" height="12px" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={`r-${rowIdx}`}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: '16px',
              padding: '12px 20px',
              borderBottom: rowIdx < rows - 1 ? '1px solid #1E1E1E' : 'none',
            }}
          >
            {Array.from({ length: columns }).map((_, colIdx) => (
              <SkeletonLine key={`c-${rowIdx}-${colIdx}`} width={colIdx === 0 ? '80%' : '50%'} height="14px" />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

export function SkeletonStatCard() {
  return (
    <>
      <ShimmerStyle />
      <div
        style={{
          background: '#111111',
          border: '1px solid #1E1E1E',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <SkeletonLine width="50%" height="12px" />
        <SkeletonLine width="40%" height="28px" />
      </div>
    </>
  )
}
