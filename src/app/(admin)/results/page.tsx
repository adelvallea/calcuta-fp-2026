'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { flagCode } from '@/lib/lot-utils'
import toast from 'react-hot-toast'
import { RefreshCw, Pencil, Check, X, Wifi, WifiOff } from 'lucide-react'

interface Team {
  id: string; name: string; country_code: string; fifa_rank: number; pot: number
  confederation: string; current_status: string; final_position: number | null
  current_points: number; current_goal_diff: number; matches_played: number
  wins: number; draws: number; losses: number; goals_for: number; goals_against: number
  group_wc2026?: string
  lot_teams?: Array<{ lot: { number: number; ownerships: Array<{ participant: { name: string } }> } }>
}

interface Match {
  id: string; stage: string; group_name: string | null; status: string
  kickoff: string | null; home_score: number | null; away_score: number | null; source: string
  home_team: { name: string; country_code: string }
  away_team:  { name: string; country_code: string }
}

const STATUS_LABEL: Record<string, string> = {
  not_started:'—', group_stage:'Fase grupos', round_of_32:'Octavos',
  round_of_16:'16avos', quarterfinal:'Cuartos', semifinal:'Semis',
  third_place:'3.er lugar', runner_up:'Subcampeón', champion:'Campeón', eliminated:'Eliminado',
}
const STATUS_COLOR: Record<string, string> = {
  not_started:'text-gray-400', group_stage:'text-blue-600', eliminated:'text-red-500',
  round_of_32:'text-blue-700', round_of_16:'text-purple-600', quarterfinal:'text-orange-600',
  semifinal:'text-orange-700', third_place:'text-amber-600', runner_up:'text-yellow-600', champion:'text-green-600',
}

// Grupos del Mundial 2026 — fuente oficial FIFA/ESPN (jun-2026)
// Usado como fallback si group_wc2026 no está en la DB
const WC2026_GROUPS: Record<string, string[]> = {
  'A': ['MEX','ZAF','KOR','CZE'],
  'B': ['CAN','BIH','QAT','SUI'],
  'C': ['BRA','MAR','HTI','SCO'],
  'D': ['USA','PRY','AUS','TUR'],
  'E': ['GER','CUW','CIV','ECU'],
  'F': ['NED','JPN','SWE','TUN'],
  'G': ['BEL','EGY','IRN','NZL'],
  'H': ['ESP','CPV','SAU','URU'],
  'I': ['FRA','SEN','IRQ','NOR'],
  'J': ['ARG','ALG','AUT','JOR'],
  'K': ['POR','COD','UZB','COL'],
  'L': ['ENG','CRO','GHA','PAN'],
}

type TabType = 'groups' | 'standings' | 'bracket' | 'matches'

