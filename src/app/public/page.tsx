'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { validateBidIncrement, formatCurrency, buildPoolSummary } from '@/lib/calculations'
import { parseProbs, getLotDisplayProbs, flagCode } from '@/lib/lot-utils'
import type { Participant, Lot, PrizeRule, Team, SponsorContribution } from '@/types'
import toast from 'react-hot-toast'
import { Gavel, Trophy, Users, DollarSign, Plus, Minus } from 'lucide-react'
import PlayerCarousel from '@/components/ui/PlayerCarousel'

interface RegisteredViewer { id: string; name: string }

export default function PublicPage() {
  const supabase = createClient()
  const [viewer, setViewer] = useState<RegisteredViewer | null>(null)
  const [regForm, setRegForm] = useState({ name: '', phone: '' })
  const [activeLot, setActiveLot] = useState<(Lot & { teams: Team[]; bids: any[] }) | null>(null)
  const [lots, setLots] = useState<any[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [rules, setRules] = useState<PrizeRule[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [bidAmount, setBidAmount] = useState(0)
  const [bidding, setBidding] = useState(false)
  const [pool, setPool] = useState<any>(null)

  const currency = settings?.currency ?? 'MXN'
  const minIncrement = settings?.min_bid_increment ?? 200
  const fmt = useCallback((n: number) => formatCurrency(n, currency), [currency])

  // Cargar datos iniciales
  async function loadAll() {
    const [{ data: cfg }, { data: ps }, { data: ls }, { data: rls }, { data: ts }] = await Promise.all([
      supabase.from('calcuta_settings').select('*').single(),
      supabase.from('participants').select('*'),
      supabase.from('lots').select('*, teams:lot_teams(team:teams(*)), ownerships:lot_ownerships(participant_id, lot_id, ownership_percentage, participant:participants(name)), bids(*, participant:participants(name))').order('number'),
      supabase.from('prize_rules').select('*').order('sort_order'),
      supabase.from('teams').select('*'),
    ])
    setSettings(cfg)
    setParticipants(ps as Participant[] ?? [])
    setRules(rls as PrizeRule[] ?? [])
    setTeams(ts as Team[] ?? [])

    const normalized = (ls ?? []).map((l: any) => ({
      ...l,
      teams: l.teams?.map((lt: any) => lt.team).filter(Boolean) ?? [],
      bids: (l.bids ?? []).sort((a: any, b: any) => b.amount - a.amount),
    }))
    setLots(normalized)

    const active = normalized.find((l: any) => l.status === 'active')
    setActiveLot(active ?? null)
    if (active) setBidAmount(active.current_bid + (cfg?.min_bid_increment ?? 200))

    if (ps && rls && ts) {
      const p = buildPoolSummary(ps as Participant[], normalized as Lot[], rls as PrizeRule[], ts as Team[], [])
      setPool(p)
    }
  }

  useEffect(() => { loadAll() }, [])

  // Realtime: lotes y bids
  useEffect(() => {
    const ch = supabase.channel('public-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots' }, () => loadAll())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, () => loadAll())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Actualizar bid mínimo cuando cambia el lote activo
  useEffect(() => {
    if (activeLot) setBidAmount(activeLot.current_bid + minIncrement)
  }, [activeLot?.current_bid, minIncrement])

  // Registro de viewer — busca o crea participante
  async function register() {
    if (!regForm.name.trim()) return toast.error('Ingresa tu nombre')
    // Buscar participante existente por nombre
    const { data: existing } = await supabase
      .from('participants')
      .select('id, name')
      .ilike('name', regForm.name.trim())
      .single()

    if (existing) {
      setViewer({ id: existing.id, name: existing.name })
      toast.success(`¡Bienvenido ${existing.name}!`)
    } else {
      // Crear participante nuevo
      const { data: created, error } = await supabase
        .from('participants')
        .insert({ name: regForm.name.trim(), phone: regForm.phone || null, buy_in_amount: settings?.buy_in_amount ?? 1000, amount_paid: 0 })
        .select().single()
      if (error) return toast.error(error.message)
      setViewer({ id: created.id, name: created.name })
      toast.success(`¡Registrado como ${created.name}!`)
    }
  }

  async function placeBid() {
    if (!viewer || !activeLot) return
    const v = validateBidIncrement(bidAmount, activeLot.current_bid, minIncrement)
    if (!v.valid) return toast.error(v.message ?? 'Bid inválido')

    setBidding(true)
    try {
      await supabase.from('bids').insert({
        lot_id: activeLot.id,
        participant_id: viewer.id,
        amount: bidAmount,
        created_by: viewer.name,
      })
      await supabase.from('lots').update({ current_bid: bidAmount, status: 'active' }).eq('id', activeLot.id)
      toast.success(`¡Bid de ${fmt(bidAmount)} registrado!`)
    } catch (e: any) { toast.error(e.message) }
    finally { setBidding(false) }
  }

  // ── REGISTRO ────────────────────────────────────────────────────────────────
  if (!viewer) {
    return (
      <div className="min-h-screen flex">
        {/* Mitad izquierda: foto grupal hero — oculto en móvil */}
        <div className="hidden md:flex md:w-1/2 relative flex-col">
          {/* Foto grupal como fondo principal */}
          <div className="flex-1 relative overflow-hidden">
            <img src="/hero.jpg" alt="Equipo México" className="absolute inset-0 h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/30 to-transparent" />
            {/* Texto encima */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 px-8 text-center z-10">
              <img src="/logo.png" alt="FP" className="h-16 w-16 mb-3 drop-shadow-lg"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg' }} />
              <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-brand-gold mb-1">Calcuta FP</p>
              <h2 className="text-3xl font-black text-white leading-tight">Mundial 2026</h2>
              <p className="text-sm text-white/60 mt-2">La quiniela de los campeones</p>
            </div>
          </div>
          {/* Strip de miniaturas con carrusel */}
          <div className="h-20 flex overflow-hidden">
            <PlayerCarousel className="w-full h-full" overlay="none" interval={3000} />
          </div>
        </div>

        {/* Mitad derecha: formulario */}
        <div className="flex-1 flex items-center justify-center p-6 bg-white">
          <div className="w-full max-w-sm">
            {/* Logo / header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-brand-navy mb-4 overflow-hidden">
                <img src="/logo.png" alt="FP" className="h-14 w-14 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg' }} />
              </div>
              <h1 className="text-2xl font-black text-brand-navy">Calcuta FP 2026</h1>
              <p className="text-sm text-brand-slate mt-1">Ingresa para ver y pujar en tiempo real</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Tu nombre</label>
                <input value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && register()}
                  placeholder="Nombre completo"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/20" />
              </div>
              <button onClick={register} className="btn-gold w-full justify-center py-3.5 text-base rounded-xl mt-2">
                Entrar a la Calcuta
              </button>
            </div>

            {/* Fondo decorativo móvil */}
            <div className="md:hidden mt-8">
              <PlayerCarousel className="h-32 w-full rounded-xl" overlay="dark" interval={3000} />
            </div>

            <p className="text-[10px] text-gray-400 text-center mt-4">
              Si ya eres participante, usa exactamente el mismo nombre para identificarte.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── VISTA PRINCIPAL ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Header */}
      <header className="bg-brand-navy text-white py-4 px-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Vista Participante</p>
          <p className="text-sm font-bold">{settings?.event_name ?? 'Gran Calcuta · Mundial 2026'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-white/60">Sesión</p>
            <p className="text-sm font-bold text-brand-gold">{viewer.name}</p>
          </div>
          <button onClick={() => setViewer(null)} className="text-xs text-white/40 hover:text-white underline">Salir</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats rápidas */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <DollarSign className="h-5 w-5 text-brand-gold mx-auto mb-1" />
            <p className="text-lg font-black text-brand-navy">{fmt(pool?.total_pool ?? 0)}</p>
            <p className="text-[10px] text-gray-400 uppercase">Bolsa</p>
          </div>
          <div className="card text-center">
            <Gavel className="h-5 w-5 text-brand-slate mx-auto mb-1" />
            <p className="text-lg font-black text-brand-navy">{pool?.lots_sold ?? 0}/{lots.length}</p>
            <p className="text-[10px] text-gray-400 uppercase">Lotes</p>
          </div>
          <div className="card text-center">
            <Users className="h-5 w-5 text-brand-slate mx-auto mb-1" />
            <p className="text-lg font-black text-brand-navy">{participants.length}</p>
            <p className="text-[10px] text-gray-400 uppercase">Participantes</p>
          </div>
        </div>

        {/* Lote activo */}
        {activeLot ? (
          <div className="card border-2 border-brand-gold">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wider">En subasta ahora</span>
                </div>
                <h2 className="text-lg font-bold text-brand-navy">{activeLot.title}</h2>
              </div>
              <div className="text-right">
                {(() => {
                  const probs = parseProbs(activeLot.notes)
                  const d = getLotDisplayProbs(activeLot.number, probs)
                  return (
                    <div className="rounded-lg bg-amber-50 px-3 py-1.5 text-center">
                      <p className="text-xs text-gray-500">{d.label}</p>
                      <p className="text-sm font-black text-brand-gold-dark">{d.value.toFixed(1)}%</p>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Equipos del lote */}
            <div className="flex flex-wrap gap-2 mb-4">
              {activeLot.teams.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5 rounded-lg bg-brand-bg px-2.5 py-1.5">
                  <img src={`https://flagcdn.com/w40/${flagCode(t.country_code)}.png`} className="h-4 w-5 rounded object-cover" alt={t.name}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  <span className="text-xs font-semibold text-brand-navy">{t.name}</span>
                  <span className="text-[10px] text-gray-400">#{t.fifa_rank}</span>
                </div>
              ))}
            </div>

            {/* Bid actual */}
            <div className="rounded-xl bg-brand-navy p-4 text-center mb-4">
              <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Bid actual</p>
              <p className="text-3xl font-black text-brand-gold">
                {activeLot.current_bid === 0 ? 'Sin bids' : fmt(activeLot.current_bid)}
              </p>
              {activeLot.bids?.[0] && (
                <p className="text-sm text-white/70 mt-1">
                  Lider: {(activeLot.bids[0] as any)?.participant?.name ?? '—'}
                </p>
              )}
              <p className="text-xs text-white/40 mt-1">Mínimo: {fmt(activeLot.current_bid + minIncrement)}</p>
            </div>

            {/* Mi bid */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-brand-navy">Tu bid, {viewer.name}:</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setBidAmount((v) => Math.max(activeLot.current_bid + minIncrement, v - minIncrement))}
                  className="rounded-lg border border-gray-200 p-2.5 hover:bg-gray-50">
                  <Minus className="h-4 w-4" />
                </button>
                <input type="number" value={bidAmount} onChange={(e) => setBidAmount(Number(e.target.value))}
                  min={activeLot.current_bid + minIncrement} step={minIncrement}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-center text-xl font-bold focus:border-brand-gold focus:outline-none" />
                <button onClick={() => setBidAmount((v) => v + minIncrement)}
                  className="rounded-lg border border-gray-200 p-2.5 hover:bg-gray-50">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[0, 1, 2, 3].map((i) => {
                  const q = activeLot.current_bid + minIncrement * (i + 1)
                  return (
                    <button key={i} onClick={() => setBidAmount(q)}
                      className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium hover:bg-brand-gold hover:text-white transition">
                      {fmt(q)}
                    </button>
                  )
                })}
              </div>
              <button onClick={placeBid} disabled={bidding}
                className="btn-gold w-full justify-center py-3 text-base">
                <Gavel className="h-5 w-5" />
                {bidding ? 'Registrando...' : `Pujar ${fmt(bidAmount)}`}
              </button>
            </div>

            {/* Historial */}
            {activeLot.bids?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Historial</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {activeLot.bids.map((bid: any, i: number) => (
                    <div key={bid.id} className={`flex justify-between text-xs rounded-lg px-3 py-1.5 ${i === 0 ? 'bg-brand-gold/10 font-semibold' : 'bg-gray-50'}`}>
                      <span className="text-gray-600">{bid.participant?.name ?? '—'}</span>
                      <span className={i === 0 ? 'text-brand-gold-dark font-bold' : 'text-gray-600'}>{fmt(bid.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card text-center py-8">
            <Gavel className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-500">Sin lote en subasta en este momento</p>
            <p className="text-xs text-gray-400 mt-1">La pantalla se actualizará automáticamente cuando inicie el siguiente lote</p>
          </div>
        )}

        {/* Premios */}
        {pool?.prizes && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-slate mb-3">
              <Trophy className="inline h-3.5 w-3.5 mr-1" /> Premios estimados
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {pool.prizes.map((p: any) => (
                <div key={p.rule.id} className="rounded-xl bg-white border border-gray-100 p-3 text-center shadow-sm">
                  <p className="text-base font-black text-brand-navy">{fmt(p.prize_amount)}</p>
                  <p className="text-[10px] font-semibold text-brand-slate mt-0.5">{p.rule.name}</p>
                  {p.current_candidate ? (
                    <p className="text-[10px] text-brand-gold-dark font-bold mt-1">{p.current_candidate.team.name}</p>
                  ) : (
                    <p className="text-[10px] text-gray-300 italic mt-1">Pendiente</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Lotes vendidos */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-brand-slate mb-3">
            Lotes vendidos ({lots.filter(l => l.status === 'sold').length})
          </h2>
          <div className="space-y-2">
            {lots.filter(l => l.status === 'sold').map((lot: any) => {
              const probs = parseProbs(lot.notes)
              const d = getLotDisplayProbs(lot.number, probs)
              return (
                <div key={lot.id} className="rounded-xl bg-white border border-gray-100 px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-brand-gold">#{lot.number}</span>
                      <p className="text-sm font-semibold text-brand-navy truncate">{lot.title}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {lot.teams?.map((t: any) => t.name).join(' · ')}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {d.label}: <strong>{d.value.toFixed(1)}%</strong>
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-green-700">{fmt(lot.final_price ?? 0)}</p>
                    <p className="text-[10px] text-brand-slate">
                      {lot.ownerships?.map((o: any) => o.participant?.name).filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              )
            })}
            {lots.filter(l => l.status === 'sold').length === 0 && (
              <p className="text-sm text-gray-400 italic">La subasta aún no ha comenzado</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
