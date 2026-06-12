'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/calculations'
import { flagCode } from '@/lib/lot-utils'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import toast from 'react-hot-toast'
import { ShoppingCart, CheckCircle, XCircle, Clock, Plus, ArrowRight } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  pending_seller: '⏳ Esperando al vendedor',
  pending_buyer:  '⏳ Esperando al comprador',
  pending_mod:    '⏳ Esperando al moderador',
  approved:       '✅ Aprobada y ejecutada',
  rejected:       '❌ Rechazada',
}
const STATUS_COLOR: Record<string, string> = {
  pending_seller: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  pending_buyer:  'bg-blue-50 border-blue-200 text-blue-800',
  pending_mod:    'bg-purple-50 border-purple-200 text-purple-800',
  approved:       'bg-green-50 border-green-200 text-green-800',
  rejected:       'bg-red-50 border-red-200 text-red-800',
}

export default function MercadoPage() {
  const supabase = createClient()
  const isAdmin = useIsAdmin()
  const [offers, setOffers] = useState<any[]>([])
  const [lots, setLots] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ lot_id: '', seller_id: '', buyer_id: '', percentage: 50, price: 0, notes: '' })
  const [loading, setLoading] = useState(false)
  const [tableExists, setTableExists] = useState(true)

  const fmt = (n: number) => formatCurrency(n, settings?.currency ?? 'MXN')

  async function load() {
    const [{ data: ps }, { data: ls }, { data: cfg }] = await Promise.all([
      supabase.from('participants').select('id, name').order('name'),
      supabase.from('lots').select('id, number, title, status, final_price, ownerships:lot_ownerships(participant_id, ownership_percentage, participant:participants(name)), teams:lot_teams(team:teams(name, country_code, fifa_rank))').eq('status', 'sold').order('number'),
      supabase.from('calcuta_settings').select('*').single(),
    ])
    setParticipants(ps ?? [])
    setLots((ls ?? []).map((l: any) => ({ ...l, teams: l.teams?.map((lt: any) => lt.team).filter(Boolean) ?? [] })))
    setSettings(cfg)

    // Cargar ofertas
    const res = await fetch('/api/market')
    if (res.ok) {
      setOffers(await res.json())
    } else if (res.status === 500) {
      setTableExists(false) // tabla no existe aún
    }
  }

  useEffect(() => { load() }, [])

  // Realtime
  useEffect(() => {
    if (!tableExists) return
    const ch = supabase.channel('market-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_offers' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tableExists])

  async function createOffer() {
    if (!form.lot_id || !form.seller_id || !form.buyer_id || !form.price) return toast.error('Completa todos los campos')
    if (form.seller_id === form.buyer_id) return toast.error('Vendedor y comprador deben ser distintos')
    setLoading(true)
    try {
      const res = await fetch('/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (res.ok) {
        toast.success('Oferta creada — esperando aprobación del vendedor')
        setShowForm(false)
        setForm({ lot_id: '', seller_id: '', buyer_id: '', percentage: 50, price: 0, notes: '' })
        load()
      } else toast.error(d.error ?? 'Error')
    } finally { setLoading(false) }
  }

  async function handleAction(offerId: string, action: string, actor: string) {
    const res = await fetch(`/api/market/${offerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, actor }),
    })
    const d = await res.json()
    if (res.ok) {
      const msgs: Record<string, string> = {
        seller_approve: '✅ Aprobado por vendedor',
        buyer_approve:  '✅ Aprobado por comprador',
        mod_approve:    '✅ Transferencia ejecutada',
        reject:         '❌ Oferta rechazada',
      }
      toast.success(msgs[action] ?? 'Actualizado')
      load()
    } else toast.error(d.error ?? 'Error')
  }

  if (!tableExists) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-brand-blue mb-2">Mercado Secundario</h1>

        {/* Mensaje friendly para participantes */}
        <div className="card text-center py-12 mb-4">
          <p className="text-5xl mb-4">🛒</p>
          <p className="text-lg font-black text-brand-navy mb-2">¡Espéralo pronto!</p>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            El Mercado Secundario estará disponible en breve. Podrás proponer comprar
            una porción del lote de otro participante directamente desde aquí.
          </p>
          <div className="mt-6 rounded-xl bg-brand-bg border border-gray-100 px-4 py-3 text-xs text-gray-500 max-w-sm mx-auto text-left space-y-1">
            <p>⚡ Proponer ofertas en tiempo real</p>
            <p>✅ Aprobación de vendedor + comprador</p>
            <p>🔐 Ejecución supervisada por el moderador</p>
            <p>📋 Feed completo de todas las transacciones</p>
          </div>
        </div>

        {/* SQL para activar — solo visible si es admin */}
        {isAdmin && (
        <div className="card bg-amber-50 border-amber-200">
          <p className="font-bold text-amber-800 mb-2">⚠️ Moderador: activa el Mercado Secundario</p>
          <p className="text-sm text-amber-700 mb-4">
            Ejecuta este SQL en <strong>Supabase → SQL Editor</strong>:
          </p>
          <pre className="bg-brand-navy text-green-400 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap">{`create table if not exists market_offers (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references lots(id),
  seller_id uuid not null references participants(id),
  buyer_id uuid not null references participants(id),
  percentage numeric(5,2) not null,
  price numeric(10,2) not null,
  status text not null default 'pending_seller',
  seller_approved boolean,
  buyer_approved boolean,
  mod_approved boolean,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table market_offers enable row level security;
create policy allow_all on market_offers
  for all using (true) with check (true);`}</pre>
          <button onClick={load} className="btn-primary mt-4">Reintentar</button>
        </div>
        )}
      </div>
    )
  }

  const soldLots = lots.filter(l => l.status === 'sold')

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue">Mercado Secundario</h1>
          <p className="text-sm text-brand-slate">Propón comprar una porción del lote de otro participante</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary">
          <Plus className="h-4 w-4" /> Nueva oferta
        </button>
      </div>

      {/* Formulario nueva oferta */}
      {showForm && (
        <div className="card border-brand-gold/30 space-y-4">
          <h2 className="font-bold text-brand-navy">Proponer compra de porción</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Lote a comprar</label>
              <select value={form.lot_id} onChange={e => {
                const lot = soldLots.find(l => l.id === e.target.value)
                const owner = lot?.ownerships?.[0]
                setForm({ ...form, lot_id: e.target.value, seller_id: owner?.participant_id ?? '' })
              }} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-gold focus:outline-none">
                <option value="">Seleccionar lote vendido...</option>
                {soldLots.map(l => {
                  const owners = l.ownerships?.map((o: any) => o.participant?.name).filter(Boolean).join(', ')
                  return <option key={l.id} value={l.id}>Lote {l.number} — {l.title} ({owners})</option>
                })}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Vendedor (dueño actual)</label>
              <select value={form.seller_id} onChange={e => setForm({ ...form, seller_id: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-gold focus:outline-none">
                <option value="">Seleccionar...</option>
                {form.lot_id && lots.find(l => l.id === form.lot_id)?.ownerships?.map((o: any) => (
                  <option key={o.participant_id} value={o.participant_id}>
                    {o.participant?.name} ({o.ownership_percentage}%)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Comprador (yo / tu nombre)</label>
              <select value={form.buyer_id} onChange={e => setForm({ ...form, buyer_id: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-gold focus:outline-none">
                <option value="">Seleccionar...</option>
                {participants.filter(p => p.id !== form.seller_id).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">% a comprar</label>
              <input type="number" min={1} max={100} value={form.percentage}
                onChange={e => setForm({ ...form, percentage: Number(e.target.value) })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-gold focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Precio ofrecido ($)</label>
              <input type="number" min={0} value={form.price}
                onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-gold focus:outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Notas (opcional)</label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Justificación, condiciones, etc."
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-gold focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={createOffer} disabled={loading} className="btn-primary">
              {loading ? 'Enviando...' : 'Proponer oferta'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {/* Explicación del flujo */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
        <p className="font-bold mb-1">📋 Flujo de aprobación</p>
        <div className="flex items-center gap-2 flex-wrap">
          {['Comprador propone', 'Vendedor aprueba', 'Comprador confirma', 'Moderador ejecuta'].map((step, i) => (
            <div key={step} className="flex items-center gap-1">
              <span className="bg-blue-100 rounded px-2 py-0.5 font-medium">{step}</span>
              {i < 3 && <ArrowRight className="h-3 w-3 text-blue-400" />}
            </div>
          ))}
        </div>
      </div>

      {/* Feed de ofertas */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-brand-slate">
          Feed — {offers.length} oferta{offers.length !== 1 ? 's' : ''}
        </h2>

        {offers.length === 0 && (
          <div className="card text-center py-8">
            <ShoppingCart className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Sin ofertas aún. ¡Sé el primero!</p>
          </div>
        )}

        {offers.map((offer: any) => {
          const lot = offer.lot
          const teams = lot?.teams?.map((lt: any) => lt.team).filter(Boolean) ?? []

          return (
            <div key={offer.id} className={`rounded-xl border ${STATUS_COLOR[offer.status] ?? 'bg-gray-50 border-gray-200'} p-4`}>
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">
                      {offer.buyer?.name ?? '—'}
                    </span>
                    <ArrowRight className="h-3 w-3" />
                    <span className="text-sm">
                      {offer.percentage}% de Lote {lot?.number} ({lot?.title})
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 opacity-70">
                    Precio: <strong>{fmt(offer.price)}</strong> · Vendedor: {offer.seller?.name ?? '—'}
                  </p>
                  {offer.notes && <p className="text-xs mt-1 italic opacity-60">"{offer.notes}"</p>}
                </div>
                <span className="text-[10px] font-semibold shrink-0">
                  {STATUS_LABEL[offer.status]}
                </span>
              </div>

              {/* Equipos del lote */}
              {teams.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {teams.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-1 rounded bg-white/60 px-2 py-0.5">
                      <img src={`https://flagcdn.com/w40/${flagCode(t.country_code)}.png`}
                        className="h-3 w-4 rounded object-cover" alt={t.name}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      <span className="text-[10px] font-medium">{t.name} #{t.fifa_rank}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Botones de acción según estado */}
              {offer.status !== 'approved' && offer.status !== 'rejected' && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {/* Vendedor puede aprobar/rechazar cuando es pending_seller */}
                  {offer.status === 'pending_seller' && (
                    <>
                      <p className="text-xs w-full text-gray-600 mb-1">
                        <strong>{offer.seller?.name}</strong>: ¿aceptas vender el {offer.percentage}% por {fmt(offer.price)}?
                      </p>
                      <button onClick={() => handleAction(offer.id, 'seller_approve', offer.seller_id)}
                        className="flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-200">
                        <CheckCircle className="h-3.5 w-3.5" /> Acepto vender
                      </button>
                      <button onClick={() => handleAction(offer.id, 'reject', offer.seller_id)}
                        className="flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200">
                        <XCircle className="h-3.5 w-3.5" /> Rechazar
                      </button>
                    </>
                  )}

                  {/* Comprador confirma cuando es pending_buyer */}
                  {offer.status === 'pending_buyer' && (
                    <>
                      <p className="text-xs w-full text-gray-600 mb-1">
                        <strong>{offer.buyer?.name}</strong>: ¿confirmas comprar el {offer.percentage}% por {fmt(offer.price)}?
                      </p>
                      <button onClick={() => handleAction(offer.id, 'buyer_approve', offer.buyer_id)}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-200">
                        <CheckCircle className="h-3.5 w-3.5" /> Confirmo compra
                      </button>
                      <button onClick={() => handleAction(offer.id, 'reject', offer.buyer_id)}
                        className="flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200">
                        <XCircle className="h-3.5 w-3.5" /> Cancelar
                      </button>
                    </>
                  )}

                  {/* Moderador aprueba/rechaza la transferencia final */}
                  {offer.status === 'pending_mod' && isAdmin && (
                    <>
                      <p className="text-xs w-full text-gray-600 mb-1">
                        ✅ Ambas partes aprobaron. Como moderador, ¿ejecutas la transferencia?
                      </p>
                      <button onClick={() => handleAction(offer.id, 'mod_approve', 'admin')}
                        className="flex items-center gap-1.5 rounded-lg bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-800 hover:bg-purple-200">
                        <CheckCircle className="h-3.5 w-3.5" /> Ejecutar transferencia
                      </button>
                      <button onClick={() => handleAction(offer.id, 'reject', 'admin')}
                        className="flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200">
                        <XCircle className="h-3.5 w-3.5" /> Rechazar
                      </button>
                    </>
                  )}

                  {offer.status === 'pending_mod' && !isAdmin && (
                    <div className="flex items-center gap-2 text-xs text-purple-700">
                      <Clock className="h-3.5 w-3.5" />
                      Esperando aprobación del moderador
                    </div>
                  )}
                </div>
              )}

              {/* Timestamp */}
              <p className="text-[10px] opacity-50 mt-2">
                {new Date(offer.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
