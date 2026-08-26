import { Link, useLocation } from 'react-router-dom'
import { ShieldAlert, BarChart3, List, ScrollText } from 'lucide-react'

const links = [
  { to: '/',             label: 'Dashboard',    icon: BarChart3   },
  { to: '/transactions', label: 'Transactions', icon: List        },
  { to: '/audit',        label: 'Audit Log',    icon: ScrollText  },
]

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">

        <div className="flex items-center gap-2">
          <ShieldAlert className="text-blue-400 w-7 h-7" />
          <span className="text-white font-bold text-xl tracking-tight">
            Fraud<span className="text-blue-400">Shield</span>
          </span>
          <span className="ml-2 text-xs text-slate-400 border border-slate-600 
                           rounded px-2 py-0.5">
            AI Risk Manager
          </span>
        </div>

        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm 
                          font-medium transition-colors
                          ${pathname === to
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                          }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-slate-400">Live</span>
        </div>

      </div>
    </nav>
  )
}
