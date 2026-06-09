import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// OpenFootball World Cup 2026 JSON API
const OPENFOOTBALL_URL =
  'https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.json'

interface OFTeam { name: string; code: string }
interface OFScore { ft: number[] }
interface OFMatch {
  num: number
  date: string
  time?: string
  team1: OFTeam
  team2: OFTeam
  score?: OFScore
  group?: string
}
interface OFRound { name: string; matches: OFMatch[] }
interface OFData { name: string; rounds: OFRound[] }

export async function POST() {
  const supabase = await createClient()

  try {
    const res = await fetch(OPENFOOTBALL_URL, {
      next: { revalidate: 0 },
      headers: { 'Accept': 'application/json' },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `OpenFootball respondió ${res.status}. Los datos del Mundial 2026 podrían no estar disponibles aún.` },
        { status: 502 }
      )
    }

    const data: OFData = await res.json()

    // Cargar mapa de equipos de la DB
    const { data: dbTeams } = await supabase
      .from('teams')
      .select('id, name, country_code')

    const teamByCode = new Map<string, string>()
    const teamByName = new Map<string, string>()
    for (const t of dbTeams ?? []) {
      teamByCode.set(t.country_code.toUpperCase(), t.id)
      teamByName.set(t.name.toLowerCase(), t.id)
    }

    // Mapeo de códigos OpenFootball → nuestros códigos
    const codeMap: Record<string, string> = {
      'ESP': 'ESP', 'FRA': 'FRA', 'ENG': 'ENG', 'BRA': 'BRA', 'POR': 'POR',
      'ARG': 'ARG', 'GER': 'GER', 'NED': 'NED', 'BEL': 'BEL', 'CRO': 'CRO',
      'MAR': 'MAR', 'COL': 'COL', 'USA': 'USA', 'MEX': 'MEX', 'URU': 'URU',
      'SUI': 'SUI', 'JPN': 'JPN', 'SEN': 'SEN', 'IRN': 'IRN', 'KOR': 'KOR',
      'ECU': 'ECU', 'AUT': 'AUT', 'TUR': 'TUR', 'AUS': 'AUS', 'CAN': 'CAN',
      'NOR': 'NOR', 'PAN': 'PAN', 'ALG': 'ALG', 'EGY': 'EGY', 'SCO': 'SCO',
      'PAR': 'PRY', 'PRY': 'PRY', 'TUN': 'TUN', 'CIV': 'CIV', 'SWE': 'SWE',
      'CZE': 'CZE', 'UZB': 'UZB', 'QAT': 'QAT', 'CGO': 'COD', 'IRQ': 'IRQ',
      'KSA': 'SAU', 'RSA': 'ZAF', 'JOR': 'JOR', 'CPV': 'CPV', 'GHA': 'GHA',
      'BIH': 'BIH', 'CUW': 'CUW', 'HAI': 'HTI', 'NZL': 'NZL',
    }

    function findTeamId(team: OFTeam): string | undefined {
      const mapped = codeMap[team.code.toUpperCase()]
      if (mapped) return teamByCode.get(mapped)
      return teamByName.get(team.name.toLowerCase())
    }

    let matchesUpserted = 0
    const standingsMap = new Map<string, {
      teamId: string; pts: number; played: number
      wins: number; draws: number; losses: number
      gf: number; ga: number
    }>()

    for (const round of data.rounds ?? []) {
      const isGroup = round.name.startsWith('Group') || round.name.startsWith('Grupo')
      const stage = round.name

      for (const match of round.matches ?? []) {
        const homeId = findTeamId(match.team1)
        const awayId = findTeamId(match.team2)
        if (!homeId || !awayId) continue

        const hasScore = match.score?.ft && match.score.ft.length === 2
        const homeScore = hasScore ? match.score!.ft[0] : null
        const awayScore = hasScore ? match.score!.ft[1] : null
        const status = hasScore ? 'finished' : 'scheduled'

        // Upsert partido
        await supabase.from('matches').upsert({
          id: `of-${match.num}`,
          home_team_id: homeId,
          away_team_id: awayId,
          home_score: homeScore,
          away_score: awayScore,
          status,
          kickoff: match.date ? `${match.date}T${match.time ?? '00:00'}:00` : null,
          stage,
          group_name: isGroup ? stage : null,
          source: 'api',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
        matchesUpserted++

        // Acumular estadísticas de grupos
        if (isGroup && hasScore) {
          const h = homeScore!; const a = awayScore!
          for (const [tid, gf, ga] of [[homeId, h, a], [awayId, a, h]] as [string, number, number][]) {
            const s = standingsMap.get(tid) ?? { teamId: tid, pts: 0, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 }
            s.played++; s.gf += gf; s.ga += ga
            if (gf > ga) { s.wins++; s.pts += 3 }
            else if (gf === ga) { s.draws++; s.pts += 1 }
            else s.losses++
            standingsMap.set(tid, s)
          }
        }
      }
    }

    // Actualizar equipos con estadísticas
    for (const [teamId, s] of standingsMap) {
      await supabase.from('teams').update({
        current_points: s.pts,
        matches_played: s.played,
        wins: s.wins,
        draws: s.draws,
        losses: s.losses,
        goals_for: s.gf,
        goals_against: s.ga,
        current_goal_diff: s.gf - s.ga,
        current_status: 'group_stage',
      }).eq('id', teamId)
    }

    // Guardar timestamp en settings
    await supabase.from('calcuta_settings')
      .update({ updated_at: new Date().toISOString() })
      .neq('id', '00000000-0000-0000-0000-000000000000')

    return NextResponse.json({
      ok: true,
      matches: matchesUpserted,
      teams_updated: standingsMap.size,
      source: 'OpenFootball',
      updated_at: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
