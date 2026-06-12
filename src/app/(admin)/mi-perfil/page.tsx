'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseProbs, getLotDisplayProbs, flagCode } from '@/lib/lot-utils'
import { formatCurrency } from '@/lib/calculations'

export default function MiPerfilPage() {
  const supabase = createClient()
  const [participants, setParticipants] = useState<any[]>([])
  const [lots, setLots] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('participants').select('*').order('name'),
      supabase.from('lots').select('*, teams:lot_teams(team:teams(*)), ownerships:lot_ownerships(participant_id, lot_id, ownership_percentage, participant:participants(name))').order('number'),
      supabase.from('payments').select('*').order('created_at', { ascending: false }),
      supabase.from('calcuta_settings').select('*').single(),
    ]).then(([{ data: ps }, { data: ls }, { data: pays }, { data: cfg }]) => {
      setParticipants(ps ?? [])
      setLots((ls ?? []).map((l: any) => ({ ...l, teams: l.teams?.map((lt: any) => lt.team).filter(Boolean) ?? [] })))
      setPayments(pays ?? [])
      setSettings(cfg)
    })
  }, [])

  const fmt = (n: number) => formatCurrency(n, settings?.currency ?? 'MXN')

  const me = participants.find(p => p.id === selectedId)
  const myLots = lots.filter(l => l.status === 'sold' && l.ownerships?.some((o: any) => o.participant_id === selectedId))
  const myBids = myLots.reduce((s: number, l: any) => s + (l.final_price ?? 0), 0)
  const totalDue = me ? Math.max(me.buy_in_amount, myBids) : 0
  const balance = me ? totalDue - me.amount_paid : 0
  const myPayments = payments.filter(p => p.participant_id === selectedId)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-blue">Mi Perfil</h1>
        <p className="text-sm text-brand-slate">Selecciona tu nombre para ver tu estado</p>
      </div>

      {/* Selector de participante */}
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">
          ¿Quién eres?
        </label>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base focus:border-brand-gold focus:outline-none">
          <option value="">Selecciona tu nombre...</option>
          {participants.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {me && (
        <>
          {/* Resumen financiero */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="card text-center">
              <p className="text-xl font-black text-brand-navy">{fmt(totalDue)}</p>
              <p className="text-[10px] text-gray-400 uppercase mt-0.5">Total a pagar</p>
            </div>
            <div className="card text-center">
              <p className={`text-xl font-black ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {balance > 0 ? fmt(balance) : '✓ Pagado'}
              </p>
              <p className="text-[10px] text-gray-400 uppercase mt-0.5">Saldo</p>
            </div>
            <div className="card text-center col-span-2 sm:col-span-1">
              <p className="text-xl font-black text-brand-navy">{myLots.length}</p>
              <p className="text-[10px] text-gray-400 uppercase mt-0.5">Lotes comprados</p>
            </div>
          </div>

          {/* Recordatorio de pago */}
          {balance > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
              <span className="text-xl shrink-0">💰</span>
              <div>
                <p className="text-sm font-bold text-amber-800">Saldo pendiente: {fmt(balance)}</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Te recordamos liquidar tu saldo con el moderador. ¡No dejes que te persiga después del partido!
                </p>
              </div>
            </div>
          )}

          {/* Mis lotes */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-slate mb-3">
              Mis lotes ({myLots.length})
            </h2>
            {myLots.length === 0 ? (
              <div className="card text-center py-6 text-sm text-gray-400">
                No compraste ningún lote. ¡El buy-in se perdió! 😬
              </div>
            ) : (
              <div className="space-y-3">
                {myLots.map((lot: any) => {
                  const d = getLotDisplayProbs(lot.number, parseProbs(lot.notes))
                  const myOwnership = lot.ownerships?.find((o: any) => o.participant_id === selectedId)
                  return (
                    <div key={lot.id} className="card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-bold text-brand-navy">{lot.title}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {lot.teams?.map((t: any) => (
                              <div key={t.id} className="flex items-center gap-1 rounded-md bg-brand-bg px-2 py-1">
                                <img src={`https://flagcdn.com/w40/${flagCode(t.country_code)}.png`}
                                  className="h-3 w-4 rounded object-cover" alt={t.name}
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                <span className="text-[10px] font-medium text-brand-navy">{t.name}</span>
                                <span className="text-[9px] text-gray-400">#{t.fifa_rank}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className="font-bold text-green-700">{fmt(lot.final_price ?? 0)}</span>
                            {myOwnership && myOwnership.ownership_percentage < 100 && (
                              <span className="text-gray-400">Tu parte: {myOwnership.ownership_percentage}%</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-black ${d.show === 'champion' ? 'text-brand-gold-dark' : 'text-blue-600'}`}>
                            {d.value.toFixed(1)}%
                          </p>
                          <p className="text-[9px] text-gray-400">{d.label}</p>
                        </div>
                      </div>
                      {/* Stats del mejor equipo */}
                      {lot.teams?.[0] && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg bg-brand-bg px-3 py-2">
                            <p className="text-[9px] text-gray-400">Mejor Mundial</p>
                            <p className="font-semibold text-brand-navy">{lot.teams[0].best_world_cup}</p>
                          </div>
                          <div className="rounded-lg bg-brand-bg px-3 py-2">
                            <p className="text-[9px] text-gray-400">Qatar 2022</p>
                            <p className="font-semibold text-brand-navy">{lot.teams[0].world_cup_2022}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Historial de pagos */}
          {myPayments.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-slate mb-3">
                Mis pagos
              </h2>
              <div className="space-y-2">
                {myPayments.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl bg-green-50 border border-green-100 px-4 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-green-800 capitalize">{p.method ?? 'Efectivo'}</p>
                      <p className="text-[10px] text-gray-400">{p.date}</p>
                    </div>
                    <p className="text-sm font-black text-green-700">{fmt(p.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
