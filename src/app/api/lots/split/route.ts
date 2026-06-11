import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/lots/split
 * Extrae un equipo de un lote combo y crea 1-5 nuevos lotes solos/combos.
 *
 * Body: {
 *   sourceLotId: string,      // lote origen
 *   teamIds: string[],        // equipos a extraer
 *   newLotCount: number,      // cuántos lotes nuevos crear (1-5)
 *   groupTeams: boolean,      // true = un solo lote combo | false = un lote por equipo
 * }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { sourceLotId, teamIds, newLotCount = 1, groupTeams = false } = await req.json()

  if (!sourceLotId || !teamIds?.length) {
    return NextResponse.json({ error: 'sourceLotId y teamIds son requeridos' }, { status: 400 })
  }

  // Obtener lote origen con sus equipos
  const { data: sourceLot, error: srcErr } = await supabase
    .from('lots')
    .select('*, teams:lot_teams(team:teams(*))')
    .eq('id', sourceLotId)
    .single()

  if (srcErr || !sourceLot) return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })

  const allTeams = sourceLot.teams?.map((lt: any) => lt.team).filter(Boolean) ?? []
  const teamsToExtract = allTeams.filter((t: any) => teamIds.includes(t.id))

  if (teamsToExtract.length === 0) {
    return NextResponse.json({ error: 'No se encontraron los equipos especificados' }, { status: 400 })
  }

  // Obtener el número de lote más alto existente
  const { data: maxLot } = await supabase
    .from('lots')
    .select('number')
    .order('number', { ascending: false })
    .limit(1)
    .single()

  let nextNumber = (maxLot?.number ?? 18) + 1
  const createdLots: string[] = []

  if (groupTeams && teamsToExtract.length > 1) {
    // Crear UN lote combo con todos los equipos extraídos
    const title = `Lote ${nextNumber} — ${teamsToExtract.map((t: any) => t.name).join(' + ')}`
    const { data: newLot, error } = await supabase
      .from('lots')
      .insert({ number: nextNumber, title, type: 'combo', status: 'pending', current_bid: 0 })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    for (const team of teamsToExtract) {
      await supabase.from('lot_teams').insert({ lot_id: newLot.id, team_id: team.id })
    }
    createdLots.push(newLot.id)
    nextNumber++
  } else {
    // Crear un lote por equipo extraído
    for (const team of teamsToExtract) {
      const title = `Lote ${nextNumber} — ${team.name}`
      const { data: newLot, error } = await supabase
        .from('lots')
        .insert({ number: nextNumber, title, type: 'solo', status: 'pending', current_bid: 0 })
        .select().single()
      if (error) continue

      await supabase.from('lot_teams').insert({ lot_id: newLot.id, team_id: team.id })
      createdLots.push(newLot.id)
      nextNumber++
    }
  }

  // Eliminar los equipos extraídos del lote origen
  for (const teamId of teamIds) {
    await supabase.from('lot_teams')
      .delete()
      .eq('lot_id', sourceLotId)
      .eq('team_id', teamId)
  }

  // Actualizar título del lote origen
  const remainingTeams = allTeams.filter((t: any) => !teamIds.includes(t.id))
  if (remainingTeams.length > 0) {
    const newTitle = `Lote ${sourceLot.number} — ${remainingTeams.map((t: any) => t.name).join(' + ')}`
    const newType = remainingTeams.length === 1 ? 'solo' : 'combo'
    await supabase.from('lots').update({ title: newTitle, type: newType }).eq('id', sourceLotId)
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    action: 'split_lot',
    entity_type: 'lot',
    entity_id: sourceLotId,
    new_value: { extracted_teams: teamIds, created_lots: createdLots },
    performed_by: 'admin',
  })

  return NextResponse.json({ ok: true, created: createdLots.length, lotIds: createdLots })
}
