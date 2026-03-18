'use client'

import { useEffect } from 'react'

const variantColors: Record<string, string> = {
  success: '#22C55E',
  error: '#EF4444',
  info: '#60A5FA',
}

interface ToastProps {
  message: string
  variant: 'success' | 'error' | 'info'
  onClose: () => void
}

export default function Toast({ message, variant, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const color = variantColors[variant]

  return (
    <div
      style={{
        background: '#1A1A1A',
        borderLeft: `3px solid ${color}`,
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        minWidth: '280px',
        maxWidth: '400px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      <span style={{ fontSize: '13px', color: '#F0F0F0' }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: '#888888',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '0 2px',
          lineHeight: 1,
          fontFamily: 'inherit',
          flexShrink: 0,
        }}
      >
        &times;
      </button>
    </div>
  )
}
