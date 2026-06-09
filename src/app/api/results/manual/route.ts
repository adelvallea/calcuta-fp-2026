import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PUT /api/results/manual — actualizar posición o estadísticas de un equipo manualmente
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { team_id, ...update } = body

  if (!team_id) return NextResponse.json({ error: 'team_id requerido' }, { status: 400 })

  // Calcular current_goal_diff si se dan goals_for y goals_against
  if (update.goals_for !== undefined && update.goals_against !== undefined) {
    update.current_goal_diff = update.goals_for - update.goals_against
  }

  const { error } = await supabase.from('teams').update(update).eq('id', team_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log
  await supabase.from('audit_logs').insert({
    action: 'manual_result_update',
    entity_type: 'team',
    entity_id: team_id,
    new_value: update,
    performed_by: 'admin',
  })

  return NextResponse.json({ ok: true })
}