export default function ResultsPage() {
  const supabase = createClient()
  const [teams,    setTeams]    = useState<Team[]>([])
  const [matches,  setMatches]  = useState<Match[]>([])
  const [syncing,  setSyncing]  = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [editingId,setEditingId]= useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Team>>({})
  const [tab,      setTab]      = useState<TabType>('groups')
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('teams').select(`*, lot_teams(lot:lots(number, ownerships:lot_ownerships(participant:participants(name))))`).order('fifa_rank'),
      supabase.from('matches').select(`*, home_team:teams!home_team_id(name,country_code), away_team:teams!away_team_id(name,country_code)`).order('kickoff', { ascending: true }),
    ])
    if (t) setTeams(t as Team[])
    if (m) setMatches(m as Match[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function syncOpenFootball() {
    setSyncing(true)
    try {
      const res = await fetch('/api/results/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) toast.error(data.error ?? 'Error al sincronizar')
      else {
        toast.success(`✅ ${data.matches} partidos actualizados desde OpenFootball`)
        setLastSync(new Date().toLocaleString('es-MX'))
        await load()
      }
    } catch (e: any) { toast.error(e.message) }
    finally { setSyncing(false) }
  }

  async function saveManual(teamId: string) {
    const body: any = { team_id: teamId, ...editData }
    if (editData.goals_for !== undefined && editData.goals_against !== undefined) {
      body.current_goal_diff = (editData.goals_for ?? 0) - (editData.goals_against ?? 0)
      body.current_points    = (editData.wins ?? 0) * 3 + (editData.draws ?? 0)
    }
    const res = await fetch('/api/results/manual', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { toast.success('Resultado guardado'); setEditingId(null); setEditData({}); await load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  // Agrupar equipos por grupo
  // Prioridad: DB (group_wc2026) > matches > estático WC2026_GROUPS
  function getTeamsByGroup(): Record<string, Team[]> {
    const grouped: Record<string, Team[]> = {}

    // Extraer grupos de partidos (si ya hay sync)
    const groupFromMatches: Record<string, string> = {}
    matches.forEach(m => {
      if (m.group_name) {
        const g = m.group_name.replace(/^Group\s*/i,'').replace(/^Grupo\s*/i,'').trim()
        if (g && m.home_team) groupFromMatches[m.home_team.country_code] = g
        if (g && m.away_team) groupFromMatches[m.away_team.country_code] = g
      }
    })

    for (const team of teams) {
      const group = team.group_wc2026                   // 1. DB (fuente oficial)
                 || groupFromMatches[team.country_code]  // 2. partidos sincronizados
                 || findStaticGroup(team.country_code)   // 3. mapa estático
                 || '?'                                  // 4. sin asignar
      if (!grouped[group]) grouped[group] = []
      grouped[group].push(team)
    }

    // Ordenar dentro de cada grupo: Pts → DG → GF → Ranking FIFA
    Object.keys(grouped).forEach(g => {
      grouped[g].sort((a, b) =>
        b.current_points      - a.current_points      ||
        b.current_goal_diff   - a.current_goal_diff   ||
        b.goals_for           - a.goals_for           ||
        a.fifa_rank           - b.fifa_rank
      )
    })
    return grouped
  }

  function findStaticGroup(cc: string): string | undefined {
    for (const [g, codes] of Object.entries(WC2026_GROUPS)) {
      if (codes.includes(cc)) return g
    }
    return undefined
  }

  const groupedTeams = getTeamsByGroup()
  const groupLetters = Object.keys(groupedTeams).filter(g => g !== '?').sort()
  const ungrouped    = groupedTeams['?'] ?? []

  const matchesByStage = matches.reduce((acc, m) => {
    const key = m.stage ?? 'Sin fase'; if (!acc[key]) acc[key] = []; acc[key].push(m); return acc
  }, {} as Record<string, Match[]>)

  const fmtGD = (n: number) => n > 0 ? `+${n}` : String(n)

  const TABS: { key: TabType; label: string }[] = [
    { key: 'groups',    label: '📊 Grupos' },
    { key: 'standings', label: '🗂 Tabla general' },
    { key: 'bracket',   label: '🏆 Llaves' },
    { key: 'matches',   label: '⚽ Partidos' },
  ]

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue">Resultados del Mundial</h1>
          {lastSync && <p className="text-xs text-brand-slate mt-0.5">Última sync: {lastSync} · OpenFootball</p>}
        </div>
        <button onClick={syncOpenFootball} disabled={syncing} className="btn-primary">
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sync OpenFootball'}
        </button>
      </div>

      {matches.length === 0 && !loading && (
        <div className="card bg-blue-50 border-blue-100">
          <p className="text-sm font-semibold text-blue-800">Sin partidos cargados</p>
          <p className="text-xs text-blue-600 mt-1">Haz clic en <strong>Sync OpenFootball</strong> o edita equipos manualmente con el ícono ✏️.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-gray-200 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === key ? 'border-brand-gold text-brand-navy' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: GRUPOS ─────────────────────────────────────────────────────── */}
      {tab === 'groups' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {groupLetters.map(letter => (
            <GroupTable key={letter} letter={letter} teams={groupedTeams[letter] ?? []}
              fmtGD={fmtGD} STATUS_COLOR={STATUS_COLOR} STATUS_LABEL={STATUS_LABEL} />
          ))}
          {ungrouped.length > 0 && (
            <GroupTable letter="?" teams={ungrouped} fmtGD={fmtGD}
              STATUS_COLOR={STATUS_COLOR} STATUS_LABEL={STATUS_LABEL} />
          )}
        </div>
      )}

      {/* ── TAB: TABLA GENERAL ──────────────────────────────────────────────── */}
      {tab === 'standings' && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="table-header w-8">#</th>
                <th className="table-header">Selección</th>
                <th className="table-header text-center">Gr.</th>
                <th className="table-header text-center">PJ</th>
                <th className="table-header text-center">PG</th>
                <th className="table-header text-center">PE</th>
                <th className="table-header text-center">PP</th>
                <th className="table-header text-center">GF</th>
                <th className="table-header text-center">GC</th>
                <th className="table-header text-center">DG</th>
                <th className="table-header text-center font-bold">Pts</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Lote / Dueño</th>
                <th className="table-header w-8" />
              </tr>
            </thead>
            <tbody>
              {teams.map((team, idx) => {
                const lot    = team.lot_teams?.[0]?.lot
                const owners = lot?.ownerships?.map(o => o.participant?.name).filter(Boolean) ?? []
                const isEdit = editingId === team.id
                const grp    = findStaticGroup(team.country_code) ?? team.group_wc2026 ?? '?'

                return (
                  <tr key={team.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-cell text-center text-xs text-gray-400">{idx + 1}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <img src={`https://flagcdn.com/w40/${flagCode(team.country_code)}.png`} alt={team.name} className="h-4 w-6 rounded object-cover" />
                        <span className="font-semibold text-brand-navy">{team.name}</span>
                        <span className="text-[10px] text-gray-400">B{team.pot}</span>
                      </div>
                    </td>
                    <td className="table-cell text-center font-mono font-bold text-xs text-brand-gold">{grp}</td>
                    {isEdit ? (
                      <>
                        {['matches_played','wins','draws','losses','goals_for','goals_against'].map(field => (
                          <td key={field} className="table-cell">
                            <input type="number" className="w-10 border rounded px-1 text-center text-xs"
                              value={(editData as any)[field] ?? (team as any)[field]}
                              onChange={e => setEditData({ ...editData, [field]: +e.target.value })} />
                          </td>
                        ))}
                        <td className="table-cell text-center text-xs">{((editData.goals_for ?? team.goals_for) - (editData.goals_against ?? team.goals_against))}</td>
                        <td className="table-cell text-center font-bold">{(editData.wins ?? team.wins) * 3 + (editData.draws ?? team.draws)}</td>
                        <td className="table-cell">
                          <select className="text-xs border rounded px-1" value={editData.current_status ?? team.current_status}
                            onChange={e => setEditData({ ...editData, current_status: e.target.value })}>
                            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </td>
                        <td className="table-cell" />
                        <td className="table-cell">
                          <div className="flex gap-1">
                            <button onClick={() => saveManual(team.id)} className="rounded bg-green-100 p-1 hover:bg-green-200"><Check className="h-3 w-3 text-green-700" /></button>
                            <button onClick={() => { setEditingId(null); setEditData({}) }} className="rounded bg-red-100 p-1 hover:bg-red-200"><X className="h-3 w-3 text-red-600" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="table-cell text-center">{team.matches_played}</td>
                        <td className="table-cell text-center">{team.wins}</td>
                        <td className="table-cell text-center">{team.draws}</td>
                        <td className="table-cell text-center">{team.losses}</td>
                        <td className="table-cell text-center">{team.goals_for}</td>
                        <td className="table-cell text-center">{team.goals_against}</td>
                        <td className="table-cell text-center">{fmtGD(team.current_goal_diff)}</td>
                        <td className="table-cell text-center font-bold text-brand-navy">{team.current_points}</td>
                        <td className="table-cell">
                          <span className={`text-xs font-semibold ${STATUS_COLOR[team.current_status] ?? 'text-gray-400'}`}>
                            {team.final_position ? `#${team.final_position} · ` : ''}{STATUS_LABEL[team.current_status] ?? '—'}
                          </span>
                        </td>
                        <td className="table-cell text-xs">
                          {lot ? (
                            <div>
                              <span className="font-medium text-brand-navy-mid">Lote {lot.number}</span>
                              {owners.length > 0 && <p className="text-gray-400 text-[10px]">{owners.join(', ')}</p>}
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="table-cell">
                          <button onClick={() => { setEditingId(team.id); setEditData({}) }} className="rounded p-1 hover:bg-gray-100">
                            <Pencil className="h-3 w-3 text-gray-400" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: BRACKET (llaves eliminatorias) ─────────────────────────────── */}
      {tab === 'bracket' && <BracketView teams={teams} matches={matches} />}

      {/* ── TAB: PARTIDOS ───────────────────────────────────────────────────── */}
      {tab === 'matches' && (
        <div className="space-y-4">
          {Object.keys(matchesByStage).length === 0 ? (
            <div className="card text-center text-sm text-gray-400 py-8">Sin partidos. Usa "Sync OpenFootball".</div>
          ) : Object.entries(matchesByStage).map(([stage, stageMatches]) => (
            <div key={stage} className="card p-0">
              <div className="px-4 py-2 bg-brand-bg border-b border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-brand-slate">{stage}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {stageMatches.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className="text-sm font-semibold text-brand-navy text-right">{m.home_team?.name}</span>
                      <img src={`https://flagcdn.com/w40/${flagCode(m.home_team?.country_code ?? '')}.png`} className="h-4 w-6 rounded object-cover" alt="" />
                    </div>
                    <div className="text-center min-w-[80px]">
                      {m.status === 'finished'
                        ? <span className="text-lg font-black text-brand-navy">{m.home_score} — {m.away_score}</span>
                        : <span className="text-xs text-gray-400">{m.kickoff ? new Date(m.kickoff).toLocaleDateString('es-MX',{month:'short',day:'numeric'}) : 'Por jugar'}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <img src={`https://flagcdn.com/w40/${flagCode(m.away_team?.country_code ?? '')}.png`} className="h-4 w-6 rounded object-cover" alt="" />
                      <span className="text-sm font-semibold text-brand-navy">{m.away_team?.name}</span>
                    </div>
                    <span className="w-5 text-right">{m.source === 'api' ? <Wifi className="h-3 w-3 text-green-500 inline" /> : <WifiOff className="h-3 w-3 text-gray-300 inline" />}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Tabla de grupo ──────────────────────────────────────────────────────── */
function GroupTable({ letter, teams, fmtGD, STATUS_COLOR, STATUS_LABEL }: {
  letter: string; teams: Team[]; fmtGD: (n: number) => string
  STATUS_COLOR: Record<string, string>; STATUS_LABEL: Record<string, string>
}) {
  // Solo mostrar palomita si hay equipos que ya clasificaron (tienen partidos jugados)
  const anyPlayed = teams.some(t => t.matches_played > 0)

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between bg-brand-navy px-4 py-2.5">
        <span className="text-lg font-black text-brand-gold">Grupo {letter}</span>
        {anyPlayed && (
          <span className="text-[9px] text-green-400 font-medium">✓ clasificado</span>
        )}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-3 py-2 text-left font-semibold text-gray-400 uppercase tracking-wide">Equipo</th>
            <th className="px-2 py-2 text-center font-semibold text-gray-400">PJ</th>
            <th className="px-2 py-2 text-center font-semibold text-gray-400">DG</th>
            <th className="px-2 py-2 text-center font-semibold text-gray-400 text-brand-navy">Pts</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, i) => (
            <tr key={team.id} className={`border-b border-gray-50 last:border-0 ${anyPlayed && i < 2 ? 'bg-green-50/30' : ''}`}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  {anyPlayed && i < 2 && <span className="text-green-500 font-bold text-[9px]">✓</span>}
                  <img src={`https://flagcdn.com/w40/${flagCode(team.country_code)}.png`}
                    alt={team.name} className="h-3 w-4 rounded object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                  <span className="font-semibold text-brand-navy truncate max-w-[80px]">{team.name}</span>
                </div>
                {team.current_status !== 'not_started' && (
                  <span className={`text-[9px] ${STATUS_COLOR[team.current_status]}`}>
                    {STATUS_LABEL[team.current_status]}
                  </span>
                )}
              </td>
              <td className="px-2 py-2 text-center">{team.matches_played}</td>
              <td className="px-2 py-2 text-center">{fmtGD(team.current_goal_diff)}</td>
              <td className="px-2 py-2 text-center font-black text-brand-navy">{team.current_points}</td>
            </tr>
          ))}
          {teams.length === 0 && (
            <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-300 italic text-[10px]">Sin datos</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ── Bracket de eliminatoria ──────────────────────────────────────────────── */
function BracketView({ teams, matches }: { teams: Team[]; matches: Match[] }) {
  const stages = ['Ronda 32', 'Octavos', 'Cuartos', 'Semifinal', 'Final']

  const teamByStatus = {
    champion:    teams.find(t => t.current_status === 'champion'),
    runner_up:   teams.find(t => t.current_status === 'runner_up'),
    third:       teams.find(t => t.current_status === 'third_place'),
    semifinals:  teams.filter(t => t.current_status === 'semifinal'),
    quarters:    teams.filter(t => t.current_status === 'quarterfinal'),
    r16:         teams.filter(t => t.current_status === 'round_of_16'),
    r32:         teams.filter(t => t.current_status === 'round_of_32'),
  }

  const hasKnockout = [
    teamByStatus.champion, teamByStatus.runner_up, teamByStatus.third,
    ...teamByStatus.semifinals, ...teamByStatus.quarters, ...teamByStatus.r16,
  ].some(Boolean)

  if (!hasKnockout) {
    return (
      <div className="card text-center py-12">
        <p className="text-3xl mb-3">🏆</p>
        <p className="text-sm font-semibold text-gray-600">Las llaves estarán disponibles</p>
        <p className="text-xs text-gray-400 mt-1">cuando equipos avancen a la fase eliminatoria</p>
        <p className="text-xs text-gray-300 mt-3">Sincroniza con OpenFootball para actualizar</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Final y pódium */}
      <div className="grid gap-4 sm:grid-cols-3">
        <BracketCard icon="🏆" label="Campeón" team={teamByStatus.champion} color="bg-amber-50 border-brand-gold" />
        <BracketCard icon="🥈" label="Subcampeón" team={teamByStatus.runner_up} color="bg-gray-50 border-gray-300" />
        <BracketCard icon="🥉" label="3.er lugar" team={teamByStatus.third} color="bg-orange-50 border-orange-300" />
      </div>

      {/* Semifinalistas */}
      {teamByStatus.semifinals.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-slate mb-3">Semifinalistas</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {teamByStatus.semifinals.map(t => <TeamChip key={t.id} team={t} />)}
          </div>
        </div>
      )}

      {/* Cuartos */}
      {teamByStatus.quarters.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-slate mb-3">Cuartos de final</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {teamByStatus.quarters.map(t => <TeamChip key={t.id} team={t} small />)}
          </div>
        </div>
      )}

      {/* 16avos / octavos */}
      {teamByStatus.r16.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-slate mb-3">Octavos de final (16 avos)</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {teamByStatus.r16.map(t => <TeamChip key={t.id} team={t} small />)}
          </div>
        </div>
      )}

      {/* Ronda 32 */}
      {teamByStatus.r32.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-slate mb-3">Ronda de 32</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {teamByStatus.r32.map(t => <TeamChip key={t.id} team={t} small />)}
          </div>
        </div>
      )}
    </div>
  )
}

function BracketCard({ icon, label, team, color }: { icon: string; label: string; team?: Team; color: string }) {
  return (
    <div className={`rounded-xl border-2 p-4 text-center ${color}`}>
      <p className="text-3xl mb-2">{icon}</p>
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{label}</p>
      {team ? (
        <>
          <img src={`https://flagcdn.com/w80/${flagCode(team.country_code)}.png`}
            alt={team.name} className="h-8 w-12 rounded object-cover mx-auto mb-1"
            onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
          <p className="font-black text-brand-navy">{team.name}</p>
        </>
      ) : (
        <p className="text-sm text-gray-400 italic">Por determinar</p>
      )}
    </div>
  )
}

function TeamChip({ team, small = false }: { team: Team; small?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg bg-white border border-gray-100 shadow-sm ${small ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
      <img src={`https://flagcdn.com/w40/${flagCode(team.country_code)}.png`}
        alt={team.name} className="h-4 w-5 rounded object-cover shrink-0"
        onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
      <span className={`font-semibold text-brand-navy truncate ${small ? 'text-[10px]' : 'text-xs'}`}>
        {team.name}
      </span>
    </div>
  )
}
