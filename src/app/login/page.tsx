'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') ?? '/dashboard'

  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (res.ok) {
        router.push(redirect)
        router.refresh()
      } else {
        const d = await res.json()
        setError(d.error ?? 'PIN incorrecto')
        setPin('')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Foto de fondo — mitad izquierda en desktop */}
      <div className="hidden md:block md:w-1/2 relative">
        <img src="/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/40 to-brand-navy/80" />
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 text-center px-8 z-10">
          <img src="/logo.png" alt="FP" className="h-16 w-16 mb-3 drop-shadow-xl"
            onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg' }} />
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-gold mb-1">Calcuta FP</p>
          <h2 className="text-3xl font-black text-white">Mundial 2026</h2>
          <p className="text-sm text-white/50 mt-2">Acceso moderador</p>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex-1 flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">
          {/* Logo en móvil */}
          <div className="md:hidden text-center mb-8">
            <img src="/logo.png" alt="FP" className="h-16 w-16 mx-auto mb-3"
              onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg' }} />
            <p className="text-xs font-bold uppercase tracking-widest text-brand-gold">Calcuta FP · Mundial 2026</p>
          </div>

          <h1 className="text-2xl font-black text-brand-navy mb-1">Acceso Moderador</h1>
          <p className="text-sm text-gray-400 mb-8">Ingresa el PIN para administrar la subasta</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">
                PIN de acceso
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                autoFocus
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-center text-2xl font-bold tracking-widest focus:border-brand-gold focus:outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-medium text-center">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !pin}
              className="btn-gold w-full justify-center py-3.5 text-base rounded-xl disabled:opacity-50">
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center mt-6">
            <a href="/public" className="text-xs text-gray-400 hover:text-gray-600 underline">
              Ir a la vista pública
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
