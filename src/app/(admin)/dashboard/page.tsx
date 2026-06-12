'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildPoolSummary } from '@/lib/calculations'
import type { Participant, Lot, PrizeRule, Team, SponsorContribution } from '@/types'
import Link from 'next/link'
import { Gavel, Users, Trophy, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
import { useIsAdmin } from '@/hooks/useIsAdmin'

export default function DashboardPage() {
  const supabase = createClient()
  const isAdmin = useIsAdmin()
  const [pool, setPool] = useState<any>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [activeLotId, setActiveLotId] = useState<string | null>(null)

  const fmt = useCallback((n: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: settings?.currency ?? 'MXN',
      minimumFractionDigits: 0,
    }).format(n)
  }, [settings?.currency])

  async function loadAll() {
    const [
      { data: ps }, { data: lotsRaw }, { data: rls },
      { data: ts }, { data: sponsors }, { data: cfg },
    ] = await Promise.all([
      supabase.from('participants').select('*'),
      supabase.from('lots').select('*, teams:lot_teams(team:teams(*)), ownerships:lot_ownerships(participant_id, lot_id, ownership_percentage, participant:participants(*)), bids(*)'),
      supabase.from('prize_rules').select('*').order('sort_order'),
      supabase.from('teams').select('*'),
      supabase.from('sponsor_contributions').select('*'),
      supabase.from('calcuta_settings').select('*').single(),
    ])

    setSettings(cfg)
    setParticipants(ps as Participant[] ?? [])

    const normalized = (lotsRaw ?? []).map((l: any) => ({
      ...l,
      teams: l.teams?.map((lt: any) => lt.team).filter(Boolean) ?? [],
    })) as Lot[]
    setLots(normalized)

    const active = normalized.find(l => l.status === 'active')
    setActiveLotId(active?.id ?? null)

    const p = buildPoolSummary(
      ps as Participant[] ?? [],
      normalized,
      rls as PrizeRule[] ?? [],
      ts as Team[] ?? [],
      sponsors as SponsorContribution[] ?? []
    )
    setPool(p)
  }

  useEffect(() => { loadAll() }, [])

  // Realtime: auto-actualizar cuando cambian lots, bids o participants
  useEffect(() => {
    const ch = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lot_ownerships' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, loadAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase])

  if (!pool) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-sm text-gray-400">Cargando dashboard...</p>
      </div>
    )
  }

  const activeLot = lots.find(l => l.id === activeLotId)
  const soldAmount = lots.filter(l => l.status === 'sold').reduce((s, l) => s + (l.final_price ?? 0), 0)

  return (
    <div className="space-y-0">
      {/* Banner con foto grupal hero */}
      <div className="relative h-40 overflow-hidden bg-brand-navy"
        style={{ backgroundImage: 'url(/hero.jpg)', backgroundSize: 'cover', backgroundPosition: 'center 30%' }}>
        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/60 to-brand-navy/20" />
        <div className="absolute inset-0 flex items-end justify-between px-6 pb-5 z-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Calcuta FP</p>
            <h1 className="text-2xl font-black text-white">Dashboard · Mundial 2026</h1>
          </div>
          <div>
            {activeLot ? (
              <Link href={`/auction/live/${activeLot.id}`} className="btn-gold">
                <Gavel className="h-4 w-4" /> En vivo
              </Link>
            ) : (
              <Link href="/auction" className="btn-primary">
                <Gavel className="h-4 w-4" /> Subasta
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

      {/* ── MENSAJE DE AGRADECIMIENTO ─────────────────────────────── */}
      <div className="rounded-2xl bg-brand-navy text-white px-5 py-4">
        <p className="text-brand-gold font-bold text-sm mb-1">🏆 Primera Edición · Gran Calcuta FP — Mundial 2026</p>
        <p className="text-white/80 text-xs leading-relaxed">
          Gracias a todos por participar en esta primera edición. Un agradecimiento especial a{' '}
          <strong className="text-brand-gold">MiGolazo Murguía</strong> y a{' '}
          <strong className="text-brand-gold">Ramírez</strong> por patrocinar media calcuta.{' '}
          ¡Sin ustedes esto no habría sido posible! 🙌⚽
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Bolsa acumulada"
          value={fmt(pool.total_pool)}
          sub={`${fmt(soldAmount)} de subasta`}
          icon={<DollarSign className="h-5 w-5 text-brand-gold" />}
          color="gold"
        />
        <StatCard
          label="Recaudado"
          value={fmt(pool.total_collected)}
          sub={`${fmt(pool.total_pending)} pendiente`}
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          color="green"
        />
        <StatCard
          label="Participantes"
          value={String(pool.total_participants)}
          icon={<Users className="h-5 w-5 text-brand-slate" />}
        />
        <StatCard
          label="Lotes vendidos"
          value={`${pool.lots_sold} / ${lots.length}`}
          sub={`${pool.lots_pending} pendientes`}
          icon={<Gavel className="h-5 w-5 text-brand-slate" />}
        />
      </div>

      {/* ── RESUMEN DE LA SUBASTA (humor) — antes de premios ── */}
      <AuctionHumor participants={participants} lots={lots} fmt={fmt} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Premios */}
        <div className="card">
          <h2 className="flex items-center gap-2 text-base font-bold text-brand-blue mb-4">
            <Trophy className="h-4 w-4 text-brand-gold" />
            Premios — Candidatos actuales
          </h2>
          <div className="space-y-3">
            {pool.prizes.map((p: any) => (
              <div key={p.rule.id} className="flex items-center justify-between rounded-lg bg-brand-bg p-3">
                <div>
                  <p className="text-sm font-semibold text-brand-blue">{p.rule.name}</p>
                  <p className="text-xs text-brand-slate">{fmt(p.prize_amount)}</p>
                </div>
                <div className="text-right">
                  {p.current_candidate ? (
                    <div>
                      <p className="text-sm font-bold text-brand-navy-mid">{p.current_candidate.team.name}</p>
                      <p className="text-xs text-brand-slate">
                        Lote {p.current_candidate.lot.number}
                        {p.current_candidate.ownerships.length > 0 &&
                          ` · ${p.current_candidate.ownerships.map((o: any) => o.participant?.name ?? '—').join(', ')}`}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-brand-slate italic">Sin candidato aún</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Estado subasta */}
        <div className="card">
          <h2 className="flex items-center gap-2 text-base font-bold text-brand-blue mb-4">
            <Gavel className="h-4 w-4 text-brand-gold" />
            Estado de la Subasta
          </h2>
          {activeLot && (
            <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                </span>
                <p className="text-sm font-bold text-blue-800">En subasta: {activeLot.title}</p>
              </div>
              <p className="mt-1 text-sm text-blue-700 ml-4">
                Bid actual: <strong>{fmt(activeLot.current_bid)}</strong>
              </p>
            </div>
          )}
          <div className="space-y-2">
            {[
              { label: 'Vendidos', count: lots.filter(l => l.status === 'sold').length, color: 'text-green-600' },
              { label: 'En subasta', count: lots.filter(l => l.status === 'active').length, color: 'text-blue-600' },
              { label: 'Pendientes', count: lots.filter(l => l.status === 'pending').length, color: 'text-gray-500' },
              { label: 'Pausados', count: lots.filter(l => l.status === 'paused').length, color: 'text-yellow-600' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-600">{label}</span>
                <span className={`text-sm font-bold ${color}`}>{count}</span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progreso</span>
              <span>{pool.lots_sold}/{lots.length}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-brand-gold transition-all"
                style={{ width: `${lots.length ? (pool.lots_sold / lots.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Saldos pendientes */}
      {pool.total_pending > 0 && (
        <div className="card">
          <h2 className="flex items-center gap-2 text-base font-bold text-brand-blue mb-4">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            Saldos pendientes de pago
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Participante</th>
                  <th className="table-header text-right">Total a pagar</th>
                  <th className="table-header text-right">Pagado</th>
                  <th className="table-header text-right">Saldo</th>
                  <th className="table-header text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => {
                  const totalBids = lots.filter(l => l.status === 'sold' && l.ownerships?.some((o: any) => o.participant_id === p.id))
                    .reduce((s, l) => s + (l.final_price ?? 0), 0)
                  const totalDue = Math.max(p.buy_in_amount, totalBids)
                  const saldo = totalDue - p.amount_paid
                  if (saldo <= 0) return null
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="table-cell font-medium">{p.name}</td>
                      <td className="table-cell text-right">{fmt(totalDue)}</td>
                      <td className="table-cell text-right text-green-600">{fmt(p.amount_paid)}</td>
                      <td className="table-cell text-right font-bold text-red-600">{fmt(saldo)}</td>
                      <td className="table-cell text-center">
                        <span className={p.amount_paid === 0 ? 'badge-pending' : 'badge-paused'}>
                          {p.amount_paid === 0 ? 'Pendiente' : 'Parcial'}
                        </span>
                      </td>
                    </tr>
                  )
                }).filter(Boolean)}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ── Humor movido arriba — ya no va aquí ─────────────────────── */}
      {/* ── RECORDATORIO DE PAGO ─────────────────────────────────────── */}
      {pool.total_pending > 0 && (
        <div className="rounded-xl bg-brand-navy text-white px-5 py-4 flex items-center gap-4">
          <span className="text-3xl shrink-0">💰</span>
          <div>
            <p className="font-bold">Recordatorio para todos los participantes</p>
            <p className="text-sm text-white/70 mt-0.5">
              Te recordamos liquidar tu saldo con el moderador. Quedan{' '}
              <strong className="text-brand-gold">{fmt(pool.total_pending)}</strong> pendientes.
              ¡No dejes que te persigan después del Mundial! ⚽
            </p>
          </div>
        </div>
      )}

      {/* AuctionHumor movido arriba de premios */}

      </div> {/* cierre px-6 */}
    </div>
  )
}

/* ── Tarjetas de humor ────────────────────────────────────────────────────── */
function AuctionHumor({ participants, lots, fmt }: {
  participants: Participant[]; lots: Lot[]; fmt: (n: number) => string
}) {
  if (lots.filter(l => l.status === 'sold').length === 0) return null

  function totalBids(pId: string) {
    return lots.filter(l => l.status === 'sold' && l.ownerships?.some((o: any) => o.participant_id === pId))
      .reduce((s, l) => s + (l.final_price ?? 0), 0)
  }
  function ownerOf(cc: string) {
    const lot = lots.find(l => l.status === 'sold' && (l as any).teams?.some((t: any) => t.country_code === cc))
    return { lot, owner: participants.find(p => lot?.ownerships?.some((o: any) => o.participant_id === p.id)) }
  }

  const ricachon = [...participants].sort((a, b) => totalBids(b.id) - totalBids(a.id))[0]
  const codolot  = [...lots.filter(l => l.status === 'sold' && (l.final_price ?? 0) > 0)].sort((a,b)=>(a.final_price??999999)-(b.final_price??999999))[0]
  const codo     = participants.find(p => codolot?.ownerships?.some((o: any) => o.participant_id === p.id))
  const dormidos = participants.filter(p => totalBids(p.id) === 0)
  const farlot   = lots.filter(l => l.status==='sold' && l.type==='combo' && (l.final_price??0)>3000).sort((a,b)=>(b.final_price??0)-(a.final_price??0))[0]
  const farol    = participants.find(p => farlot?.ownerships?.some((o: any) => o.participant_id === p.id))
  const gangaLot = [...lots.filter(l => l.status==='sold' && l.type==='solo')].sort((a,b)=>(a.final_price??999999)-(b.final_price??999999))[0]
  const ganga    = participants.find(p => gangaLot?.ownerships?.some((o: any) => o.participant_id === p.id))

  const { lot: argLot, owner: argOwner }  = ownerOf('ARG')
  const { lot: mexLot, owner: mexOwner }  = ownerOf('MEX')
  const { lot: espLot, owner: espOwner }  = ownerOf('ESP')
  const { lot: porLot, owner: porOwner }  = ownerOf('POR')

  // Hardcoded por petición del grupo
  const arechibert = participants.find(p => p.name.toLowerCase().includes('arechibert'))
  const roca       = participants.find(p => p.name.toLowerCase().includes('roca'))

  const cards: { emoji: string; title: string; titleStrike?: string; name: string; desc: string; color: string }[] = []

  if (ricachon && totalBids(ricachon.id) > 0)
    cards.push({ emoji:'🎭', title:'El Protagonista', name: ricachon.name,
      desc:`Hace lo que sea por no pasar desapercibido... pujó ${fmt(totalBids(ricachon.id))} y por poco pone su casa en la línea.`,
      color:'bg-amber-50 border-amber-200' })

  if (codo && codolot)
    cards.push({ emoji:'🤏', title:'El Maestro', name: codo.name,
      desc:`"${codolot.title}" por ${fmt(codolot.final_price??0)}. ¡Un maestro de la negociación!`,
      color:'bg-green-50 border-green-200' })

  if (dormidos.length > 0)
    cards.push({ emoji:'😴', title: dormidos.length===1?'El Dormido':'Los Dormidos', name: dormidos.map(d=>d.name).join(', '),
      desc:`Pagaron el buy-in y no compraron nada. El sueño es libre, pero el buy-in no.`,
      color:'bg-blue-50 border-blue-200' })

  if (farol && farlot)
    cards.push({ emoji:'😤', title:'El Farol', name: farol.name,
      desc:`Pagó ${fmt(farlot.final_price??0)} por un combo. La esperanza es lo último que muere.`,
      color:'bg-purple-50 border-purple-200' })

  if (argOwner && argLot)
    cards.push({ emoji:'🥶', titleStrike:'El Pechofrío', title:'La de Rosario', name: argOwner.name,
      desc:`Compró a Argentina por ${fmt(argLot.final_price??0)}. ¡La de Rosario! ¿Sabio o Pecho-frío?`,
      color:'bg-sky-50 border-sky-200' })

  if (mexOwner && mexLot)
    cards.push({ emoji:'🇲🇽', title:'El Patriota', name: mexOwner.name,
      desc:`Compró a México por ${fmt(mexLot.final_price??0)}. El amor a la patria no tiene precio... pero tiene buy-in.`,
      color:'bg-green-50 border-green-300' })

  if (ganga && gangaLot)
    cards.push({ emoji:'🛒', title:'La Ganga', name: ganga.name,
      desc:`"${gangaLot.title}" por ${fmt(gangaLot.final_price??0)}. Alguien se durmió en la subasta.`,
      color:'bg-lime-50 border-lime-200' })

  if (espOwner && espLot && (espLot.final_price??0)>2000)
    cards.push({ emoji:'👑', title:'El Ludópata Gachupín', name: espOwner.name,
      desc:`${fmt(espLot.final_price??0)} por España #1 FIFA. Listo para cobrar... o llorar.`,
      color:'bg-orange-50 border-orange-200' })

  if (porOwner && porLot)
    cards.push({ emoji:'🦅', title:'El Bicholover', name: porOwner.name,
      desc:`Compró a Portugal por ${fmt(porLot.final_price??0)}. Fan de Cristiano o del buen fútbol, tú decides.`,
      color:'bg-red-50 border-red-200' })

  if (arechibert)
    cards.push({ emoji:'🧠', title:'Los Conocedores', name: arechibert.name,
      desc:`Expertos del fútbol mundial. Saben de táctica, de análisis... y de apostar con conocimiento.`,
      color:'bg-indigo-50 border-indigo-200' })

  if (roca)
    cards.push({ emoji:'🏃', title:'El Retirado', name: roca.name,
      desc:`Deportista de alto rendimiento. Ahora en la cancha de la Calcuta, donde la resistencia también cuenta.`,
      color:'bg-teal-50 border-teal-200' })

  if (cards.length === 0) return null

  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest text-brand-slate mb-3 flex items-center gap-2">
        🎭 Resumen de la Subasta
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ emoji, title, titleStrike, name, desc, color }) => (
          <div key={title} className={`rounded-xl border ${color} px-4 py-3`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{emoji}</span>
              <div>
                {titleStrike && <p className="font-bold text-gray-400 text-xs line-through">{titleStrike}</p>}
                <p className="font-black text-brand-navy text-sm">{title}</p>
              </div>
            </div>
            <p className="text-xs font-bold text-brand-navy-mid mb-0.5">{name}</p>
            <p className="text-[10px] text-gray-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string; icon?: React.ReactNode; color?: string
}) {
  return (
    <div className={`card flex flex-col gap-2 ${color === 'gold' ? 'border-brand-gold/30 bg-amber-50' : color === 'green' ? 'border-green-200 bg-green-50' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="stat-label">{label}</p>
        {icon}
      </div>
      <p className="stat-value">{value}</p>
      {sub && <p className="text-xs text-brand-slate">{sub}</p>}
    </div>
  )
}
