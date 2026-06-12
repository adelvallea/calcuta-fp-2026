import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Props { params: Promise<{ id: string }> }

// PATCH /api/market/[id]  — aprobar/rechazar
export async function PATCH(req: NextRequest, { params }: Props) {
  const supabase = await createClient()
  const { id } = await params
  const { action, actor } = await req.json()
  // action: 'seller_approve' | 'buyer_approve' | 'mod_approve' | 'reject'
  // actor: participantId or 'admin'

  const { data: offer } = await supabase
    .from('market_offers')
    .select('*')
    .eq('id', id)
    .single()

  if (!offer) return NextResponse.json({ error: 'Oferta no encontrada' }, { status: 404 })

  let update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (action === 'reject') {
    update.status = 'rejected'
  } else if (action === 'seller_approve') {
    update.seller_approved = true
    update.status = 'pending_buyer'
  } else if (action === 'buyer_approve') {
    update.buyer_approved = true
    update.status = 'pending_mod'
  } else if (action === 'mod_approve') {
    update.mod_approved = true
    update.status = 'approved'
  }

  const { error } = await supabase.from('market_offers').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si fue aprobada por moderador → transferir ownership
  if (action === 'mod_approve') {
    // Reducir % del vendedor
    const { data: sellerOwn } = await supabase
      .from('lot_ownerships')
      .select('ownership_percentage')
      .eq('lot_id', offer.lot_id)
      .eq('participant_id', offer.seller_id)
      .single()

    if (sellerOwn) {
      const newPct = sellerOwn.ownership_percentage - offer.percentage
      if (newPct <= 0) {
        await supabase.from('lot_ownerships').delete()
          .eq('lot_id', offer.lot_id).eq('participant_id', offer.seller_id)
      } else {
        await supabase.from('lot_ownerships').update({ ownership_percentage: newPct })
          .eq('lot_id', offer.lot_id).eq('participant_id', offer.seller_id)
      }
    }

    // Agregar/aumentar % del comprador
    const { data: buyerOwn } = await supabase
      .from('lot_ownerships')
      .select('ownership_percentage')
      .eq('lot_id', offer.lot_id)
      .eq('participant_id', offer.buyer_id)
      .single()

    if (buyerOwn) {
      await supabase.from('lot_ownerships').update({
        ownership_percentage: buyerOwn.ownership_percentage + offer.percentage
      }).eq('lot_id', offer.lot_id).eq('participant_id', offer.buyer_id)
    } else {
      await supabase.from('lot_ownerships').insert({
        lot_id: offer.lot_id, participant_id: offer.buyer_id,
        ownership_percentage: offer.percentage
      })
    }
  }

  await supabase.from('audit_logs').insert({
    action: `market_${action}`,
    entity_type: 'market_offer',
    entity_id: id,
    new_value: update,
    performed_by: actor ?? 'unknown',
  })

  return NextResponse.json({ ok: true, status: update.status })
}
