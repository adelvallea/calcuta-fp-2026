import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/reset — reset auction (bids, lot statuses, ownerships, payments)
// body: { mode: 'auction' | 'full' }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { mode = 'auction' } = await req.json().catch(() => ({}))

  if (mode === 'auction') {
    // Solo resetea subasta: bids, lot status, ownerships
    await supabase.from('bids').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('lot_ownerships').delete().neq('lot_id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('lots').update({ status: 'pending', current_bid: 0, final_price: null })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('calcuta_settings').update({ auction_started: false, auction_finished: false, current_lot_id: null })
      .neq('id', '00000000-0000-0000-0000-000000000000')
  } else if (mode === 'full') {
    // Reset completo: todo lo anterior + participantes + pagos + resultados
    await supabase.from('bids').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('lot_ownerships').delete().neq('lot_id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('lots').update({ status: 'pending', current_bid: 0, final_price: null })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('participants').update({ amount_paid: 0 })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('teams').update({
      current_status: 'not_started', final_position: null,
      current_points: 0, current_goal_diff: 0, matches_played: 0,
      wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0,
    }).neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('calcuta_settings').update({ auction_started: false, auction_finished: false, current_lot_id: null })
      .neq('id', '00000000-0000-0000-0000-000000000000')
  }

  await supabase.from('audit_logs').insert({
    action: `reset_${mode}`,
    entity_type: 'system',
    entity_id: 'all',
    performed_by: 'admin',
  })

  return NextResponse.json({ ok: true, mode })
}
