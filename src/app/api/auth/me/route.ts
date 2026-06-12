import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = req.cookies.get('mod_session')?.value
  return NextResponse.json({ isAdmin: session === 'authenticated' })
}
