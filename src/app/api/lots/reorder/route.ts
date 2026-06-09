import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PUT /api/lots/reorder — body: [{id, number}]
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const items: Array<{ id: string; number: number }> = await req.json()

  if (!Array.isArray(items)) return NextResponse.json({ error: 'Array requerido' }, { status: 400 })

  // Update each lot number
  const updates = items.map(({ id, number }) =>
    supabase.from('lots').update({ number }).eq('id', id)
  )
  await Promise.all(updates)

  return NextResponse.json({ ok: true, updated: items.length })
}
