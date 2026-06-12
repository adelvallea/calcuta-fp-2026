'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { UserPlus, Pencil, Trash2, Download, Lock } from 'lucide-react'
import { useIsAdmin } from '@/hooks/useIsAdmin'

interface Participant {
  id: string; name: string; email?: string; phone?: string
  buy_in_amount: number; amount_paid: number; notes?: string; created_at: string
}

export default function ParticipantsPage() {
  const supabase = createClient()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [lots, setLots] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Participant | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', buy_in_amount: 1000, notes: '' })
  const [loading, setLoading] = useState(false)
  const isAdmin = useIsAdmin()

  async function load() {
    const [{ data: ps }, { data: ls }] = await Promise.all([
      supabase.from('participants').select('*').order('name'),
      supabase.from('lots').select('id, number, final_price, status, ownerships:lot_ownerships(participant_id)'),
    ])
    setParticipants(ps ?? [])
    setLots(ls ?? [])
  }
  useEffect(() => { load() }, [])

  function totalBids(pId: string) {
    return lots.filter((l) => l.status === 'sold' && l.ownerships?.some((o: any) => o.participant_id === pId))
      .reduce((s: number, l: any) => s + (l.final_price ?? 0), 0)
  }

  function totalDue(p: Participant) { return Math.max(p.buy_in_amount, totalBids(p.id)) }
  function saldo(p: Participant) { return totalDue(p) - p.amount_paid }

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n)

  async function save() {
    if (!form.name.trim()) return toast.error('El nombre es obligatorio')
    setLoading(true)
    const payload = { name: form.name.trim(), email: form.email || null, phone: form.phone || null, buy_in_amount: form.buy_in_amount, notes: form.notes || null }
    const { error } = editing
      ? await supabase.from('participants').update(payload).eq('id', editing.id)
      : await supabase.from('participants').insert(payload)
    setLoading(false)
    if (error) return toast.error(error.message)
    toast.success(editing ? 'Participante actualizado' : 'Participante agregado')
    setShowForm(false); setEditing(null); setForm({ name: '', email: '', phone: '', buy_in_amount: 1000, notes: '' })
    load()
  }

  async function del(p: Participant) {
    if (!confirm(`¿Eliminar a ${p.name}?`)) return
    await supabase.from('participants').delete().eq('id', p.id)
    toast.success('Participante eliminado'); load()
  }

  async function registerPayment(p: Participant, amount: number) {
    await supabase.from('payments').insert({ participant_id: p.id, amount, date: new Date().toISOString().split('T')[0], method: 'efectivo' })
    await supabase.from('participants').update({ amount_paid: p.amount_paid + amount }).eq('id', p.id)
    toast.success(`Pago de ${fmt(amount)} registrado`); load()
  }

  function exportCSV() {
    const rows = [['Nombre', 'Buy-in', 'Total Bids', 'Total a Pagar', 'Pagado', 'Saldo', 'Estado']]
    participants.forEach((p) => {
      const due = totalDue(p); const s = saldo(p)
      rows.push([p.name, String(p.buy_in_amount), String(totalBids(p.id)), String(due), String(p.amount_paid), String(s), s <= 0 ? 'Pagado' : p.amount_paid > 0 ? 'Parcial' : 'Pendiente'])
    })
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'participantes.csv'; a.click()
  }

  const totalPool = participants.reduce((s, p) => s + totalDue(p), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue">Participantes</h1>
          <p className="text-sm text-brand-slate">{participants.length} registrados · Bolsa: {fmt(totalPool)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary"><Download className="h-4 w-4" />CSV</button>
          {isAdmin ? (
            <button onClick={() => { setEditing(null); setForm({ name: '', email: '', phone: '', buy_in_amount: 1000, notes: '' }); setShowForm(true) }} className="btn-primary">
              <UserPlus className="h-4 w-4" />Agregar
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-400">
              <Lock className="h-3.5 w-3.5" /> Solo moderador
            </div>
          )}
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card border-brand-gold/30">
          <h2 className="font-bold mb-4">{editing ? 'Editar participante' : 'Nuevo participante'}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Nombre *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none" placeholder="Nombre completo" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Buy-in ($)</label>
              <input type="number" value={form.buy_in_amount} onChange={(e) => setForm({ ...form, buy_in_amount: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none" placeholder="opcional" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Teléfono</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none" placeholder="opcional" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Notas</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none" placeholder="opcional" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={loading} className="btn-primary">{loading ? 'Guardando...' : 'Guardar'}</button>
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="card p-0 overflow-x-auto">
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
                  <td className="table-cell">
                    <p className="font-semibold text-brand-navy">{p.name}</p>
                    {p.email && <p className="text-xs text-gray-400">{p.email}</p>}
                  </td>
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
                    <div className="flex items-center gap-1">
                      {isAdmin && s > 0 && (
                        <button onClick={() => registerPayment(p, s)}
                          className="rounded-md bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-200 transition">
                          Pago completo
                        </button>
                      )}
                      {isAdmin && (
                      <button onClick={() => { setEditing(p); setForm({ name: p.name, email: p.email ?? '', phone: p.phone ?? '', buy_in_amount: p.buy_in_amount, notes: p.notes ?? '' }); setShowForm(true) }}
                        className="rounded-md p-1.5 hover:bg-gray-100 transition">
                        <Pencil className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                      )}
                      {isAdmin && (
                      <button onClick={() => del(p)} className="rounded-md p-1.5 hover:bg-red-50 transition">
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {participants.length === 0 && (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-gray-400">Sin participantes aún. Agrega el primero.</td></tr>
            )}
          </tbody>
          {participants.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="table-cell">Total ({participants.length})</td>
                <td className="table-cell text-right">{fmt(participants.reduce((s, p) => s + p.buy_in_amount, 0))}</td>
                <td className="table-cell text-right">{fmt(participants.reduce((s, p) => s + totalBids(p.id), 0))}</td>
                <td className="table-cell text-right text-brand-navy">{fmt(totalPool)}</td>
                <td className="table-cell text-right text-green-700">{fmt(participants.reduce((s, p) => s + p.amount_paid, 0))}</td>
                <td className="table-cell text-right text-red-600">{fmt(participants.reduce((s, p) => s + Math.max(0, saldo(p)), 0))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
