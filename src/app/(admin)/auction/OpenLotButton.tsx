'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Play } from 'lucide-react'

export default function OpenLotButton({ lotId }: { lotId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function openLot() {
    setLoading(true)
    const { error } = await supabase
      .from('lots')
      .update({ status: 'active' })
      .eq('id', lotId)
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Lote abierto')
      router.refresh()
    }
  }

  return (
    <button
      onClick={openLot}
      disabled={loading}
      title="Abrir subasta sin bids"
      className="flex items-center gap-1 rounded-lg border border-brand-gold bg-amber-50 px-3 py-1.5 text-xs font-semibold text-brand-gold-dark hover:bg-amber-100 transition disabled:opacity-50">
      <Play className="h-3 w-3" />
      {loading ? '...' : 'Abrir'}
    </button>
  )
}
