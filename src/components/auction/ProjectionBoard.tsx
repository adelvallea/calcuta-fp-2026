'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseProbs, getLotDisplayProbs, flagCode } from '@/lib/lot-utils'
import { formatCurrency } from '@/lib/calculations'
import type { Lot, Team, Bid } from '@/types'
import AuctionTimer from './AuctionTimer'
import { playSoldSound, playBidSound } from '@/lib/sounds'

interface Props {
  initialLot: Lot & { teams: Team[]; bids: Bid[] }
  settings: any
}

export default function ProjectionBoard({ initialLot, settings }: Props) {
  const supabase = createClient()
  const [lot, setLot] = useState(initialLot)
  const [teamIdx, setTeamIdx] = useState(0)
  const [soldAnim, setSoldAnim] = useState(false)
  const [prevBidCount, setPrevBidCount] = useState(initialLot.bids?.length ?? 0)

  const currency = settings?.currency ?? 'MXN'
  const fmt = useCallback((n: number) => formatCurrency(n, currency), [currency])
  const probs = parseProbs(lot.notes)
  const display = getLotDisplayProbs(lot.number, probs)
  const teams = lot.teams ?? []
  const leader = lot.bids?.[0]
  const leaderName = (leader as any)?.participant?.name ?? ''

  useEffect(() => {
    const ch = supabase.channel(`proj-${lot.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots', filter: `id=eq.${lot.id}` },
        (p) => {
          const newLot = p.new as any
          if (newLot.status === 'sold' && lot.status !== 'sold') {
            playSoldSound(); setSoldAnim(true); setTimeout(() => setSoldAnim(false), 3000)
          }
          setLot(prev => ({ ...prev, ...newLot }))
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `lot_id=eq.${lot.id}` },
        async () => {
          playBidSound()
          const { data } = await supabase.from('bids')
            .select('*, participant:participants(name)')
            .eq('lot_id', lot.id).order('created_at', { ascending: false })
          if (data) setLot(prev => ({ ...prev, bids: data as Bid[] }))
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [lot.id])

  // Auto-rotar equipos cada 5s en combos
  useEffect(() => {
    if (teams.length <= 1) return
    const t = setInterval(() => setTeamIdx(i => (i + 1) % teams.length), 5000)
    return () => clearInterval(t)
  }, [teams.length])

  const currentTeam = teams[teamIdx]

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-1000 ${
      soldAnim ? 'bg-green-900' : 'bg-brand-navy'
    }`}>

      {/* ── TOP BAR ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="FP" className="h-10 w-10"
            onError={e => { (e.target as HTMLImageElement).src = '/logo.svg' }} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold">Calcuta FP · Mundial 2026</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold text-white">
            Lote {lot.number} · {lot.type === 'combo' ? `Combo ${teams.length} equipos` : 'Solo'}
          </span>
          {lot.status === 'sold' && (
            <span className="rounded-full bg-green-500 px-4 py-1.5 text-sm font-bold text-white animate-pulse">
              ✓ VENDIDO
            </span>
          )}
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Equipo actual — izquierda */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 border-r border-white/10">
          {currentTeam ? (
            <>
              {/* Bandera grande */}
              <div className="h-40 w-64 overflow-hidden rounded-2xl shadow-2xl mb-6 bg-white/10">
                <img
                  src={`https://flagcdn.com/w320/${flagCode(currentTeam.country_code)}.png`}
                  alt={currentTeam.name}
                  className="h-full w-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>

              {/* Nombre del equipo */}
              <h1 className="text-6xl font-black text-white text-center leading-tight mb-4">
                {currentTeam.name}
              </h1>

              {/* Stats */}
              <div className="flex gap-6 text-center mb-6">
                <div>
                  <p className="text-3xl font-black text-brand-gold">#{currentTeam.fifa_rank}</p>
                  <p className="text-xs text-white/40 uppercase tracking-wide mt-1">Ranking FIFA</p>
                </div>
                <div className="w-px bg-white/10" />
                <div>
                  <p className="text-3xl font-black text-white">B{currentTeam.pot}</p>
                  <p className="text-xs text-white/40 uppercase tracking-wide mt-1">Bombo</p>
                </div>
                <div className="w-px bg-white/10" />
                <div>
                  <p className="text-xl font-black text-white leading-tight">{currentTeam.best_world_cup}</p>
                  <p className="text-xs text-white/40 uppercase tracking-wide mt-1">Mejor Mundial</p>
                </div>
              </div>

              {/* Qatar 2022 */}
              <div className="rounded-xl bg-white/5 px-6 py-3 text-center">
                <p className="text-xs text-white/40 uppercase tracking-wide">Qatar 2022</p>
                <p className="text-lg font-bold text-white mt-0.5">{currentTeam.world_cup_2022}</p>
              </div>

              {/* Navegación de equipos en combo */}
              {teams.length > 1 && (
                <div className="flex items-center gap-4 mt-6">
                  <button onClick={() => setTeamIdx(i => (i - 1 + teams.length) % teams.length)}
                    className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">←</button>
                  <div className="flex gap-2">
                    {teams.map((_, i) => (
                      <button key={i} onClick={() => setTeamIdx(i)}
                        className={`h-2 rounded-full transition-all ${i === teamIdx ? 'w-6 bg-brand-gold' : 'w-2 bg-white/30'}`} />
                    ))}
                  </div>
                  <button onClick={() => setTeamIdx(i => (i + 1) % teams.length)}
                    className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">→</button>
                </div>
              )}
            </>
          ) : (
            <p className="text-white/30 text-xl">Sin equipos asignados</p>
          )}
        </div>

        {/* Panel derecho — bid + prob + timer */}
        <div className="w-96 flex flex-col justify-between p-8">

          {/* Probabilidad */}
          <div className="rounded-2xl bg-white/5 p-6 text-center mb-6">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-2">{display.label}</p>
            <p className="text-6xl font-black text-brand-gold">{display.value.toFixed(1)}%</p>
            <p className="text-xs text-white/30 mt-2">{display.prize}</p>
          </div>

          {/* Bid actual */}
          <div className="rounded-2xl bg-white/10 p-6 text-center mb-6 flex-1 flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Bid actual</p>
            <p className={`font-black text-brand-gold leading-none transition-all ${
              lot.current_bid >= 10000 ? 'text-5xl' : 'text-6xl'
            }`}>
              {lot.current_bid === 0 ? '—' : fmt(lot.current_bid)}
            </p>
            {leaderName && (
              <p className="text-xl font-bold text-white mt-4">{leaderName}</p>
            )}
            {lot.current_bid > 0 && (
              <p className="text-xs text-white/30 mt-3">
                Siguiente mínimo: {fmt(lot.current_bid + (settings?.min_bid_increment ?? 200))}
              </p>
            )}
          </div>

          {/* Timer */}
          <AuctionTimer lotId={lot.id} isAdmin={false} />

          {/* Historial reciente */}
          {(lot.bids?.length ?? 0) > 0 && (
            <div className="mt-6 space-y-1.5 max-h-40 overflow-hidden">
              <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Últimos bids</p>
              {(lot.bids ?? []).slice(0, 4).map((bid, i) => (
                <div key={bid.id} className={`flex justify-between text-sm rounded-xl px-3 py-2 ${
                  i === 0 ? 'bg-brand-gold/20 font-bold' : 'bg-white/5'
                }`}>
                  <span className="text-white/70">{(bid as any)?.participant?.name ?? '—'}</span>
                  <span className={i === 0 ? 'text-brand-gold font-black' : 'text-white/50'}>{fmt(bid.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM BAR ───────────────────────────────────────────────── */}
      {soldAnim && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center animate-fade-in">
            <p className="text-9xl font-black text-white drop-shadow-2xl">🔨</p>
            <p className="text-5xl font-black text-green-300 mt-4">¡VENDIDO!</p>
            <p className="text-3xl font-bold text-white/80 mt-2">{fmt(lot.final_price ?? lot.current_bid)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
