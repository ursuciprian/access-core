import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AccessCore',
  description: 'Self-service VPN access and operations portal',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
