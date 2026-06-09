import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/payments/undo?payment_id=xxx — eliminar un pago y ajustar saldo
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const paymentId = req.nextUrl.searchParams.get('payment_id')
  if (!paymentId) return NextResponse.json({ error: 'payment_id requerido' }, { status: 400 })

  // Obtener pago
  const { data: payment, error: fetchErr } = await supabase
    .from('payments')
    .select('*, participant:participants(id, amount_paid)')
    .eq('id', paymentId)
    .single()

  if (fetchErr || !payment) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

  const participantId = payment.participant_id
  const amount = payment.amount
  const currentPaid = payment.participant?.amount_paid ?? 0

  // Eliminar pago
  const { error: delErr } = await supabase.from('payments').delete().eq('id', paymentId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  // Actualizar amount_paid del participante
  const newPaid = Math.max(0, currentPaid - amount)
  await supabase.from('participants').update({ amount_paid: newPaid }).eq('id', participantId)

  return NextResponse.json({ ok: true, amount_reversed: amount })
}
