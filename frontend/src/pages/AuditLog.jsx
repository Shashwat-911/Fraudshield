import { useEffect, useState } from 'react'
import axios from 'axios'
import { ScrollText, RefreshCw, Loader2, CheckCircle, AlertTriangle, Info } from 'lucide-react'

const API = 'http://localhost:8000/api'

const ACTION_STYLES = {
  FLAGGED_FRAUD: {
    icon: AlertTriangle,
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-800'
  },
  APPROVED: {
    icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-900/20 border-green-800'
  },
  CHARGEBACK_GENERATED: {
    icon: ScrollText,
    color: 'text-blue-400',
    bg: 'bg-blue-900/20 border-blue-800'
  },
  MODEL_RETRAINED: {
    icon: Info,
    color: 'text-purple-400',
    bg: 'bg-purple-900/20 border-purple-800'
  },
}

function ActionBadge({ action }) {
  const style = ACTION_STYLES[action] ?? {
    icon: Info,
    color: 'text-slate-400',
    bg: 'bg-slate-800 border-slate-700'
  }
  const Icon = style.icon
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full 
                     border text-xs font-medium w-fit ${style.bg} ${style.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {action.replace(/_/g, ' ')}
    </div>
  )
}

export default function AuditLog() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [filter, setFilter]   = useState('all')

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/audit`)
      setLogs(data)
      setError(null)
    } catch {
      setError('Could not load audit logs. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [])

  const actions = ['all', ...Object.keys(ACTION_STYLES)]

  const filtered = logs.filter(log => {
    if (filter === 'all') return true
    return log.action === filter
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
      <Loader2 className="animate-spin w-6 h-6" />
      Loading audit logs...
    </div>
  )

  if (error) return (
    <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 text-center">
      <p className="text-red-300">{error}</p>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-slate-400 text-sm mt-1">
            Every decision logged — {filtered.length} of {logs.length} entries
          </p>
        </div>
        <button onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 
                     hover:bg-slate-600 text-white rounded-lg text-sm transition">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {actions.map(a => (
          <button key={a} onClick={() => setFilter(a)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
              ${filter === a
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
            {a.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(ACTION_STYLES).map(([action, style]) => {
          const Icon = style.icon
          const count = logs.filter(l => l.action === action).length
          return (
            <div key={action}
              className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${style.color}`} />
                <span className="text-slate-400 text-xs">
                  {action.replace(/_/g, ' ')}
                </span>
              </div>
              <p className={`text-2xl font-bold ${style.color}`}>{count}</p>
            </div>
          )
        })}
      </div>

      {/* Log entries */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          No audit entries yet. Run a batch from the Dashboard.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <div key={log.id}
              className="bg-slate-800 border border-slate-700 rounded-xl 
                         p-4 flex items-start gap-4 hover:border-slate-600 
                         transition">

              {/* Left: action + transaction */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <ActionBadge action={log.action} />
                  <span className="font-mono text-xs text-slate-500">
                    {log.transaction_id}
                  </span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {log.reason}
                </p>
              </div>

              {/* Right: confidence + time */}
              <div className="text-right shrink-0">
                {log.confidence !== null && log.confidence !== undefined && (
                  <div className="mb-1">
                    <span className={`text-sm font-bold ${
                      log.confidence > 0.7 ? 'text-red-400' :
                      log.confidence > 0.4 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {(log.confidence * 100).toFixed(1)}%
                    </span>
                    <p className="text-slate-500 text-xs">confidence</p>
                  </div>
                )}
                <p className="text-slate-500 text-xs">
                  {new Date(log.created_at).toLocaleTimeString()}
                </p>
                <p className="text-slate-600 text-xs">
                  {new Date(log.created_at).toLocaleDateString()}
                </p>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  )
}
