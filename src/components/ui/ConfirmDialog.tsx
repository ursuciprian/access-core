'use client'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmColor?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmColor = '#EF4444',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(18,18,18,0.98)',
          border: '1px solid var(--border)',
          borderRadius: '18px',
          padding: '24px',
          minWidth: '360px',
          maxWidth: '480px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          {title}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '10px',
              border: '1px solid var(--border-strong)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '10px',
              border: 'none',
              background: confirmColor,
              color: confirmColor === 'var(--button-primary)' ? 'var(--button-primary-text)' : '#FFFFFF',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
