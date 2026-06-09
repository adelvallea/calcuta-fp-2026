'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseProbs, getLotDisplayProbs, flagCode } from '@/lib/lot-utils'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Gavel, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'

interface Team { id: string; name: string; country_code: string; fifa_rank: number; pot: number; best_world_cup: string; world_cup_2022: string }
interface Lot {
  id: string; number: number; title: string; type: string; status: string
  current_bid: number; final_price?: number; notes?: string
  teams: Team[]
  ownerships: Array<{ ownership_percentage: number; participant: { name: string } }>
}

const STATUS_LABEL: Record<string, string> = { pending: 'Pendiente', active: 'En subasta', sold: 'Vendido', paused: 'Pausado', cancelled: 'Cancelado' }
const STATUS_CLASS: Record<string, string> = { pending: 'badge-pending', active: 'badge-active', sold: 'badge-sold', paused: 'badge-paused', cancelled: 'badge-cancelled' }

export default function LotsPage() {
  const supabase = createClient()
  const [lots, setLots] = useState<Lot[]>([])
  const [fmt, setFmt] = useState<(n: number) => string>(() => (n: number) => `$${n.toLocaleString('es-MX')}`)
  const [reorderMode, setReorderMode] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data: lotsRaw }, { data: settings }] = await Promise.all([
      supabase.from('lots')
        .select('*, teams:lot_teams(team:teams(*)), ownerships:lot_ownerships(ownership_percentage, participant:participants(name))')
        .order('number'),
      supabase.from('calcuta_settings').select('*').single(),
    ])
    const normalized = (lotsRaw ?? []).map((l: any) => ({
      ...l,
      teams: l.teams?.map((lt: any) => lt.team).filter(Boolean) ?? [],
    })) as Lot[]
    setLots(normalized)
    if (settings) {
      const cur = settings.currency ?? 'MXN'
      setFmt(() => (n: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(n)
      )
    }
  }

  useEffect(() => { load() }, [])

  function move(idx: number, dir: -1 | 1) {
    const next = [...lots]
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= next.length) return
    // Swap numbers
    const tmpNum = next[idx].number
    next[idx].number = next[swapIdx].number
    next[swapIdx].number = tmpNum
    // Swap positions
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    setLots(next)
  }

  async function saveOrder() {
    setSaving(true)
    try {
      const items = lots.map((l, i) => ({ id: l.id, number: i + 1 }))
      const res = await fetch('/api/lots/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      })
      if (res.ok) {
        toast.success('Orden guardado')
        setReorderMode(false)
        // Re-asignar números secuenciales
        setLots((prev) => prev.map((l, i) => ({ ...l, number: i + 1 })))
      } else toast.error('Error al guardar orden')
    } finally { setSaving(false) }
  }

  const totalSold = lots.filter(l => l.status === 'sold').reduce((s, l) => s + (l.final_price ?? 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue">Lotes</h1>
          <p className="text-sm text-brand-slate">
            {lots.length} lotes · {lots.filter(l => l.status === 'sold').length} vendidos · Recaudado: {fmt(totalSold)}
          </p>
        </div>
        <div className="flex gap-2">
          {reorderMode ? (
            <>
              <button onClick={saveOrder} disabled={saving} className="btn-gold">{saving ? 'Guardando...' : 'Guardar orden'}</button>
              <button onClick={() => { setReorderMode(false); load() }} className="btn-secondary">Cancelar</button>
            </>
          ) : (
            <button onClick={() => setReorderMode(true)} className="btn-secondary">
              <GripVertical className="h-4 w-4" /> Reordenar
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lots.map((lot, idx) => {
          const probs = parseProbs(lot.notes)
          const display = getLotDisplayProbs(lot.number, probs)
          const owners = lot.ownerships ?? []
          const isCombo = lot.type === 'combo'

          return (
            <div key={lot.id} className="card hover:shadow-md transition-shadow relative">
              {/* Reorder controls */}
              {reorderMode && (
                <div className="absolute top-2 right-2 flex flex-col gap-0.5">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0}
                    className="rounded bg-gray-100 p-0.5 hover:bg-gray-200 disabled:opacity-30">
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button onClick={() => move(idx, 1)} disabled={idx === lots.length - 1}
                    className="rounded bg-gray-100 p-0.5 hover:bg-gray-200 disabled:opacity-30">
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono font-bold text-brand-gold">#{lot.number}</span>
                    <span className={STATUS_CLASS[lot.status] ?? 'badge-pending'}>{STATUS_LABEL[lot.status]}</span>
                    <span className="text-[10px] uppercase text-gray-400 font-medium">{lot.type}</span>
                  </div>
                  <h3 className="text-sm font-bold text-brand-navy leading-tight pr-6">{lot.title}</h3>
                </div>
                {lot.status !== 'sold' && !reorderMode && (
                  <Link href={`/auction/live/${lot.id}`}
                    className="rounded-lg bg-brand-navy p-1.5 hover:bg-brand-navy-mid transition shrink-0">
                    <Gavel className="h-4 w-4 text-brand-gold" />
                  </Link>
                )}
              </div>

              {/* Probabilidad relevante */}
              <div className="flex gap-2 mb-3">
                <div className={`flex-1 rounded-lg px-2 py-1.5 text-center ${
                  display.show === 'champion' ? 'bg-amber-50' :
                  display.show === 'pos32' ? 'bg-blue-50' : 'bg-red-50'
                }`}>
                  <p className="text-[10px] text-gray-500">
                    {display.show === 'champion' ? '🏆 Campeón' : display.show === 'pos32' ? '⚖️ Lugar 32' : '🔴 Último'}
                  </p>
                  <p className={`text-sm font-bold ${
                    display.show === 'champion' ? 'text-brand-gold-dark' :
                    display.show === 'pos32' ? 'text-blue-700' : 'text-red-600'
                  }`}>{display.value.toFixed(1)}%</p>
                </div>
              </div>

              {/* Equipos */}
              <div className="flex flex-wrap gap-1 mb-3">
                {lot.teams.map((t) => (
                  <div key={t.id} className="flex items-center gap-1 rounded-md bg-brand-bg px-2 py-1">
                    <img src={`https://flagcdn.com/w40/${flagCode(t.country_code)}.png`} alt={t.name}
                      className="h-3 w-4 rounded object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <span className="text-[10px] font-medium text-brand-navy-mid">{t.name}</span>
                    <span className="text-[10px] text-gray-400">#{t.fifa_rank}</span>
                  </div>
                ))}
              </div>

              {/* WC history para combos */}
              {isCombo && lot.teams.length > 0 && (
                <div className="mb-3 space-y-1">
                  {lot.teams.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-[10px] text-gray-500">
                      <img src={`https://flagcdn.com/w40/${flagCode(t.country_code)}.png`} alt=""
                        className="h-3 w-4 rounded object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      <span className="font-medium text-gray-600 w-20 truncate">{t.name}:</span>
                      <span className="truncate">{t.best_world_cup}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500">{t.world_cup_2022}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Precio / Dueño */}
              {lot.status === 'sold' ? (
                <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
                  <span className="text-xs text-gray-500">
                    {owners.map((o) => `${o.participant?.name} (${o.ownership_percentage}%)`).join(', ')}
                  </span>
                  <span className="text-sm font-bold text-green-700">{fmt(lot.final_price ?? 0)}</span>
                </div>
              ) : lot.current_bid > 0 ? (
                <div className="rounded-lg bg-blue-50 px-3 py-2">
                  <p className="text-xs text-blue-600">Bid actual: <strong>{fmt(lot.current_bid)}</strong></p>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
