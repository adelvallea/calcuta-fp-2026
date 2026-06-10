'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Gavel, Users, List,
  CreditCard, Trophy, Globe, Settings, Eye,
} from 'lucide-react'

const nav = [
  { href: '/dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/auction',      label: 'Subasta',         icon: Gavel },
  { href: '/participants', label: 'Participantes',   icon: Users },
  { href: '/lots',         label: 'Lotes',           icon: List },
  { href: '/payments',     label: 'Pagos',           icon: CreditCard },
  { href: '/results',      label: 'Resultados',      icon: Globe },
  { href: '/prizes',       label: 'Premios',         icon: Trophy },
  { href: '/settings',     label: 'Configuración',   icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-56 flex-col bg-brand-navy text-white shrink-0">

      {/* Hero foto grupal + logo */}
      <div className="relative border-b border-white/10 overflow-hidden" style={{ height: '110px' }}>
        {/* Foto grupal de fondo */}
        <img src="/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-top opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/30 to-brand-navy/90" />
        {/* Logo + texto */}
        <div className="relative z-10 flex items-center gap-3 px-4 py-4">
          <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-white/95 flex items-center justify-center shadow-lg">
            <img
              src="/logo.png"
              alt="FP"
              className="h-11 w-11 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg' }}
            />
          </div>
          <div>
            <p className="text-sm font-black tracking-wide text-white leading-tight">Calcuta FP</p>
            <p className="text-[10px] text-brand-gold font-semibold tracking-widest uppercase leading-tight">Mundial 2026</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-brand-gold/20 text-brand-gold'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Vista pública */}
      <div className="border-t border-white/10 px-2 py-3">
        <Link
          href="/public"
          target="_blank"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/50 transition-all hover:bg-white/10 hover:text-white"
        >
          <Eye className="h-4 w-4" />
          Vista pública
        </Link>
      </div>
    </aside>
  )
}
