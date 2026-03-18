'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface MfaQrCodeProps {
  value: string
  size?: number
}

export default function MfaQrCode({ value, size = 180 }: MfaQrCodeProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size,
      color: {
        dark: '#111111',
        light: '#F8F8F8',
      },
    })
      .then((dataUrl) => {
        if (!active) return
        setSrc(dataUrl)
        setError(false)
      })
      .catch(() => {
        if (!active) return
        setSrc(null)
        setError(true)
      })

    return () => {
      active = false
    }
  }, [size, value])

  if (error) {
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '12px',
          border: '1px solid #2A2A2A',
          background: '#1A1A1A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '12px',
          fontSize: '12px',
          color: '#888888',
          lineHeight: 1.5,
        }}
      >
        Unable to generate QR code
      </div>
    )
  }

  if (!src) {
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '12px',
          border: '1px solid #2A2A2A',
          background: '#1A1A1A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: '#888888',
        }}
      >
        Generating QR...
      </div>
    )
  }

  return (
    <img
      src={src}
      alt="TOTP QR code"
      width={size}
      height={size}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '12px',
        border: '1px solid #2A2A2A',
        background: '#F8F8F8',
        display: 'block',
      }}
    />
  )
}
