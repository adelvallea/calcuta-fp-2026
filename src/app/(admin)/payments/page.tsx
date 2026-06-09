'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Download, PlusCircle, Trash2, RotateCcw } from 'lucide-react'

interface Participant {
  id: string; name: string; buy_in_amount: number; amount_paid: number
}
interface Payment {
  id: string; participant_id: string; amount: number; method?: string
  date: string; notes?: string; created_at: string
  participant?: { name: string }
}

export default function PaymentsPage() {
  const supabase = createClient()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [lots, setLots] = useState<any[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [payForm, setPayForm] = useState<{ participantId: string; amount: string; method: string; notes: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    const [{ data: ps }, { data: ls }, { data: pays }, { data: cfg }] = await Promise.all([
      supabase.from('participants').select('*').order('name'),
      supabase.from('lots').select('id, final_price, status, ownerships:lot_ownerships(participant_id)'),
      supabase.from('payments').select('*, participant:participants(name)').order('created_at', { ascending: false }),
      supabase.from('calcuta_settings').select('*').single(),
    ])
    setParticipants(ps ?? [])
    setLots(ls ?? [])
    setPayments(pays ?? [])
    setSettings(cfg)
  }
  useEffect(() => { load() }, [])

  const currency = settings?.currency ?? 'MXN'
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 0 }).format(n)

  function totalBids(pId: string) {
    return lots.filter((l) => l.status === 'sold' && l.ownerships?.some((o: any) => o.participant_id === pId))
      .reduce((s: number, l: any) => s + (l.final_price ?? 0), 0)
  }
  function totalDue(p: Participant) { return Math.max(p.buy_in_amount, totalBids(p.id)) }
  function saldo(p: Participant) { return totalDue(p) - p.amount_paid }

  async function registerPayment() {
    if (!payForm || !payForm.participantId || !payForm.amount) return
    const amount = parseFloat(payForm.amount)
    if (isNaN(amount) || amount <= 0) return toast.error('Monto inválido')

    const p = participants.find((x) => x.id === payForm.participantId)
    if (!p) return

    setLoading(true)
    try {
      await supabase.from('payments').insert({
        participant_id: payForm.participantId,
        amount,
        method: payForm.method || 'efectivo',
        date: new Date().toISOString().split('T')[0],
        notes: payForm.notes || null,
      })
      await supabase.from('participants').update({ amount_paid: p.amount_paid + amount }).eq('id', p.id)
      toast.success(`Pago de ${fmt(amount)} registrado para ${p.name}`)
      setPayForm(null)
      load()
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function undoPayment(payment: Payment) {
    if (!confirm(`¿Deshacer pago de ${fmt(payment.amount)} de ${payment.participant?.name}?`)) return
    const res = await fetch(`/api/payments/undo?payment_id=${payment.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Pago deshecho')
      load()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error')
    }
  }

  function exportCSV() {
    const rows = [['Nombre', 'Buy-in', 'Bids ganados', 'Total a pagar', 'Pagado', 'Saldo', 'Estado']]
    participants.forEach((p) => {
      const due = totalDue(p); const s = saldo(p)
      rows.push([p.name, String(p.buy_in_amount), String(totalBids(p.id)), String(due), String(p.amount_paid), String(s),
        s <= 0 ? 'Pagado' : p.amount_paid > 0 ? 'Parcial' : 'Pendiente'])
    })
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pagos.csv'; a.click()
  }

  const totalPool = participants.reduce((s, p) => s + totalDue(p), 0)
  const totalPaid = participants.reduce((s, p) => s + p.amount_paid, 0)
  const totalPending = participants.reduce((s, p) => s + Math.max(0, saldo(p)), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue">Pagos</h1>
          <p className="text-sm text-brand-slate">Control de cobros y saldos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary"><Download className="h-4 w-4" />CSV</button>
          <button onClick={() => setPayForm({ participantId: '', amount: '', method: 'efectivo', notes: '' })} className="btn-primary">
            <PlusCircle className="h-4 w-4" />Registrar pago
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card bg-amber-50 border-brand-gold/30">
          <p className="stat-label">Bolsa total</p>
          <p className="stat-value text-brand-gold-dark">{fmt(totalPool)}</p>
        </div>
        <div className="card bg-green-50 border-green-200">
          <p className="stat-label">Recaudado</p>
          <p className="stat-value text-green-700">{fmt(totalPaid)}</p>
        </div>
        <div className="card bg-red-50 border-red-100">
          <p className="stat-label">Pendiente</p>
          <p className="stat-value text-red-600">{fmt(totalPending)}</p>
        </div>
      </div>

      {/* Formulario de pago */}
      {payForm && (
        <div className="card border-brand-gold/30">
          <h2 className="font-bold mb-4">Registrar pago</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Participante</label>
              <select value={payForm.participantId} onChange={(e) => {
                const p = participants.find(x => x.id === e.target.value)
                const pending = p ? Math.max(0, saldo(p)) : 0
                setPayForm({ ...payForm, participantId: e.target.value, amount: pending > 0 ? String(pending) : '' })
              }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none">
                <option value="">Seleccionar...</option>
                {participants.filter(p => saldo(p) > 0).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — debe {fmt(saldo(p))}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Monto ($)</label>
              <input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none" placeholder="1000" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Método</label>
              <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none">
                {['efectivo', 'transferencia', 'tarjeta', 'otro'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Notas</label>
              <input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none" placeholder="opcional" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={registerPayment} disabled={loading} className="btn-primary">{loading ? 'Guardando...' : 'Registrar'}</button>
            <button onClick={() => setPayForm(null)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabla de saldos */}
      <div className="card p-0 overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-brand-navy">Saldos por participante</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="table-header">Participante</th>
              <th className="table-header text-right">Buy-in</th>
              <th className="table-header text-right">Bids ganados</th>
              <th className="table-header text-right">Total a pagar</th>
              <th className="table-header text-right">Pagado</th>
              <th className="table-header text-right">Saldo</th>
              <th className="table-header text-center">Estado</th>
              <th className="table-header" />
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => {
              const bids = totalBids(p.id); const due = totalDue(p); const s = saldo(p)
              const status = s <= 0 ? 'paid' : p.amount_paid > 0 ? 'partial' : 'pending'
              return (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="table-cell font-semibold text-brand-navy">{p.name}</td>
                  <td className="table-cell text-right">{fmt(p.buy_in_amount)}</td>
                  <td className="table-cell text-right">{bids > 0 ? fmt(bids) : '—'}</td>
                  <td className="table-cell text-right font-semibold">{fmt(due)}</td>
                  <td className="table-cell text-right text-green-700">{p.amount_paid > 0 ? fmt(p.amount_paid) : '—'}</td>
                  <td className={`table-cell text-right font-bold ${s > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {s > 0 ? fmt(s) : '✓'}
                  </td>
                  <td className="table-cell text-center">
                    <span className={status === 'paid' ? 'badge-sold' : status === 'partial' ? 'badge-paused' : 'badge-pending'}>
                      {status === 'paid' ? 'Pagado' : status === 'partial' ? 'Parcial' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="table-cell">
                    {s > 0 && (
                      <button onClick={() => setPayForm({ participantId: p.id, amount: String(s), method: 'efectivo', notes: '' })}
                        className="rounded-md bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-200 transition">
                        Pagar {fmt(s)}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {participants.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-sm text-gray-400">Sin participantes</td></tr>
            )}
          </tbody>
          {participants.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                <td className="table-cell">TOTAL</td>
                <td className="table-cell text-right">{fmt(participants.reduce((s, p) => s + p.buy_in_amount, 0))}</td>
                <td className="table-cell text-right">{fmt(participants.reduce((s, p) => s + totalBids(p.id), 0))}</td>
                <td className="table-cell text-right text-brand-navy">{fmt(totalPool)}</td>
                <td className="table-cell text-right text-green-700">{fmt(totalPaid)}</td>
                <td className="table-cell text-right text-red-600">{fmt(totalPending)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Historial de pagos con undo */}
      {payments.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-bold text-brand-navy">Historial de pagos</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Participante</th>
                <th className="table-header text-right">Monto</th>
                <th className="table-header">Método</th>
                <th className="table-header">Fecha</th>
                <th className="table-header">Notas</th>
                <th className="table-header" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="table-cell font-medium">{p.participant?.name ?? '—'}</td>
                  <td className="table-cell text-right font-bold text-green-700">{fmt(p.amount)}</td>
                  <td className="table-cell capitalize text-gray-500">{p.method ?? '—'}</td>
                  <td className="table-cell text-gray-500">{p.date}</td>
                  <td className="table-cell text-gray-400">{p.notes ?? '—'}</td>
                  <td className="table-cell">
                    <button onClick={() => undoPayment(p)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition">
                      <RotateCcw className="h-3 w-3" /> Deshacer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
