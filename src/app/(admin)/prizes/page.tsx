import { createClient } from '@/lib/supabase/server'
import { buildPoolSummary } from '@/lib/calculations'
import type { Participant, Lot, PrizeRule, Team, SponsorContribution } from '@/types'

export const dynamic = 'force-dynamic'

export default async function PrizesPage() {
  const supabase = await createClient()
  const [
    { data: participants }, { data: lotsRaw }, { data: rules },
    { data: teams }, { data: sponsors }, { data: settings },
  ] = await Promise.all([
    supabase.from('participants').select('*'),
    supabase.from('lots').select('*, teams:lot_teams(team:teams(*)), ownerships:lot_ownerships(participant_id, lot_id, ownership_percentage, participant:participants(*))'),
    supabase.from('prize_rules').select('*').order('sort_order'),
    supabase.from('teams').select('*'),
    supabase.from('sponsor_contributions').select('*'),
    supabase.from('calcuta_settings').select('*').single(),
  ])

  const lots = (lotsRaw ?? []).map((l: any) => ({ ...l, teams: l.teams?.map((lt: any) => lt.team).filter(Boolean) ?? [] })) as Lot[]
  const pool = buildPoolSummary(participants as Participant[] ?? [], lots, rules as PrizeRule[] ?? [], teams as Team[] ?? [], sponsors as SponsorContribution[] ?? [])
  const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: settings?.currency ?? 'MXN', minimumFractionDigits: 0 }).format(n)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-blue">Premios</h1>
        <p className="text-sm text-brand-slate">Bolsa total: <strong>{fmt(pool.total_pool)}</strong></p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {pool.prizes.map((prize) => {
          const KNOCKOUT = ['champion','runner_up','third_place','semifinal','quarterfinal','round_of_16','round_of_32']
          const raw = prize.current_candidate
          const candidate = raw && (raw.team.final_position || KNOCKOUT.includes(raw.team.current_status)) ? raw : null
          return (
            <div key={prize.rule.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-slate">{prize.rule.name}</p>
                  <p className="text-2xl font-black text-brand-navy mt-0.5">{fmt(prize.prize_amount)}</p>
                  <p className="text-xs text-gray-400">{prize.rule.percentage}% de la bolsa</p>
                </div>
                <div className="text-3xl">
                  {prize.rule.final_position === 1 ? '🏆' :
                   prize.rule.final_position === 2 ? '🥈' :
                   prize.rule.final_position === 3 ? '🥉' :
                   prize.rule.final_position === 32 ? '⚖️' : '🔴'}
                </div>
              </div>

              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">{prize.rule.description}</p>

              {candidate ? (
                <div className="rounded-xl bg-brand-bg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-brand-navy">{candidate.team.name}</p>
                    <span className="text-xs text-gray-400">#{candidate.team.fifa_rank}</span>
                  </div>
                  <p className="text-xs text-brand-slate mb-2">Lote {candidate.lot.number}: {candidate.lot.title}</p>
                  {candidate.ownerships.length > 0 ? (
                    <div className="space-y-1">
                      {candidate.ownerships.map((o) => (
                        <div key={o.participant_id} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-brand-navy-mid">{(o.participant as any)?.name ?? '—'}</span>
                          <span className="text-brand-gold font-bold">
                            {fmt(prize.prize_amount * o.ownership_percentage / 100)}
                            {o.ownership_percentage < 100 && ` (${o.ownership_percentage}%)`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Lote sin dueño asignado</p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-gray-50 p-3 text-center">
                  <p className="text-sm text-gray-400 italic">Sin candidato aún</p>
                  <p className="text-xs text-gray-300">Se actualizará con los resultados del Mundial</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
