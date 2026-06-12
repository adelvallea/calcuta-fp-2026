'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import {
  LayoutDashboard, Gavel, Users, List,
  CreditCard, Trophy, Globe, Settings, Eye, LogOut, Menu, X, UserCircle, Lock, Store,
} from 'lucide-react'

const nav = [
  { href: '/dashboard',    label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/mi-perfil',    label: 'Mi Perfil',        icon: UserCircle },
  { href: '/auction',      label: 'Subasta',           icon: Gavel },
  { href: '/participants', label: 'FParticipantes',    icon: Users },
  { href: '/lots',         label: 'Lotes',             icon: List },
  { href: '/payments',     label: 'FPagos',            icon: CreditCard },
  { href: '/mercado',      label: 'Mercado Sec.',       icon: Store },
  { href: '/results',      label: 'Resultados',        icon: Globe },
  { href: '/prizes',       label: 'FPremios',          icon: Trophy },
  { href: '/settings',     label: 'Configuración',     icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isAdmin = useIsAdmin()

  const NavContent = () => (
    <>
      {/* Logo + hero */}
      <div className="relative border-b border-white/10 overflow-hidden shrink-0" style={{ height: '130px' }}>
        <img src="/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/30 to-brand-navy/90" />
        <div className="relative z-10 flex items-center gap-3 px-4 py-4">
          <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-white/95 flex items-center justify-center shadow-lg">
            <img src="/logo.png" alt="FP" className="h-14 w-14 object-contain"
              onError={e => { (e.target as HTMLImageElement).src = '/logo.svg' }} />
          </div>
          <div>
            <p className="text-sm font-black tracking-wide text-white leading-tight">Calcuta FP</p>
            <p className="text-[10px] text-brand-gold font-semibold tracking-widest uppercase leading-tight">Mundial 2026</p>
            {isAdmin
              ? <span className="text-[9px] bg-brand-gold/30 text-brand-gold rounded px-1.5 py-0.5 mt-1 inline-block">Moderador</span>
              : <span className="text-[9px] bg-white/10 text-white/40 rounded px-1.5 py-0.5 mt-1 inline-block">Viewer</span>
            }
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active ? 'bg-brand-gold/20 text-brand-gold' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-2 py-3 space-y-0.5 shrink-0">
        <Link href="/public" target="_blank"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white transition-all">
          <Eye className="h-4 w-4" />
          Vista pública
        </Link>
        {isAdmin ? (
          <button onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.reload()
          }} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/30 hover:bg-white/10 hover:text-white/70 transition-all">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        ) : (
          <Link href="/login" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/30 hover:bg-white/10 hover:text-white/70 transition-all">
            <Lock className="h-4 w-4" />
            Acceso moderador
          </Link>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* DESKTOP */}
      <aside className="hidden md:flex h-full w-56 flex-col bg-brand-navy text-white shrink-0">
        <NavContent />
      </aside>

      {/* MÓVIL */}
      <div className="md:hidden">
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-brand-navy px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="FP" className="h-8 w-8 rounded-lg bg-white/95 p-0.5"
              onError={e => { (e.target as HTMLImageElement).src = '/logo.svg' }} />
            <div>
              <p className="text-[10px] font-black text-white leading-tight">Calcuta FP</p>
              <p className="text-[8px] text-brand-gold uppercase tracking-widest">Mundial 2026</p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(v => !v)}
            className="rounded-lg bg-white/10 p-2 text-white">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        <div className="h-14" />
        {mobileOpen && (
          <div className="fixed inset-0 z-30 flex" onClick={() => setMobileOpen(false)}>
            <div className="w-64 flex flex-col bg-brand-navy text-white h-full shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <NavContent />
            </div>
            <div className="flex-1 bg-black/50" />
          </div>
        )}
      </div>
    </>
  )
}
