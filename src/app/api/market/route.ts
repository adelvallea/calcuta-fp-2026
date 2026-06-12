import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET  /api/market  — listar ofertas
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('market_offers')
    .select(`
      *,
      lot:lots(id, number, title, teams:lot_teams(team:teams(name, country_code, fifa_rank))),
      seller:participants!market_offers_seller_id_fkey(id, name),
      buyer:participants!market_offers_buyer_id_fkey(id, name)
    `)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/market  — crear oferta
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { lot_id, seller_id, buyer_id, percentage, price, notes } = body

  if (!lot_id || !seller_id || !buyer_id || !percentage || !price) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }
  if (seller_id === buyer_id) {
    return NextResponse.json({ error: 'Vendedor y comprador deben ser distintos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('market_offers')
    .insert({ lot_id, seller_id, buyer_id, percentage, price, notes, status: 'pending_seller' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log
  await supabase.from('audit_logs').insert({
    action: 'market_offer_created',
    entity_type: 'market_offer',
    entity_id: data.id,
    new_value: { lot_id, seller_id, buyer_id, percentage, price },
    performed_by: buyer_id,
  })

  return NextResponse.json({ ok: true, id: data.id })
}
