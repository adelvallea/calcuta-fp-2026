import { createClient } from '@/lib/supabase/server'
import { flagCode } from '@/lib/lot-utils'

export const dynamic = 'force-dynamic'

export default async function ExportPage() {
  const supabase = await createClient()

  const [{ data: lotsRaw }, { data: settings }, { data: rules }] = await Promise.all([
    supabase.from('lots')
      .select('*, teams:lot_teams(team:teams(*)), ownerships:lot_ownerships(ownership_percentage, participant:participants(name, avatar_url))')
      .eq('status', 'sold')
      .order('number'),
    supabase.from('calcuta_settings').select('*').single(),
    supabase.from('prize_rules').select('*').order('sort_order'),
  ])

  const lots = (lotsRaw ?? []).map((l: any) => ({
    ...l,
    teams: l.teams?.map((lt: any) => lt.team).filter(Boolean) ?? [],
  }))

  const currency = settings?.currency ?? 'MXN'
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 0 }).format(n)

  const totalRecaudado = lots.reduce((s: number, l: any) => s + (l.final_price ?? 0), 0)
  const participants   = settings?.buy_in_amount ?? 1000
  const pool           = settings ? totalRecaudado + (12 * participants) : totalRecaudado // aprox

  const today = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  // Probabilidades hardcoded para mostrar en el export
  function getProb(notes: string | null, key: 'champion' | 'pos32' | 'pos48'): string {
    if (!notes) return '—'
    const patterns = { champion: /Camp\.([\d.]+)%/, pos32: /#32:([\d.]+)%/, pos48: /#48:([\d.]+)%/ }
    const m = notes.match(patterns[key])
    return m ? `${parseFloat(m[1]).toFixed(1)}%` : '—'
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Print button — no aparece al imprimir */}
      <div className="print:hidden fixed top-4 right-4 flex gap-2 z-10">
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-bold text-white shadow-lg hover:bg-brand-navy-mid transition">
          🖨️ Imprimir / Guardar PDF
        </button>
        <a href="/auction" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 shadow hover:bg-gray-50 transition">
          ← Volver
        </a>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Header con logo */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-brand-navy">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="FP" className="h-12 w-12 rounded-xl"
                onError={() => {}} />
              <div>
                <h1 className="text-2xl font-black text-brand-navy leading-tight">
                  Gran Calcuta FP
                </h1>
                <p className="text-brand-gold font-bold text-sm">Mundial 2026 · Primera Edición</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">Resultados de la subasta — generado el {today}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total recaudado</p>
            <p className="text-3xl font-black text-brand-navy">{fmt(totalRecaudado)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{lots.length} lotes vendidos</p>
          </div>
        </div>

        {/* Premios en juego */}
        {(rules ?? []).length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Distribución de premios</h2>
            <div className="grid grid-cols-5 gap-2">
              {(rules ?? []).filter((r: any) => r.enabled).map((r: any) => (
                <div key={r.id} className="rounded-xl bg-brand-bg border border-gray-100 px-3 py-2.5 text-center">
                  <p className="text-xs font-bold text-brand-navy">{r.name}</p>
                  <p className="text-lg font-black text-brand-gold">{r.percentage}%</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{fmt(totalRecaudado * r.percentage / 100)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabla de resultados */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Lotes vendidos</h2>
          <div className="space-y-3">
            {lots.map((lot: any, idx: number) => {
              const owners = lot.ownerships ?? []
              const probChamp = getProb(lot.notes, 'champion')
              const prob32    = getProb(lot.notes, 'pos32')
              const prob48    = getProb(lot.notes, 'pos48')

              return (
                <div key={lot.id}
                  className={`rounded-2xl border overflow-hidden ${idx % 2 === 0 ? 'bg-white border-gray-100' : 'bg-gray-50/50 border-gray-100'}`}>
                  <div className="flex items-stretch">
                    {/* Número de lote */}
                    <div className="bg-brand-navy flex items-center justify-center px-4 shrink-0 rounded-l-2xl min-w-[56px]">
                      <div className="text-center">
                        <p className="text-[9px] font-semibold text-brand-gold uppercase tracking-wider">Lote</p>
                        <p className="text-xl font-black text-white leading-tight">{lot.number}</p>
                        <p className="text-[9px] font-medium text-white/50 uppercase">{lot.type}</p>
                      </div>
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Equipos con banderas */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {lot.teams.map((team: any) => (
                              <div key={team.id} className="flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 shadow-sm px-2.5 py-1.5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`https://flagcdn.com/w40/${flagCode(team.country_code)}.png`}
                                  alt={team.name}
                                  className="h-4 w-6 rounded object-cover"
                                />
                                <div>
                                  <p className="text-xs font-bold text-brand-navy leading-tight">{team.name}</p>
                                  <p className="text-[9px] text-gray-400">#{team.fifa_rank} · B{team.pot}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Probabilidades */}
                          <div className="flex gap-3 text-[10px]">
                            {lot.number <= 8 ? (
                              <span className="text-brand-gold-dark font-semibold">🏆 Campeón: {probChamp}</span>
                            ) : (
                              <>
                                <span className="text-blue-600 font-semibold">⚖️ Lugar 32: {prob32}</span>
                                <span className="text-red-500 font-semibold">🔴 Último: {prob48}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Dueño + precio */}
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-black text-brand-navy">{fmt(lot.final_price ?? 0)}</p>
                          <div className="mt-1 space-y-1">
                            {owners.map((o: any, i: number) => (
                              <div key={i} className="flex items-center justify-end gap-1.5">
                                {o.participant?.avatar_url && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={o.participant.avatar_url} alt=""
                                    className="h-5 w-5 rounded-full object-cover" />
                                )}
                                <p className="text-sm font-bold text-brand-navy-mid">
                                  {o.participant?.name ?? '—'}
                                  {o.ownership_percentage < 100 && (
                                    <span className="text-xs text-gray-400 font-normal ml-1">({o.ownership_percentage}%)</span>
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Totales */}
        <div className="mt-8 pt-6 border-t-2 border-brand-navy">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Total subasta</p>
              <p className="text-3xl font-black text-brand-navy">{fmt(totalRecaudado)}</p>
            </div>
            <div className="text-right text-xs text-gray-400 space-y-0.5">
              <p>{lots.length} lotes vendidos</p>
              <p>Calcuta FP · Mundial 2026</p>
              <p>{today}</p>
            </div>
          </div>
        </div>

        {/* Notas */}
        <p className="mt-6 text-[10px] text-gray-300 text-center">
          Gracias por participar en la Primera Edición de la Gran Calcuta FP · Mundial 2026
        </p>
      </div>

      {/* Estilos de impresión */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>
    </div>
  )
}
