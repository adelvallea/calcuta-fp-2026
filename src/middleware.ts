import { NextRequest, NextResponse } from 'next/server'

// Rutas que requieren autenticación de moderador
const PROTECTED = [
  '/dashboard', '/auction', '/participants', '/lots',
  '/payments', '/results', '/prizes', '/settings',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (!isProtected) return NextResponse.next()

  const session = req.cookies.get('mod_session')?.value
  if (session === 'authenticated') return NextResponse.next()

  // Redirigir al login guardando la URL destino
  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('redirect', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    '/dashboard/:path*', '/auction/:path*', '/participants/:path*',
    '/lots/:path*', '/payments/:path*', '/results/:path*',
    '/prizes/:path*', '/settings/:path*',
  ],
}
