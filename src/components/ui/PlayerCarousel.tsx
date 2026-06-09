'use client'

import { useEffect, useState } from 'react'

const PLAYERS = [
  '/players/player-1.jpg',
  '/players/player-2.jpg',
  '/players/player-3.jpg',
  '/players/player-4.jpg',
  '/players/player-5.jpg',
]

interface Props {
  className?: string
  overlay?: 'dark' | 'light' | 'none'
  interval?: number
}

export default function PlayerCarousel({ className = '', overlay = 'dark', interval = 4000 }: Props) {
  const [current, setCurrent] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const t = setInterval(() => {
      setPrev(current)
      setFading(true)
      setTimeout(() => {
        setCurrent(c => (c + 1) % PLAYERS.length)
        setFading(false)
        setPrev(null)
      }, 700)
    }, interval)
    return () => clearInterval(t)
  }, [current, interval])

  const overlayClass =
    overlay === 'dark'  ? 'bg-gradient-to-t from-black/80 via-black/40 to-black/20' :
    overlay === 'light' ? 'bg-white/20 backdrop-blur-sm' : ''

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Imagen previa (saliendo) */}
      {prev !== null && (
        <img
          key={`prev-${prev}`}
          src={PLAYERS[prev]}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700 opacity-0"
        />
      )}

      {/* Imagen actual */}
      <img
        key={`curr-${current}`}
        src={PLAYERS[current]}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700 ${fading ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Overlay */}
      {overlay !== 'none' && (
        <div className={`absolute inset-0 ${overlayClass}`} />
      )}

      {/* Puntitos de navegación */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {PLAYERS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`}
          />
        ))}
      </div>
    </div>
  )
}
