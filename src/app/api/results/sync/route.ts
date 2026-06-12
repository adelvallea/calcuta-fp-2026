import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const URL = 'https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.json'

// Mapa de nombres en inglés (OpenFootball) → country_code de nuestra DB
const NAME_TO_CODE: Record<string, string> = {
  // Grupo A
  'Mexico': 'MEX', 'South Africa': 'ZAF', 'South Korea': 'KOR', 'Czech Republic': 'CZE',
  // Grupo B
  'Canada': 'CAN', 'Bosnia and Herzegovina': 'BIH', 'Bosnia & Herzegovina': 'BIH',
  'Qatar': 'QAT', 'Switzerland': 'SUI',
  // Grupo C
  'Brazil': 'BRA', 'Morocco': 'MAR', 'Haiti': 'HTI', 'Scotland': 'SCO',
  // Grupo D
  'United States': 'USA', 'USA': 'USA', 'Paraguay': 'PRY',
  'Australia': 'AUS', 'Turkey': 'TUR', 'Türkiye': 'TUR',
  // Grupo E
  'Germany': 'GER', 'Curaçao': 'CUW', 'Curacao': 'CUW',
  'Ivory Coast': 'CIV', "Côte d'Ivoire": 'CIV', 'Ecuador': 'ECU',
  // Grupo F
  'Netherlands': 'NED', 'Japan': 'JPN', 'Sweden': 'SWE', 'Tunisia': 'TUN',
  // Grupo G
  'Belgium': 'BEL', 'Egypt': 'EGY', 'Iran': 'IRN', 'New Zealand': 'NZL',
  // Grupo H
  'Spain': 'ESP', 'Cape Verde': 'CPV', 'Saudi Arabia': 'SAU', 'Uruguay': 'URU',
  // Grupo I
  'France': 'FRA', 'Senegal': 'SEN', 'Iraq': 'IRQ', 'Norway': 'NOR',
  // Grupo J
  'Argentina': 'ARG', 'Algeria': 'ALG', 'Austria': 'AUT', 'Jordan': 'JOR',
  // Grupo K
  'Portugal': 'POR', 'DR Congo': 'COD', 'Congo DR': 'COD', 'Uzbekistan': 'UZB',
  'Colombia': 'COL',
  // Grupo L
  'England': 'ENG', 'Croatia': 'CRO', 'Ghana': 'GHA', 'Panama': 'PAN',
}

interface OFMatch {
  round: string
  date: string
  time?: string
  team1: string
  team2: string
  score?: { ft?: number[]; ht?: number[] }
  group?: string
  ground?: string
}

interface OFData {
  name: string
  matches: OFMatch[]
}

export async function POST() {
  const supabase = await createClient()

  try {
    const res = await fetch(URL, { next: { revalidate: 0 } })
    if (!res.ok) return NextResponse.json(
      { error: `OpenFootball respondió ${res.status}` }, { status: 502 }
    )

    const data: OFData = await res.json()
    const matches: OFMatch[] = data.matches ?? []

    // Cargar todos los equipos de la DB
    const { data: dbTeams } = await supabase.from('teams').select('id, name, country_code')
    const teamByCode = new Map<string, string>()
    for (const t of dbTeams ?? []) teamByCode.set(t.country_code, t.id)

    function teamId(name: string): string | undefined {
      const code = NAME_TO_CODE[name]
      return code ? teamByCode.get(code) : undefined
    }

    // Estadísticas por equipo
    const stats = new Map<string, {
      played: number; wins: number; draws: number; losses: number
      gf: number; ga: number; status: string
    }>()

    let upserted = 0
    const now = new Date().toISOString()

    for (const m of matches) {
      const hId = teamId(m.team1)
      const aId = teamId(m.team2)
      if (!hId || !aId) continue

      const ft = m.score?.ft
      const hasScore = Array.isArray(ft) && ft.length === 2
      const hScore = hasScore ? ft![0] : null
      const aScore = hasScore ? ft![1] : null
      const status = hasScore ? 'finished' : 'scheduled'

      // Determinar stage
      const round = m.round ?? ''
      const isGroup = !!(m.group) || round.toLowerCase().includes('matchday') || round.toLowerCase().includes('group')
      const stage = m.group ?? round

      // Upsert partido
      const matchKey = `of-${m.date}-${m.team1.replace(/\s/g,'-')}-${m.team2.replace(/\s/g,'-')}`
      await supabase.from('matches').upsert({
        id: matchKey,
        home_team_id: hId, away_team_id: aId,
        home_score: hScore, away_score: aScore,
        status,
        kickoff: m.date ? `${m.date}T00:00:00Z` : null,
        stage, group_name: m.group ?? null,
        source: 'api', updated_at: now,
      }, { onConflict: 'id' })
      upserted++

      // Acumular estadísticas de grupos
      if (isGroup && hasScore) {
        const h = hScore!; const a = aScore!
        for (const [tid, gf, ga] of [[hId, h, a], [aId, a, h]] as [string, number, number][]) {
          const s = stats.get(tid) ?? { played:0, wins:0, draws:0, losses:0, gf:0, ga:0, status:'group_stage' }
          s.played++; s.gf += gf; s.ga += ga
          if (gf > ga) { s.wins++; } else if (gf === ga) { s.draws++ } else { s.losses++ }
          s.status = 'group_stage'
          stats.set(tid, s)
        }
      }
    }

    // Actualizar equipos con estadísticas
    for (const [tid, s] of stats) {
      const pts = s.wins * 3 + s.draws
      await supabase.from('teams').update({
        current_points: pts,
        matches_played: s.played,
        wins: s.wins, draws: s.draws, losses: s.losses,
        goals_for: s.gf, goals_against: s.ga,
        current_goal_diff: s.gf - s.ga,
        current_status: s.status,
      }).eq('id', tid)
    }

    return NextResponse.json({
      ok: true,
      matches: upserted,
      teams_updated: stats.size,
      source: 'OpenFootball',
      updated_at: now,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
