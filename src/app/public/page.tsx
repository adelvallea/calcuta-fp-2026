'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { validateBidIncrement, formatCurrency, buildPoolSummary } from '@/lib/calculations'
import { parseProbs, getLotDisplayProbs, flagCode } from '@/lib/lot-utils'
import type { Participant, Lot, PrizeRule, Team, SponsorContribution } from '@/types'
import toast from 'react-hot-toast'
import { Gavel, Trophy, List, BookOpen, Plus, Minus, X } from 'lucide-react'
import PlayerCarousel from '@/components/ui/PlayerCarousel'

interface RegisteredViewer { id: string; name: string }
type Tab = 'live' | 'prizes' | 'lots' | 'rules'

/* ── REGLAS ─────────────────────────────────────────────────────────────────── */
function RulesContent() {
  return (
    <div className="space-y-5 text-sm text-gray-700 pb-8">
      <Section title="Subasta">
        <p>Los 48 equipos se subastan en lotes (equipos sueltos o combos prearmados para nivelar probabilidad de ganar).</p>
        <p className="mt-2">Subasta abierta con moderador; el lote es de quien ofrezca más. Puedes ganar varios lotes o ninguno. <strong>Bids aumentan en $200 o más.</strong></p>
      </Section>
      <Section title="Buy-in">
        <p>Cada participante paga <strong>$1,000 obligatorios</strong> para entrar. Ese monto es crédito para tu subasta.</p>
        <div className="mt-3 space-y-2 pl-3 border-l-2 border-brand-gold/40">
          <p className="italic text-gray-600"><strong className="not-italic text-gray-700">Ejemplo 1:</strong> compras un lote en $1,600 → pagas $600 adicionales (total $1,600).</p>
          <p className="italic text-gray-600"><strong className="not-italic text-gray-700">Ejemplo 2:</strong> compras un lote en $800 → cubierto por el buy-in; te quedan $200 para otro lote.</p>
        </div>
        <p className="mt-2 font-semibold text-gray-800">Si no ganas ningún lote, pierdes tu buy-in.</p>
      </Section>
      <Section title="Reparto de la bolsa">
        <div className="rounded-xl overflow-hidden border border-gray-100 mt-2">
          {[
            { pos: '1.º', label: 'Campeón',      pct: '30%', icon: '🏆', bg: 'bg-amber-50' },
            { pos: '2.º', label: 'Subcampeón',   pct: '20%', icon: '🥈', bg: 'bg-gray-50' },
            { pos: '3.er', label: '3er lugar',    pct: '10%', icon: '🥉', bg: 'bg-orange-50' },
            { pos: '32.º', label: 'Lugar 32',     pct: '20%', icon: '⚖️', bg: 'bg-blue-50' },
            { pos: '48.º', label: 'Último lugar', pct: '20%', icon: '🔴', bg: 'bg-red-50' },
          ].map(({ pos, label, pct, icon, bg }) => (
            <div key={pos} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 ${bg}`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{icon}</span>
                <span className="font-bold text-gray-700">{pos} {label}</span>
              </div>
              <span className="text-xl font-black text-brand-navy">{pct}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Posiciones">
        <p>Se usa la <strong>clasificación final oficial de FIFA</strong> para determinar las posiciones finales del Mundial.</p>
        <p className="mt-1 text-gray-500 text-xs">Un mismo dueño puede cobrar varios premios si sus equipos clasifican.</p>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-brand-navy border-b border-gray-100 pb-1.5 mb-3">{title}</h3>
      {children}
    </div>
  )
}

/* ── PÁGINA PRINCIPAL ────────────────────────────────────────────────────────── */
export default function PublicPage() {
  const supabase = createClient()
  const [viewer, setViewer] = useState<RegisteredViewer | null>(null)
  const [regForm, setRegForm] = useState({ name: '' })
  const [tab, setTab] = useState<Tab>('live')
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

  useEffect(() => {
    const ch = supabase.channel('public-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots' }, loadAll)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, loadAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    if (activeLot) setBidAmount(activeLot.current_bid + minIncrement)
  }, [activeLot?.current_bid, minIncrement])

  async function register() {
    if (!regForm.name.trim()) return toast.error('Ingresa tu nombre')
    const { data: existing } = await supabase.from('participants').select('id, name').ilike('name', regForm.name.trim()).single()
    if (existing) {
      setViewer({ id: existing.id, name: existing.name })
      toast.success(`¡Bienvenido ${existing.name}!`)
    } else {
      const { data: created, error } = await supabase.from('participants')
        .insert({ name: regForm.name.trim(), buy_in_amount: settings?.buy_in_amount ?? 1000, amount_paid: 0 })
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
      await supabase.from('bids').insert({ lot_id: activeLot.id, participant_id: viewer.id, amount: bidAmount, created_by: viewer.name })
      await supabase.from('lots').update({ current_bid: bidAmount, status: 'active' }).eq('id', activeLot.id)
      toast.success(`¡Bid de ${fmt(bidAmount)} registrado!`)
    } catch (e: any) { toast.error(e.message) }
    finally { setBidding(false) }
  }

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'live',   label: 'En vivo',  icon: <Gavel className="h-4 w-4" /> },
    { key: 'prizes', label: 'FPremios', icon: <Trophy className="h-4 w-4" /> },
    { key: 'lots',   label: 'Lotes',    icon: <List className="h-4 w-4" /> },
    { key: 'rules',  label: 'Reglas',   icon: <BookOpen className="h-4 w-4" /> },
  ]

  // ── PANTALLA DE REGISTRO ──────────────────────────────────────────────────────
  if (!viewer) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">
        {/* Hero foto — mitad izquierda en desktop, fondo en móvil */}
        <div className="relative md:w-1/2 h-48 md:h-auto">
          <img src="/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/40 via-brand-navy/40 to-brand-navy md:to-brand-navy/80" />
          <div className="relative z-10 h-full flex flex-col items-center justify-end pb-6 md:pb-12 px-6 text-center">
            <img src="/logo.png" alt="FP" className="h-14 w-14 mb-2 drop-shadow-xl"
              onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg' }} />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold">Calcuta FP</p>
            <h2 className="text-2xl md:text-3xl font-black text-white">Mundial 2026</h2>
            <p className="text-xs text-white/60 mt-1">La quiniela de los campeones</p>
          </div>
        </div>

        {/* Formulario */}
        <div className="flex-1 flex items-center justify-center bg-white px-6 py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-black text-brand-navy mb-1">¡Únete a la Calcuta!</h1>
            <p className="text-sm text-gray-400 mb-6">Ingresa tu nombre para ver y pujar en tiempo real</p>
            <div className="space-y-4">
              <input value={regForm.name}
                onChange={(e) => setRegForm({ name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && register()}
                placeholder="Tu nombre completo"
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-brand-gold focus:outline-none transition-colors" />
              <button onClick={register} className="btn-gold w-full justify-center py-3.5 text-base rounded-xl">
                Entrar
              </button>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-4">
              Si ya eres participante usa exactamente el mismo nombre.
            </p>
            {/* Grid de jugadores — fotos completas */}
            <div className="mt-6 rounded-xl overflow-hidden h-36">
              <PlayerCarousel className="h-full w-full" fit="contain" bgColor="#0a1628" interval={3000} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── VISTA PRINCIPAL ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">

      {/* Hero header */}
      <header className="relative overflow-hidden shrink-0" style={{ height: '140px' }}>
        <img src="/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/50 to-brand-navy/85" />
        <div className="relative z-10 h-full flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="FP" className="h-12 w-12 drop-shadow-lg"
              onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg' }} />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-brand-gold">Calcuta FP · Mundial 2026</p>
              <p className="text-sm font-black text-white">{pool?.total_pool ? fmt(pool.total_pool) : '—'}</p>
              <p className="text-[9px] text-white/50">Bolsa acumulada</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50">Hola,</p>
            <p className="text-sm font-bold text-brand-gold">{viewer.name}</p>
            <button onClick={() => setViewer(null)} className="text-[10px] text-white/30 hover:text-white/60 underline mt-0.5">
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Foto jugador — contenida sin recorte */}
      <div className="h-36 overflow-hidden shrink-0 bg-brand-navy">
        <PlayerCarousel className="h-full w-full" fit="contain" bgColor="#0a1628" interval={3000} />
      </div>

      {/* Tabs de navegación */}
      <div className="bg-white border-b border-gray-100 shrink-0 sticky top-0 z-20">
        <div className="flex">
          {TABS.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors border-b-2 ${
                tab === key
                  ? 'border-brand-gold text-brand-gold'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido de la tab */}
      <div className="flex-1 overflow-y-auto">

        {/* ── TAB: EN VIVO ─────────────────────────────────────────────────── */}
        {tab === 'live' && (
          <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

            {/* Lote activo */}
            {activeLot ? (
              <div className="card border-2 border-brand-gold">
                <div className="flex items-center gap-2 mb-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wider">En subasta ahora</span>
                  <span className="ml-auto text-xs font-mono text-brand-gold font-bold">Lote {activeLot.number}</span>
                </div>

                <h2 className="text-base font-bold text-brand-navy mb-3">{activeLot.title}</h2>

                {/* Equipos */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {activeLot.teams?.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-1 rounded-lg bg-brand-bg px-2 py-1">
                      <img src={`https://flagcdn.com/w40/${flagCode(t.country_code)}.png`}
                        className="h-3.5 w-5 rounded object-cover" alt={t.name}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      <span className="text-xs font-semibold text-brand-navy">{t.name}</span>
                    </div>
                  ))}
                </div>

                {/* Probabilidad */}
                {(() => {
                  const d = getLotDisplayProbs(activeLot.number, parseProbs(activeLot.notes))
                  return (
                    <div className="rounded-lg bg-amber-50 border border-brand-gold/20 px-3 py-2 mb-3 flex items-center justify-between">
                      <span className="text-xs text-gray-500">{d.label}</span>
                      <span className="text-sm font-black text-brand-gold-dark">{d.value.toFixed(1)}%</span>
                    </div>
                  )
                })()}

                {/* Bid actual */}
                <div className="rounded-xl bg-brand-navy p-3 text-center mb-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">Bid actual</p>
                  <p className="text-3xl font-black text-brand-gold">
                    {activeLot.current_bid === 0 ? 'Sin bids' : fmt(activeLot.current_bid)}
                  </p>
                  {activeLot.bids?.[0] && (
                    <p className="text-xs text-white/60 mt-1">Líder: {(activeLot.bids[0] as any)?.participant?.name ?? '—'}</p>
                  )}
                  <p className="text-[10px] text-white/30 mt-1">Mínimo siguiente: {fmt(activeLot.current_bid + minIncrement)}</p>
                </div>

                {/* Mi bid */}
                <p className="text-xs font-semibold text-brand-navy mb-2">Tu bid, {viewer.name}:</p>
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => setBidAmount(v => Math.max(activeLot.current_bid + minIncrement, v - minIncrement))}
                    className="rounded-xl border-2 border-gray-200 p-2.5 hover:bg-gray-50 active:scale-95 transition">
                    <Minus className="h-4 w-4" />
                  </button>
                  <input type="number" value={bidAmount}
                    onChange={(e) => setBidAmount(Number(e.target.value))}
                    min={activeLot.current_bid + minIncrement} step={minIncrement}
                    className="flex-1 rounded-xl border-2 border-gray-200 px-3 py-2.5 text-center text-xl font-black focus:border-brand-gold focus:outline-none" />
                  <button onClick={() => setBidAmount(v => v + minIncrement)}
                    className="rounded-xl border-2 border-gray-200 p-2.5 hover:bg-gray-50 active:scale-95 transition">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {[1, 2, 3, 5].map(mult => {
                    const q = activeLot.current_bid + minIncrement * mult
                    return (
                      <button key={mult} onClick={() => setBidAmount(q)}
                        className="flex-1 rounded-lg bg-gray-100 py-1.5 text-xs font-semibold hover:bg-brand-gold hover:text-white transition active:scale-95">
                        {fmt(q)}
                      </button>
                    )
                  })}
                </div>
                <button onClick={placeBid} disabled={bidding}
                  className="btn-gold w-full justify-center py-3.5 text-base rounded-xl active:scale-95">
                  <Gavel className="h-5 w-5" />
                  {bidding ? 'Registrando...' : `Pujar ${fmt(bidAmount)}`}
                </button>

                {/* Historial */}
                {activeLot.bids?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Historial</p>
                    {activeLot.bids.slice(0, 5).map((bid: any, i: number) => (
                      <div key={bid.id} className={`flex justify-between text-xs rounded-lg px-3 py-1.5 ${i === 0 ? 'bg-brand-gold/10 font-semibold' : 'bg-gray-50'}`}>
                        <span className="text-gray-600">{bid.participant?.name ?? '—'}</span>
                        <span className={i === 0 ? 'font-bold text-brand-gold-dark' : 'text-gray-600'}>{fmt(bid.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="card text-center py-10">
                <Gavel className="h-8 w-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-500">Sin lote en subasta ahora</p>
                <p className="text-xs text-gray-400 mt-1">La pantalla se actualiza automáticamente</p>
              </div>
            )}

            {/* Progreso rápido */}
            <div className="card">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span className="font-semibold">Progreso subasta</span>
                <span>{pool?.lots_sold ?? 0}/{lots.length} lotes vendidos</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-brand-gold transition-all"
                  style={{ width: `${lots.length ? ((pool?.lots_sold ?? 0) / lots.length) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
                <span>{pool?.lots_pending ?? lots.length} pendientes</span>
                <span>{pool?.total_participants ?? 0} FParticipantes</span>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: FPREMIOS ────────────────────────────────────────────────── */}
        {tab === 'prizes' && (
          <div className="max-w-lg mx-auto px-4 py-4 space-y-3 pb-8">
            {/* Banner */}
            <div className="relative h-36 rounded-2xl overflow-hidden bg-brand-navy">
              <PlayerCarousel className="h-full w-full" fit="contain" bgColor="#0a1628" interval={4000} />
              <div className="absolute inset-0 flex items-center justify-center gap-3 z-10">
                <img src="/logo.png" alt="FP" className="h-10 w-10"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg' }} />
                <div>
                  <p className="text-xs font-black text-white">Bolsa total</p>
                  <p className="text-2xl font-black text-brand-gold">{fmt(pool?.total_pool ?? 0)}</p>
                </div>
              </div>
            </div>

            {pool?.prizes?.map((p: any) => (
              <div key={p.rule.id} className="card flex items-center gap-4">
                <div className="text-3xl shrink-0">
                  {p.rule.final_position === 1 ? '🏆' : p.rule.final_position === 2 ? '🥈' :
                   p.rule.final_position === 3 ? '🥉' : p.rule.final_position === 32 ? '⚖️' : '🔴'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-brand-navy">{p.rule.name}</p>
                  <p className="text-[10px] text-gray-400">{p.rule.description}</p>
                  {p.current_candidate && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <img src={`https://flagcdn.com/w40/${flagCode(p.current_candidate.team.country_code)}.png`}
                        className="h-3 w-4.5 rounded object-cover" alt=""
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      <p className="text-xs font-semibold text-brand-navy-mid truncate">{p.current_candidate.team.name}</p>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-brand-navy">{fmt(p.prize_amount)}</p>
                  <p className="text-[10px] text-gray-400">{p.rule.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: LOTES ───────────────────────────────────────────────────── */}
        {tab === 'lots' && (
          <div className="max-w-lg mx-auto px-4 py-4 space-y-2 pb-8">
            <div className="flex gap-2 text-xs mb-3">
              <span className="badge-sold">Vendido</span>
              <span className="badge-active">En subasta</span>
              <span className="badge-pending">Pendiente</span>
            </div>
            {lots.map((lot: any) => {
              const d = getLotDisplayProbs(lot.number, parseProbs(lot.notes))
              const owners = lot.ownerships?.map((o: any) => o.participant?.name).filter(Boolean) ?? []
              return (
                <div key={lot.id} className={`rounded-xl bg-white border px-4 py-3 ${
                  lot.status === 'sold' ? 'border-green-200' :
                  lot.status === 'active' ? 'border-brand-gold' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold text-brand-gold">#{lot.number}</span>
                        <span className={lot.status === 'sold' ? 'badge-sold' : lot.status === 'active' ? 'badge-active' : 'badge-pending'}>
                          {lot.status === 'sold' ? 'Vendido' : lot.status === 'active' ? 'En subasta' : 'Pendiente'}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-brand-navy mt-0.5 leading-tight">{lot.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {lot.teams?.map((t: any) => t.name).join(' · ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-bold ${d.show === 'champion' ? 'text-brand-gold-dark' : d.show === 'pos32' ? 'text-blue-600' : 'text-red-600'}`}>
                        {d.value.toFixed(1)}%
                      </p>
                      <p className="text-[9px] text-gray-400">{d.label.split(' ').slice(1).join(' ')}</p>
                    </div>
                  </div>
                  {lot.status === 'sold' && (
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[10px] text-gray-500">{owners.join(', ')}</p>
                      <p className="text-xs font-bold text-green-700">{fmt(lot.final_price ?? 0)}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── TAB: REGLAS ──────────────────────────────────────────────────── */}
        {tab === 'rules' && (
          <div className="max-w-lg mx-auto px-4 py-4">
            {/* Banner */}
            <div className="relative h-24 rounded-2xl overflow-hidden mb-5">
              <img src="/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
              <div className="absolute inset-0 bg-brand-navy/70" />
              <div className="relative z-10 h-full flex items-center justify-center gap-3">
                <img src="/logo.png" alt="FP" className="h-10 w-10"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg' }} />
                <div>
                  <p className="text-xs font-black text-white">Calcuta FP · Mundial 2026</p>
                  <p className="text-[10px] text-brand-gold">Reglas del juego</p>
                </div>
              </div>
            </div>
            <RulesContent />
          </div>
        )}

        {/* Footer */}
        <div className="max-w-lg mx-auto px-4 pb-6">
          <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-200 mt-4">
            <img src="/logo.png" alt="FP" className="h-6 w-6"
              onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg' }} />
            <p className="text-[10px] text-gray-400">Calcuta FP · Mundial 2026</p>
          </div>
        </div>
      </div>
    </div>
  )
}
