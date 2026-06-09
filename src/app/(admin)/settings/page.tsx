'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Save, RotateCcw, AlertTriangle } from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<any>(null)
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [resetModal, setResetModal] = useState<'auction' | 'full' | null>(null)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    supabase.from('calcuta_settings').select('*').single().then(({ data }) => data && setSettings(data))
    supabase.from('prize_rules').select('*').order('sort_order').then(({ data }) => data && setRules(data))
  }, [])

  async function saveSettings() {
    if (!settings?.id) return
    setLoading(true)
    const { error } = await supabase.from('calcuta_settings').update({
      event_name: settings.event_name,
      buy_in_amount: settings.buy_in_amount,
      min_bid_increment: settings.min_bid_increment,
      currency: settings.currency,
      currency_symbol: settings.currency_symbol,
    }).eq('id', settings.id)
    setLoading(false)
    if (error) toast.error(error.message)
    else toast.success('Configuración guardada')
  }

  async function saveRule(rule: any) {
    const { error } = await supabase.from('prize_rules')
      .update({ percentage: rule.percentage, enabled: rule.enabled }).eq('id', rule.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Regla actualizada')
      setRules((prev) => prev.map((r) => r.id === rule.id ? rule : r))
    }
  }

  async function doReset(mode: 'auction' | 'full') {
    setResetting(true)
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      if (res.ok) {
        toast.success(mode === 'auction' ? 'Subasta reseteada' : 'Reset completo realizado')
        setResetModal(null)
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al resetear')
      }
    } finally { setResetting(false) }
  }

  const totalPct = rules.filter((r) => r.enabled).reduce((s: number, r: any) => s + Number(r.percentage), 0)

  if (!settings) return <div className="p-6 text-sm text-gray-400">Cargando...</div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-brand-blue">Configuración</h1>

      {/* General */}
      <div className="card space-y-4">
        <h2 className="font-bold text-brand-navy">General</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { key: 'event_name', label: 'Nombre del evento', type: 'text' },
            { key: 'buy_in_amount', label: 'Buy-in ($)', type: 'number' },
            { key: 'min_bid_increment', label: 'Incremento mínimo de bid ($)', type: 'number' },
            { key: 'currency', label: 'Moneda ISO (ej. MXN)', type: 'text' },
            { key: 'currency_symbol', label: 'Símbolo ($)', type: 'text' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
              <input type={type} value={settings[key] ?? ''}
                onChange={(e) => setSettings({ ...settings, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none" />
            </div>
          ))}
        </div>
        <button onClick={saveSettings} disabled={loading} className="btn-primary">
          <Save className="h-4 w-4" />{loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Reparto */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-brand-navy">Reparto de la bolsa</h2>
          <span className={`text-sm font-bold ${Math.abs(totalPct - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
            Total: {totalPct.toFixed(1)}% {Math.abs(totalPct - 100) < 0.01 ? '✓' : '⚠️'}
          </span>
        </div>
        <div className="space-y-3">
          {rules.map((rule: any) => (
            <div key={rule.id} className="flex items-center gap-4 rounded-lg bg-brand-bg p-3">
              <input type="checkbox" checked={rule.enabled}
                onChange={(e) => saveRule({ ...rule, enabled: e.target.checked })}
                className="h-4 w-4 accent-brand-gold" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-brand-navy">{rule.name}</p>
                <p className="text-xs text-gray-400">{rule.description}</p>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" value={rule.percentage}
                  onChange={(e) => setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, percentage: Number(e.target.value) } : r))}
                  onBlur={() => saveRule(rule)}
                  className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-right text-sm font-bold focus:border-brand-gold focus:outline-none" />
                <span className="text-sm text-gray-400">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reset */}
      <div className="card border-red-100">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h2 className="font-bold text-red-600">Zona de Reset</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Estas acciones son irreversibles. Úsalas solo si necesitas reiniciar la subasta o hacer pruebas.
        </p>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setResetModal('auction')}
            className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition">
            <RotateCcw className="h-4 w-4" />
            Reset subasta
          </button>
          <button onClick={() => setResetModal('full')}
            className="flex items-center gap-2 rounded-lg border border-red-500 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition">
            <RotateCcw className="h-4 w-4" />
            Reset completo
          </button>
        </div>
        <div className="mt-3 space-y-1 text-xs text-gray-400">
          <p><strong>Reset subasta:</strong> borra bids, ownerships, regresa lotes a "pendiente".</p>
          <p><strong>Reset completo:</strong> todo lo anterior + participantes, pagos y resultados.</p>
        </div>
      </div>

      {/* Modal de confirmación */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h3 className="font-bold text-red-600 text-lg">
                {resetModal === 'auction' ? 'Reset de Subasta' : 'Reset Completo'}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              {resetModal === 'auction'
                ? '¿Confirmas que quieres borrar todos los bids, ownerships y regresar los lotes a pendiente? Esta acción no se puede deshacer.'
                : '¿Confirmas que quieres borrar TODO: subasta, participantes, pagos y resultados? Esta acción es IRREVERSIBLE.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => doReset(resetModal)} disabled={resetting}
                className="btn-danger flex-1 justify-center">
                {resetting ? 'Reseteando...' : `Sí, resetear`}
              </button>
              <button onClick={() => setResetModal(null)} className="btn-secondary flex-1 justify-center">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
