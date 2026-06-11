'use client'

import { useEffect, useState } from 'react'

const CAROUSEL = [
  '/players/p01.jpg', '/players/p02.jpg', '/players/p04.jpg',
  '/players/p05.jpg', '/players/p06.jpg', '/players/p07.jpg', '/players/p08.jpg',
  '/players/p09.jpg', '/players/p10.jpg', '/players/p11.jpg', '/players/p12.jpg',
  '/players/p13.jpg', '/players/p14.jpg', '/players/p15.jpg', '/players/p16.jpg',
  '/players/p17.jpg', '/players/p18.jpg', '/players/p19.jpg', '/players/p20.jpg',
  '/players/p21.jpg',
]

interface Props {
  className?: string
  /** 'cover' recorta para llenar | 'contain' muestra foto completa con fondo */
  fit?: 'cover' | 'contain'
  overlay?: 'dark' | 'none'
  interval?: number
  bgColor?: string  // Color de fondo cuando fit='contain'
}

export default function PlayerCarousel({
  className = '',
  fit = 'contain',
  overlay = 'none',
  interval = 4000,
  bgColor = '#0a1628',
}: Props) {
  const [idx, setIdx] = useState(0)
  const [fade, setFade] = useState(false)

  useEffect(() => {
    const t = setInterval(() => {
      setFade(true)
      setTimeout(() => { setIdx(i => (i + 1) % CAROUSEL.length); setFade(false) }, 500)
    }, interval)
    return () => clearInterval(t)
  }, [interval])

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ backgroundColor: bgColor }}>
      <img
        key={idx}
        src={CAROUSEL[idx]}
        alt=""
        className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${fade ? 'opacity-0' : 'opacity-100'}`}
        style={{ objectFit: fit, objectPosition: 'center' }}
      />
      {overlay === 'dark' && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
      )}
      {/* Puntos de navegación */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
        {[0,1,2,3,4].map(i => (
          <button key={i} onClick={() => setIdx(i * Math.floor(CAROUSEL.length / 5))}
            className={`h-1 rounded-full transition-all ${Math.floor(idx/(CAROUSEL.length/5))===i ? 'w-3 bg-white' : 'w-1 bg-white/30'}`} />
        ))}
      </div>
    </div>
  )
}
