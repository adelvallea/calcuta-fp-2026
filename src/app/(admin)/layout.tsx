import Sidebar from '@/components/layout/Sidebar'
import { Toaster } from 'react-hot-toast'
import { RulesButton } from '@/components/ui/RulesModal'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar con botón de reglas */}
        <div className="flex items-center justify-end gap-3 border-b border-gray-100 bg-white px-6 py-2 shrink-0">
          <RulesButton />
        </div>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontSize: '14px' },
          success: { iconTheme: { primary: '#27ae60', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#c0392b', secondary: '#fff' } },
        }}
      />
    </div>
  )
}
