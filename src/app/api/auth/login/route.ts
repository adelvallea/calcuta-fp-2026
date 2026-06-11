import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { pin } = await req.json()
  const correctPin = process.env.ADMIN_PIN ?? '1234'

  if (pin !== correctPin) {
    return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('mod_session', 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 12, // 12 horas
    path: '/',
  })
  return res
}
