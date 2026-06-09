/**
 * Script de seed para cargar datos iniciales en Supabase.
 * Uso: npm run seed
 * Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const teams = JSON.parse(readFileSync(resolve(process.cwd(), 'seed/teams.json'), 'utf-8'))
const lotsData = JSON.parse(readFileSync(resolve(process.cwd(), 'seed/lots.json'), 'utf-8'))
const prizeRules = JSON.parse(readFileSync(resolve(process.cwd(), 'seed/prizeRules.json'), 'utf-8'))

async function seedTeams() {
  console.log('🌍 Insertando 48 equipos...')
  const { data, error } = await supabase.from('teams').upsert(
    teams.map((t: typeof teams[0]) => ({
      name: t.name,
      country_code: t.country_code,
      fifa_rank: t.fifa_rank,
      pot: t.pot,
      best_world_cup: t.best_world_cup,
      world_cup_2022: t.world_cup_2022,
      confederation: t.confederation,
      current_status: 'not_started',
      current_points: 0,
      current_goal_diff: 0,
      matches_played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
    })),
    { onConflict: 'country_code' }
  )
  if (error) throw new Error(`Teams: ${error.message}`)
  console.log(`  ✅ ${teams.length} equipos insertados`)
  return data
}

async function getTeamMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('teams').select('id, name')
  if (error) throw new Error(`getTeamMap: ${error.message}`)
  const map = new Map<string, string>()
  for (const t of data ?? []) map.set(t.name, t.id)
  return map
}

async function seedLots(teamMap: Map<string, string>) {
  console.log('🎯 Insertando lotes...')

  for (const lot of lotsData) {
    // Insertar lote
    const { data: lotRecord, error: lotError } = await supabase
      .from('lots')
      .upsert(
        {
          number: lot.number,
          title: lot.title,
          type: lot.type,
          status: 'pending',
          current_bid: 0,
          notes: `Prob. Campeón: ${lot.prob_champion}% | Lugar 32: ${lot.prob_pos32}% | Último: ${lot.prob_last}%`,
        },
        { onConflict: 'number' }
      )
      .select()
      .single()

    if (lotError) {
      console.error(`  ❌ Lote ${lot.number}: ${lotError.message}`)
      continue
    }

    // Insertar relaciones lot_teams
    for (const teamName of lot.teams) {
      const teamId = teamMap.get(teamName)
      if (!teamId) {
        console.warn(`  ⚠️  Equipo no encontrado: "${teamName}" en Lote ${lot.number}`)
        continue
      }
      const { error: ltError } = await supabase
        .from('lot_teams')
        .upsert({ lot_id: lotRecord.id, team_id: teamId }, { onConflict: 'lot_id,team_id' })
      if (ltError) console.error(`  ❌ lot_teams Lote ${lot.number} / ${teamName}: ${ltError.message}`)
    }

    console.log(`  ✅ Lote ${lot.number}: ${lot.title}`)
  }
}

async function seedPrizeRules() {
  console.log('🏆 Insertando reglas de premios...')
  const { error } = await supabase.from('prize_rules').upsert(
    prizeRules.map((r: typeof prizeRules[0]) => ({
      name: r.name,
      description: r.description,
      final_position: r.final_position,
      percentage: r.percentage,
      enabled: r.enabled,
      sort_order: r.sort_order,
    })),
    { onConflict: 'final_position' }
  )
  if (error) throw new Error(`PrizeRules: ${error.message}`)
  console.log(`  ✅ ${prizeRules.length} reglas insertadas`)
}

async function seedSettings() {
  console.log('⚙️  Insertando configuración inicial...')
  const { error } = await supabase.from('calcuta_settings').upsert(
    {
      event_name: 'Gran Calcuta · Mundial 2026',
      buy_in_amount: 1000,
      min_bid_increment: 200,
      currency: 'MXN',
      currency_symbol: '$',
      auction_started: false,
      auction_finished: false,
    },
    { onConflict: 'id' }
  )
  if (error && !error.message.includes('duplicate')) {
    console.warn(`  ⚠️  Settings: ${error.message}`)
  }
  console.log('  ✅ Configuración lista')
}

async function main() {
  console.log('\n🚀 Iniciando seed de Calcuta Mundial 2026\n')

  try {
    await seedSettings()
    await seedTeams()
    const teamMap = await getTeamMap()
    await seedLots(teamMap)
    await seedPrizeRules()
    console.log('\n🎉 Seed completado con éxito\n')
  } catch (e) {
    console.error('\n💥 Error en seed:', e)
    process.exit(1)
  }
}

main()
