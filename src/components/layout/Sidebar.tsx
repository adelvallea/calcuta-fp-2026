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

      {/* Logo + nombre */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-white flex items-center justify-center">
          {/* Usa logo.png — reemplaza con la imagen real en /public/logo.png */}
          <img
            src="/logo.png"
            alt="Calcuta FP"
            className="h-9 w-9 object-contain"
            onError={(e) => {
              // Fallback: mostrar SVG con letras FP
              (e.target as HTMLImageElement).src = '/logo.svg'
            }}
          />
        </div>
        <div>
          <p className="text-xs font-black tracking-wide text-white leading-tight">
            Calcuta FP
          </p>
          <p className="text-[10px] text-brand-gold font-semibold tracking-widest uppercase leading-tight">
            Mundial 2026
          </p>
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
