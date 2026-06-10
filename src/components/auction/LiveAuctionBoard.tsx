'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validateBidIncrement, formatCurrency } from '@/lib/calculations'
import { parseProbs, getLotDisplayProbs, flagCode } from '@/lib/lot-utils'
import type { Lot, Bid, Team } from '@/types'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight, Gavel, CheckCircle,
  PauseCircle, Plus, Minus, Info
} from 'lucide-react'

interface Props {
  initialLot: Lot & { teams: Team[]; bids: Bid[] }
  allLots: Array<{ id: string; number: number; title: string; status: string; current_bid: number; type: string }>
  participants: Array<{ id: string; name: string }>
  settings: { buy_in_amount: number; min_bid_increment: number; currency: string; currency_symbol: string } | null
}

export default function LiveAuctionBoard({ initialLot, allLots, participants, settings }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const minIncrement = settings?.min_bid_increment ?? 200
  const currency = settings?.currency ?? 'MXN'

  const [lot, setLot] = useState(initialLot)
  const [teamIndex, setTeamIndex] = useState(0)          // equipo visible
  const [bidAmount, setBidAmount] = useState(initialLot.current_bid + minIncrement)
  const [selectedParticipant, setSelectedParticipant] = useState('')
  const [loading, setLoading] = useState(false)
  const [soldFlash, setSoldFlash] = useState(false)

  const fmt = useCallback((n: number) => formatCurrency(n, currency), [currency])
  const probs  = parseProbs(lot.notes)
  const display = getLotDisplayProbs(lot.number, probs)
  const teams   = lot.teams ?? []
  const currentTeam = teams[teamIndex]
  const isCombo = lot.type === 'combo'

  /* Realtime */
  useEffect(() => {
    const ch = supabase.channel(`lot-live-${lot.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots', filter: `id=eq.${lot.id}` },
        p => setLot(prev => ({ ...prev, ...(p.new as Partial<Lot>) })))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `lot_id=eq.${lot.id}` },
        async () => {
          const { data } = await supabase.from('bids')
            .select('*, participant:participants(name)')
            .eq('lot_id', lot.id).order('created_at', { ascending: false })
          if (data) setLot(prev => ({ ...prev, bids: data as Bid[] }))
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [lot.id])

  useEffect(() => { setBidAmount(lot.current_bid + minIncrement) }, [lot.current_bid, minIncrement])
  /* Al cambiar de lote, resetear índice de equipo */
  useEffect(() => { setTeamIndex(0) }, [lot.id])

  const leader     = lot.bids?.[0]
  const leaderName = (leader as any)?.participant?.name ?? ''

  async function handleBid() {
    if (!selectedParticipant) return toast.error('Selecciona un participante')
    const v = validateBidIncrement(bidAmount, lot.current_bid, minIncrement)
    if (!v.valid) return toast.error(v.message ?? 'Bid inválido')
    setLoading(true)
    try {
      await supabase.from('bids').insert({ lot_id: lot.id, participant_id: selectedParticipant, amount: bidAmount, created_by: 'admin' })
      await supabase.from('lots').update({ current_bid: bidAmount, status: 'active' }).eq('id', lot.id)
      const name = participants.find(p => p.id === selectedParticipant)?.name ?? ''
      toast.success(`Bid ${fmt(bidAmount)} — ${name}`)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function handleSell() {
    if (lot.current_bid === 0) return toast.error('No hay bids registrados')
    const winnerId = (leader as any)?.participant_id
    setLoading(true)
    try {
      await supabase.from('lots').update({ status: 'sold', final_price: lot.current_bid }).eq('id', lot.id)
      if (winnerId) await supabase.from('lot_ownerships').upsert({ lot_id: lot.id, participant_id: winnerId, ownership_percentage: 100 })
      setSoldFlash(true)
      setTimeout(() => setSoldFlash(false), 2500)
      toast.success(`¡Vendido! ${fmt(lot.current_bid)}`)
      setTimeout(() => {
        const next = allLots.find(l => l.status === 'pending' && l.number > lot.number)
        if (next) router.push(`/auction/live/${next.id}`)
        else router.push('/auction')
      }, 2200)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function handleStatus(status: 'paused' | 'pending') {
    await supabase.from('lots').update({ status }).eq('id', lot.id)
    toast.success(status === 'paused' ? 'Lote pausado' : 'Lote reactivado')
  }

  const nextLot = allLots.find(l => l.number > lot.number && l.status === 'pending')
  const prevLot = [...allLots].reverse().find(l => l.number < lot.number)
  const soldCount = allLots.filter(l => l.status === 'sold').length

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-700 ${soldFlash ? 'bg-green-50' : 'bg-brand-bg'}`}>

      {/* ── TOP BAR con foto de fondo ────────────────────────────────────────── */}
      <header className="relative bg-brand-navy px-6 py-3 flex items-center justify-between shrink-0 overflow-hidden">
        {/* Foto sutil de fondo */}
        {/* Hero foto grupal con baja opacidad */}
        <img src="/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-15" />
        {/* Contenido del header sobre la foto */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="text-2xl">⚽</span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-brand-gold">Calcuta FP</p>
            <p className="text-[10px] text-white/40 -mt-0.5">Mundial 2026</p>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-4">
          {prevLot && (
            <button onClick={() => router.push(`/auction/live/${prevLot.id}`)}
              className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition">
              <ChevronLeft className="h-3 w-3" /> Lote {prevLot.number}
            </button>
          )}
          <span className="text-xs font-mono text-white/30">{soldCount}/{allLots.length} vendidos</span>
          {nextLot && (
            <button onClick={() => router.push(`/auction/live/${nextLot.id}`)}
              className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition">
              Lote {nextLot.number} <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── CENTRO: tarjeta del lote ─────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {/* Encabezado del lote */}
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="rounded-full bg-brand-navy px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-gold">
                Lote {lot.number}
              </span>
              <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold uppercase text-gray-600">
                {isCombo ? `Combo · ${teams.length} equipos` : 'Solo · 1 equipo'}
              </span>
              <LotStatusBadge status={lot.status} />
            </div>
            <h1 className="text-xl font-bold text-brand-navy leading-tight">{lot.title}</h1>
          </div>

          {/* Probabilidad del lote (solo la relevante) */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1">
              <Info className="h-3 w-3" /> Probabilidad de Premio
            </p>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-4xl mb-1">
                  {display.show === 'champion' ? '🏆' : display.show === 'pos32' ? '⚖️' : '🔴'}
                </div>
                <p className="text-4xl font-black text-brand-navy">{display.value.toFixed(1)}%</p>
              </div>
              <div className="flex-1 pl-4 border-l border-gray-100">
                <p className="text-base font-bold text-brand-navy">{display.label}</p>
                <p className="text-sm text-brand-slate mt-0.5">{display.prize}</p>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  {display.show === 'champion'
                    ? 'Prob. de que un equipo del lote sea Campeón del Mundial.'
                    : display.show === 'pos32'
                    ? 'Prob. de ser el peor equipo que supera la fase de grupos (Lugar 32).'
                    : 'Prob. de tener el peor récord en fase de grupos (Último lugar, posición 48).'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Equipo actual (UNO a la vez) ───────────────────────────────── */}
          {currentTeam && (
            <div className="rounded-2xl border-2 border-brand-navy bg-white shadow-md overflow-hidden">
              {/* Mini-nav de equipos cuando hay más de uno */}
              {teams.length > 1 && (
                <div className="flex items-center justify-between bg-brand-navy px-4 py-2">
                  <button
                    onClick={() => setTeamIndex(i => Math.max(0, i - 1))}
                    disabled={teamIndex === 0}
                    className="rounded p-1 text-white/60 hover:text-white disabled:opacity-30 transition">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-2">
                    {teams.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setTeamIndex(i)}
                        className={`h-2 w-2 rounded-full transition-all ${i === teamIndex ? 'bg-brand-gold w-4' : 'bg-white/30'}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setTeamIndex(i => Math.min(teams.length - 1, i + 1))}
                    disabled={teamIndex === teams.length - 1}
                    className="rounded p-1 text-white/60 hover:text-white disabled:opacity-30 transition">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="p-6">
                {/* Bandera + nombre */}
                <div className="flex items-center gap-5 mb-6">
                  <div className="h-20 w-28 overflow-hidden rounded-xl shadow-md bg-gray-100 shrink-0">
                    <img
                      src={`https://flagcdn.com/w160/${flagCode(currentTeam.country_code)}.png`}
                      alt={currentTeam.name}
                      className="h-full w-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = '/globe.png' }}
                    />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-brand-navy leading-tight">{currentTeam.name}</p>
                    {teams.length > 1 && (
                      <p className="text-sm text-brand-slate mt-0.5">
                        Equipo {teamIndex + 1} de {teams.length}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats del equipo — con etiquetas claras */}
                <div className="grid grid-cols-2 gap-3">
                  <StatBox
                    icon="📊"
                    label="Ranking FIFA"
                    value={`#${currentTeam.fifa_rank}`}
                    desc="Ranking oficial FIFA al momento del sorteo"
                  />
                  <StatBox
                    icon="🎰"
                    label="Bombo del sorteo"
                    value={`Bombo ${currentTeam.pot}`}
                    desc={
                      currentTeam.pot === 1
                        ? 'Top FIFA + anfitriones'
                        : currentTeam.pot === 2
                        ? 'Equipos de alto nivel'
                        : currentTeam.pot === 3
                        ? 'Equipos de nivel medio'
                        : 'Repechajes y equipos bajos en ranking'
                    }
                  />
                  <StatBox
                    icon="🌟"
                    label="Mejor Mundial"
                    value={currentTeam.best_world_cup}
                    desc="Mejor resultado histórico en algún Mundial FIFA"
                  />
                  <StatBox
                    icon="🏟️"
                    label="Qatar 2022"
                    value={currentTeam.world_cup_2022}
                    desc="Resultado en el último Mundial"
                  />
                </div>

                {/* Navegación rápida por teclado / botones grandes */}
                {teams.length > 1 && (
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => setTeamIndex(i => Math.max(0, i - 1))}
                      disabled={teamIndex === 0}
                      className="btn-secondary flex-1 justify-center disabled:opacity-30">
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </button>
                    <button
                      onClick={() => setTeamIndex(i => Math.min(teams.length - 1, i + 1))}
                      disabled={teamIndex === teams.length - 1}
                      className="btn-primary flex-1 justify-center disabled:opacity-30">
                      Siguiente <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dueño */}
          <div className="rounded-xl border-2 border-dashed border-brand-gold/40 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-slate mb-1">Dueño del lote</p>
            {lot.status === 'sold'
              ? <p className="text-xl font-bold text-green-700">✓ {lot.ownerships?.map(o => (o.participant as any)?.name ?? '—').join(', ') || '—'}</p>
              : <p className="text-base italic text-gray-400">Sin asignar — pendiente de subasta</p>
            }
          </div>
        </main>

        {/* ── PANEL DERECHO: Bids ──────────────────────────────────────────── */}
        <aside className="w-80 flex flex-col border-l border-gray-200 bg-white overflow-y-auto shrink-0">
          <div className="flex-1 p-5 space-y-5">

            {/* Bid actual */}
            <div className="rounded-xl bg-brand-navy p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1">Bid actual</p>
              <p className="text-4xl font-black text-brand-gold leading-none">
                {lot.current_bid === 0 ? '—' : fmt(lot.current_bid)}
              </p>
              {leaderName && <p className="mt-2 text-sm font-semibold text-white/80">{leaderName}</p>}
              <p className="mt-2 text-xs text-white/30">
                Siguiente mínimo: {fmt(lot.current_bid + minIncrement)}
              </p>
            </div>

            {/* Registrar bid */}
            {lot.status !== 'sold' && lot.status !== 'cancelled' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">
                    Participante
                  </label>
                  <select value={selectedParticipant} onChange={e => setSelectedParticipant(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-gold focus:outline-none">
                    <option value="">Seleccionar...</option>
                    {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">
                    Monto del bid
                  </label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setBidAmount(v => Math.max(lot.current_bid + minIncrement, v - minIncrement))}
                      className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50">
                      <Minus className="h-4 w-4" />
                    </button>
                    <input type="number" value={bidAmount}
                      onChange={e => setBidAmount(Number(e.target.value))}
                      min={lot.current_bid + minIncrement} step={minIncrement}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-center text-lg font-bold focus:border-brand-gold focus:outline-none" />
                    <button onClick={() => setBidAmount(v => v + minIncrement)}
                      className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Accesos rápidos */}
                  <div className="mt-2 flex gap-1.5 flex-wrap">
                    {[1, 2, 3, 5].map(mult => {
                      const q = lot.current_bid + minIncrement * mult
                      return (
                        <button key={mult} onClick={() => setBidAmount(q)}
                          className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-brand-gold hover:text-white transition">
                          {fmt(q)}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <button onClick={handleBid} disabled={loading || !selectedParticipant}
                  className="btn-primary w-full justify-center py-3 text-base">
                  <Gavel className="h-5 w-5" /> Registrar Bid
                </button>
              </div>
            )}

            {/* Acciones del lote */}
            <div className="space-y-2">
              {lot.status !== 'sold' && (
                <button onClick={handleSell} disabled={loading || lot.current_bid === 0}
                  className="btn-gold w-full justify-center py-2.5">
                  <CheckCircle className="h-4 w-4" />
                  ¡Vendido! {lot.current_bid > 0 ? fmt(lot.current_bid) : ''}
                </button>
              )}
              {lot.status === 'active' && (
                <button onClick={() => handleStatus('paused')} className="btn-secondary w-full justify-center">
                  <PauseCircle className="h-4 w-4" /> Pausar subasta
                </button>
              )}
              {lot.status === 'paused' && (
                <button onClick={() => handleStatus('pending')} className="btn-secondary w-full justify-center">
                  Reactivar subasta
                </button>
              )}
            </div>

            {/* Historial de bids */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                Historial de bids ({lot.bids?.length ?? 0})
              </h3>
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {(lot.bids ?? []).length === 0
                  ? <p className="text-xs text-gray-400 italic py-2">Sin bids registrados</p>
                  : (lot.bids ?? []).map((bid, i) => (
                    <div key={bid.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${i === 0 ? 'bg-brand-gold/10 font-semibold' : 'bg-gray-50'}`}>
                      <span className="text-gray-600">{(bid as any)?.participant?.name ?? '—'}</span>
                      <span className={i === 0 ? 'text-brand-gold-dark font-bold' : 'text-gray-700'}>
                        {fmt(bid.amount)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Siguiente lote */}
          {nextLot && (
            <div className="border-t border-gray-100 p-4 shrink-0">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Siguiente lote</p>
              <button onClick={() => router.push(`/auction/live/${nextLot.id}`)}
                className="w-full rounded-lg bg-brand-bg p-3 text-left hover:bg-gray-100 transition">
                <p className="text-xs text-gray-400 font-mono">Lote {nextLot.number}</p>
                <p className="text-sm font-semibold text-brand-navy truncate">{nextLot.title}</p>
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

/* ── Sub-componentes ──────────────────────────────────────────────────────── */

function LotStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = { pending: 'badge-pending', active: 'badge-active', sold: 'badge-sold', paused: 'badge-paused', cancelled: 'badge-cancelled' }
  const lbl: Record<string, string> = { pending: 'Pendiente', active: 'En subasta', sold: '✓ Vendido', paused: 'Pausado', cancelled: 'Cancelado' }
  return <span className={cls[status] ?? 'badge-pending'}>{lbl[status] ?? status}</span>
}

function StatBox({ icon, label, value, desc }: { icon: string; label: string; value: string; desc: string }) {
  return (
    <div className="rounded-xl bg-brand-bg p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg leading-none">{icon}</span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      </div>
      <p className="text-lg font-black text-brand-navy leading-tight">{value}</p>
      <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">{desc}</p>
    </div>
  )
}
