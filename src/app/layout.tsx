import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gran Calcuta · Mundial 2026',
  description: 'Sistema de administración de la Calcuta del Mundial FIFA 2026',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
