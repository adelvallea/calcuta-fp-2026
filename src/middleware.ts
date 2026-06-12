import { NextRequest, NextResponse } from 'next/server'

/**
 * Las páginas admin (/dashboard, /auction, etc.) son PÚBLICAS — todos pueden ver.
 * Solo las API de mutación requieren autenticación de moderador.
 */
const PROTECTED_API = [
  '/api/reset',
  '/api/payments/undo',
  '/api/lots/split',
  '/api/lots/reorder',
  '/api/results/manual',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Proteger solo APIs de mutación
  const isProtectedApi = PROTECTED_API.some(p => pathname.startsWith(p))
  if (!isProtectedApi) return NextResponse.next()

  const session = req.cookies.get('mod_session')?.value
  if (session === 'authenticated') return NextResponse.next()

  return NextResponse.json({ error: 'Se requiere autenticación de moderador' }, { status: 401 })
}

export const config = {
  matcher: ['/api/reset', '/api/payments/:path*', '/api/lots/:path*', '/api/results/manual'],
}
