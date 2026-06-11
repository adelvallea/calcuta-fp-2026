'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { playTimerWarning, playTimerEnd } from '@/lib/sounds'
import { Timer, Play, Square } from 'lucide-react'

interface Props {
  lotId: string
  isAdmin?: boolean
  onExpire?: () => void
}

interface TimerState {
  endsAt: number | null   // timestamp ms
  active: boolean
}

const CHANNEL = (lotId: string) => `timer-${lotId}`

export default function AuctionTimer({ lotId, isAdmin = false, onExpire }: Props) {
  const supabase = createClient()
  const [seconds, setSeconds] = useState<number | null>(null)
  const [active, setActive] = useState(false)
  const [preset, setPreset] = useState(30)

  // Broadcast cuando admin arranca el timer
  const startTimer = useCallback((duration: number) => {
    const endsAt = Date.now() + duration * 1000
    supabase.channel(CHANNEL(lotId)).send({
      type: 'broadcast',
      event: 'timer',
      payload: { endsAt, active: true },
    })
  }, [lotId, supabase])

  const stopTimer = useCallback(() => {
    supabase.channel(CHANNEL(lotId)).send({
      type: 'broadcast',
      event: 'timer',
      payload: { endsAt: null, active: false },
    })
    setSeconds(null)
    setActive(false)
  }, [lotId, supabase])

  // Suscribir al canal de timer
  useEffect(() => {
    const ch = supabase.channel(CHANNEL(lotId))
      .on('broadcast', { event: 'timer' }, ({ payload }: { payload: TimerState }) => {
        if (!payload.active || !payload.endsAt) {
          setSeconds(null); setActive(false); return
        }
        setActive(true)
        const remaining = Math.max(0, Math.round((payload.endsAt - Date.now()) / 1000))
        setSeconds(remaining)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [lotId, supabase])

  // Cuenta regresiva local
  useEffect(() => {
    if (!active || seconds === null) return
    if (seconds <= 0) {
      playTimerEnd()
      onExpire?.()
      setActive(false)
      return
    }
    if (seconds <= 5) playTimerWarning()
    const t = setTimeout(() => setSeconds(s => (s !== null ? s - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [active, seconds])

  const color = seconds === null ? 'text-gray-400'
    : seconds <= 5  ? 'text-red-500'
    : seconds <= 15 ? 'text-yellow-500'
    : 'text-green-500'

  const bgColor = seconds === null ? ''
    : seconds <= 5  ? 'bg-red-50 border-red-200'
    : seconds <= 15 ? 'bg-yellow-50 border-yellow-200'
    : 'bg-green-50 border-green-200'

  return (
    <div className="space-y-2">
      {/* Display del timer */}
      {(active && seconds !== null) ? (
        <div className={`rounded-xl border-2 p-3 text-center transition-all ${bgColor}`}>
          <div className="flex items-center justify-center gap-2">
            <Timer className={`h-5 w-5 ${color} ${seconds <= 5 ? 'animate-pulse' : ''}`} />
            <span className={`text-3xl font-black tabular-nums ${color} ${seconds <= 5 ? 'animate-pulse' : ''}`}>
              {String(seconds).padStart(2, '0')}s
            </span>
          </div>
          {isAdmin && (
            <button onClick={stopTimer}
              className="mt-2 text-xs text-gray-400 hover:text-red-500 transition flex items-center gap-1 mx-auto">
              <Square className="h-3 w-3" /> Detener
            </button>
          )}
        </div>
      ) : (
        isAdmin && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" /> Temporizador
            </p>
            <div className="flex gap-1.5">
              {[15, 30, 45, 60].map(s => (
                <button key={s} onClick={() => setPreset(s)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${preset === s ? 'bg-brand-gold text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s}s
                </button>
              ))}
            </div>
            <button onClick={() => startTimer(preset)}
              className="w-full rounded-lg bg-brand-navy py-2 text-xs font-bold text-white hover:bg-brand-navy-mid transition flex items-center justify-center gap-1.5">
              <Play className="h-3.5 w-3.5" /> Iniciar {preset}s
            </button>
          </div>
        )
      )}
    </div>
  )
}
