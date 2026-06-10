'use client'

import { useEffect, useState } from 'react'

// Fotos secundarias para el carrusel (jugadores individuales)
const CAROUSEL = [
  '/players/p01.jpg',
  '/players/p02.jpg',
  '/players/p03.jpg',
  '/players/p04.jpg',
  '/players/p05.jpg',
  '/players/p06.jpg',
  '/players/p07.jpg',
  '/players/p08.jpg',
  '/players/p09.jpg',
  '/players/p10.jpg',
  '/players/p11.jpg',
  '/players/p12.jpg',
  '/players/p13.jpg',
  '/players/p14.jpg',
  '/players/p15.jpg',
  '/players/p16.jpg',
  '/players/p17.jpg',
]

interface Props {
  className?: string
  overlay?: 'dark' | 'light' | 'none'
  interval?: number
}

export default function PlayerCarousel({ className = '', overlay = 'dark', interval = 4000 }: Props) {
  const [idx, setIdx] = useState(0)
  const [fade, setFade] = useState(false)

  useEffect(() => {
    const t = setInterval(() => {
      setFade(true)
      setTimeout(() => {
        setIdx(i => (i + 1) % CAROUSEL.length)
        setFade(false)
      }, 600)
    }, interval)
    return () => clearInterval(t)
  }, [interval])

  const overlayClass =
    overlay === 'dark'  ? 'bg-gradient-to-t from-black/80 via-black/40 to-transparent' :
    overlay === 'light' ? 'bg-white/20' : ''

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        key={idx}
        src={CAROUSEL[idx]}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-600 ${fade ? 'opacity-0' : 'opacity-100'}`}
      />
      {overlay !== 'none' && <div className={`absolute inset-0 ${overlayClass}`} />}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
        {[0,1,2,3,4].map(i => (
          <span key={i} className={`h-1 rounded-full transition-all ${Math.floor(idx/3)===i ? 'w-3 bg-white' : 'w-1 bg-white/30'}`} />
        ))}
      </div>
    </div>
  )
}
