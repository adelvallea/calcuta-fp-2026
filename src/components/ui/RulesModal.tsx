'use client'

import { useState } from 'react'
import { X, BookOpen } from 'lucide-react'

export function RulesButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Reglas
      </button>
      {open && <RulesModal onClose={() => setOpen(false)} />}
    </>
  )
}

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-black text-brand-navy">Reglas — Calcuta FP 2026</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 text-sm text-gray-700">

          {/* Subasta */}
          <Section title="Subasta">
            <p>
              Los 48 equipos se subastan en lotes, que serán equipos sueltos o combos prearmados
              para nivelar la probabilidad de ganar.
            </p>
            <p className="mt-2">
              Subasta abierta con moderador; el lote es de quien ofrezca más. Puedes ganar varios
              lotes o ninguno. <strong>Bids aumentan en $200 o más.</strong>
            </p>
          </Section>

          {/* Buy-in */}
          <Section title="Buy-in">
            <p>
              Cada participante paga <strong>$1,000 obligatorios</strong> para entrar.
              Ese monto es crédito para tu subasta; se abona a tu bid.
            </p>
            <div className="mt-3 space-y-1.5 pl-3 border-l-2 border-brand-gold/40">
              <p className="italic text-gray-600">
                <span className="not-italic font-semibold text-gray-700">Ejemplo 1:</span>{' '}
                compras un lote en $1,600 → pagas $600 adicionales (total $1,600).
              </p>
              <p className="italic text-gray-600">
                <span className="not-italic font-semibold text-gray-700">Ejemplo 2:</span>{' '}
                compras un lote en $800 → cubierto por el buy-in; te quedan $200 de crédito para otro lote.
              </p>
            </div>
            <p className="mt-2 font-medium text-gray-800">
              Si no ganas ningún lote, pierdes tu buy-in.
            </p>
          </Section>

          {/* Reparto */}
          <Section title="Reparto de la bolsa">
            <p className="mb-3">Se reparte el <strong>100% de la bolsa</strong> de la siguiente manera:</p>
            <div className="rounded-xl overflow-hidden border border-gray-100">
              {[
                { pos: '1.º', label: 'Campeón',      pct: '30%', color: 'bg-amber-50 text-amber-800',  icon: '🏆' },
                { pos: '2.º', label: 'Subcampeón',   pct: '20%', color: 'bg-gray-50  text-gray-700',   icon: '🥈' },
                { pos: '3.er', label: '3er lugar',    pct: '10%', color: 'bg-orange-50 text-orange-700', icon: '🥉' },
                { pos: '32.º', label: 'Lugar 32',     pct: '20%', color: 'bg-blue-50  text-blue-700',   icon: '⚖️' },
                { pos: '48.º', label: 'Último lugar', pct: '20%', color: 'bg-red-50   text-red-700',    icon: '🔴' },
              ].map(({ pos, label, pct, color, icon }) => (
                <div key={pos} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 ${color}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{icon}</span>
                    <div>
                      <span className="font-bold">{pos} {label}</span>
                    </div>
                  </div>
                  <span className="text-xl font-black">{pct}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Posiciones */}
          <Section title="Posiciones">
            <p>
              Se usa la <strong>clasificación final oficial de FIFA</strong> para determinar
              las posiciones finales del Mundial.
            </p>
          </Section>

          {/* Notas adicionales */}
          <div className="rounded-xl bg-brand-bg border border-gray-200 p-4 text-xs text-gray-500 space-y-1">
            <p>• Se permite copropiedad de lotes (porcentajes acordados entre participantes).</p>
            <p>• El premio se paga al dueño determinado en la subasta.</p>
            <p>• Un mismo dueño puede cobrar varios premios si sus equipos clasifican.</p>
            <p>• Se permiten sponsors para aumentar el monto de la bolsa.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-brand-navy border-b border-gray-100 pb-1.5 mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}
