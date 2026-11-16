import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RO Renewal PRO — Service operations, simplified',
  description: 'CRM, AMC and field-service management for RO dealers.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
