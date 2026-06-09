import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Gavel, ChevronRight } from 'lucide-react'
import OpenLotButton from './OpenLotButton'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', active: 'En subasta', sold: 'Vendido', paused: 'Pausado', cancelled: 'Cancelado',
}
const STATUS_CLASS: Record<string, string> = {
  pending: 'badge-pending', active: 'badge-active', sold: 'badge-sold', paused: 'badge-paused', cancelled: 'badge-cancelled',
}

export default async function AuctionPage() {
  const supabase = await createClient()
  const { data: lots } = await supabase
    .from('lots')
    .select('*, teams:lot_teams(team:teams(name, fifa_rank, pot)), ownerships:lot_ownerships(participant:participants(name))')
    .order('number')
  const { data: settings } = await supabase.from('calcuta_settings').select('*').single()

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: settings?.currency ?? 'MXN', minimumFractionDigits: 0 }).format(n)

  const groups = {
    active:  (lots ?? []).filter((l: any) => l.status === 'active'),
    pending: (lots ?? []).filter((l: any) => l.status === 'pending'),
    sold:    (lots ?? []).filter((l: any) => l.status === 'sold'),
    other:   (lots ?? []).filter((l: any) => !['active','pending','sold'].includes(l.status)),
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue">Subasta</h1>
          <p className="text-sm text-brand-slate">18 lotes · 48 equipos</p>
        </div>
      </div>

      {/* En subasta ahora */}
      {groups.active.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">🔴 En Subasta</h2>
          <div className="space-y-2">
            {groups.active.map((lot: any) => <LotRow key={lot.id} lot={lot} fmt={fmt} />)}
          </div>
        </section>
      )}

      {/* Pendientes */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
          Pendientes ({groups.pending.length})
        </h2>
        <div className="space-y-2">
          {groups.pending.map((lot: any) => <LotRow key={lot.id} lot={lot} fmt={fmt} />)}
        </div>
      </section>

      {/* Vendidos */}
      {groups.sold.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-green-600 mb-3">
            Vendidos ({groups.sold.length})
          </h2>
          <div className="space-y-2">
            {groups.sold.map((lot: any) => <LotRow key={lot.id} lot={lot} fmt={fmt} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function LotRow({ lot, fmt }: { lot: any; fmt: (n: number) => string }) {
  const teams  = lot.teams?.map((lt: any) => lt.team).filter(Boolean) ?? []
  const owners = lot.ownerships?.map((o: any) => o.participant?.name).filter(Boolean) ?? []

  return (
    <div className="card py-3 px-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-xs font-mono font-bold text-brand-gold w-6 text-center shrink-0">
            {lot.number}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-brand-navy truncate">{lot.title}</p>
              <span className={STATUS_CLASS[lot.status] ?? 'badge-pending'}>
                {STATUS_LABEL[lot.status]}
              </span>
              <span className="text-[10px] font-medium text-gray-400 uppercase">{lot.type}</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {teams.map((t: any) => `${t.name} (#${t.fifa_rank})`).join(' · ')}
            </p>
            {owners.length > 0 && (
              <p className="text-xs font-medium text-brand-navy-mid mt-0.5">👤 {owners.join(', ')}</p>
            )}
          </div>
        </div>

        {/* Precio + acciones */}
        <div className="flex items-center gap-2 ml-2 shrink-0">
          {lot.status === 'sold' && lot.final_price > 0 && (
            <span className="text-sm font-bold text-green-700">{fmt(lot.final_price)}</span>
          )}
          {lot.status !== 'sold' && lot.current_bid > 0 && (
            <span className="text-sm font-semibold text-blue-700">{fmt(lot.current_bid)}</span>
          )}

          {lot.status === 'pending' && (
            /* Botón que cambia estado a 'active' sin requerir bids */
            <OpenLotButton lotId={lot.id} />
          )}

          {lot.status !== 'sold' && (
            <Link
              href={`/auction/live/${lot.id}`}
              className="flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy-mid transition">
              <Gavel className="h-3 w-3" />
              {lot.status === 'active' ? 'Continuar' : 'Pantalla'}
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
