import type { Match, Team, TournamentStanding } from '@/types'
import { createClient } from './supabase/server'

// ─── Interfaz abstracta del proveedor ────────────────────────────────────────
// Implementa esta interfaz para conectar una API externa (Football-Data.org,
// API-Football, etc.) cuando el Mundial esté en curso.

export interface ResultsProvider {
  getMatches(): Promise<Match[]>
  getStandings(): Promise<TournamentStanding[]>
  getFinalClassification(): Promise<Array<{ teamId: string; position: number }>>
  syncResults(): Promise<{ updated: number; errors: string[] }>
}

// ─── Proveedor manual (DB) ────────────────────────────────────────────────────

export class ManualResultsProvider implements ResultsProvider {
  async getMatches(): Promise<Match[]> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
      .order('kickoff', { ascending: true })
    return (data as Match[]) ?? []
  }

  async getStandings(): Promise<TournamentStanding[]> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('tournament_standings')
      .select('*, team:teams(*)')
      .order('position', { ascending: true })
    return (data as TournamentStanding[]) ?? []
  }

  async getFinalClassification(): Promise<Array<{ teamId: string; position: number }>> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('tournament_standings')
      .select('team_id, position')
      .not('position', 'is', null)
      .order('position', { ascending: true })
    return (data ?? []).map((r) => ({ teamId: r.team_id, position: r.position }))
  }

  async syncResults(): Promise<{ updated: number; errors: string[] }> {
    // Manual provider no hace sync externo
    return { updated: 0, errors: ['Modo manual: actualiza resultados desde el panel de Resultados'] }
  }
}

// ─── Proveedor de API externa (stub listo para implementar) ──────────────────
// Rellena API_BASE_URL y getApiKey con tu proveedor real.
// Opciones recomendadas: football-data.org (gratis, buena cobertura FIFA)

export class ExternalApiResultsProvider implements ResultsProvider {
  private apiBaseUrl: string
  private apiKey: string

  constructor(apiBaseUrl: string, apiKey: string) {
    this.apiBaseUrl = apiBaseUrl
    this.apiKey = apiKey
  }

  async getMatches(): Promise<Match[]> {
    // TODO: implementar llamada real
    // const res = await fetch(`${this.apiBaseUrl}/matches?competition=WC`, {
    //   headers: { 'X-Auth-Token': this.apiKey }
    // })
    // const data = await res.json()
    // return mapExternalMatches(data.matches)
    throw new Error('ExternalApiResultsProvider.getMatches() no implementado aún')
  }

  async getStandings(): Promise<TournamentStanding[]> {
    throw new Error('ExternalApiResultsProvider.getStandings() no implementado aún')
  }

  async getFinalClassification(): Promise<Array<{ teamId: string; position: number }>> {
    throw new Error('ExternalApiResultsProvider.getFinalClassification() no implementado aún')
  }

  async syncResults(): Promise<{ updated: number; errors: string[] }> {
    const supabase = await createClient()
    const errors: string[] = []
    let updated = 0

    try {
      const matches = await this.getMatches()

      for (const match of matches) {
        const { error } = await supabase
          .from('matches')
          .upsert({
            id: match.id,
            home_team_id: match.home_team_id,
            away_team_id: match.away_team_id,
            home_score: match.home_score,
            away_score: match.away_score,
            status: match.status,
            kickoff: match.kickoff,
            stage: match.stage,
            group_name: match.group,
            source: 'api',
            updated_at: new Date().toISOString(),
          })
        if (error) errors.push(`Match ${match.id}: ${error.message}`)
        else updated++
      }
    } catch (e) {
      errors.push(String(e))
    }

    return { updated, errors }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function getResultsProvider(): ResultsProvider {
  const apiKey = process.env.RESULTS_API_KEY
  const apiUrl = process.env.RESULTS_API_URL

  if (apiKey && apiUrl) {
    return new ExternalApiResultsProvider(apiUrl, apiKey)
  }

  return new ManualResultsProvider()
}

// ─── Helpers para actualizar estado de equipos desde resultados ──────────────

export async function updateTeamStatusFromResults(
  teams: Team[],
  standings: TournamentStanding[]
): Promise<Partial<Team>[]> {
  const supabase = await createClient()
  const updates: Partial<Team>[] = []

  for (const standing of standings) {
    if (standing.position === undefined) continue

    let status: Team['current_status'] = 'eliminated'
    if (standing.position === 1) status = 'champion'
    else if (standing.position === 2) status = 'runner_up'
    else if (standing.position === 3) status = 'third_place'
    else if (standing.position <= 4) status = 'semifinal'
    else if (standing.position <= 8) status = 'quarterfinal'
    else if (standing.position <= 16) status = 'round_of_16'
    else if (standing.position <= 32) status = 'round_of_32'

    const update: Partial<Team> = {
      id: standing.team_id,
      current_status: status,
      final_position: standing.position,
    }
    updates.push(update)

    await supabase
      .from('teams')
      .update({ current_status: status, final_position: standing.position })
      .eq('id', standing.team_id)
  }

  return updates
}
