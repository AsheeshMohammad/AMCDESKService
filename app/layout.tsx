import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AMC Desk — Service operations',
  description: 'Customer, AMC and field-service management for service businesses.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
