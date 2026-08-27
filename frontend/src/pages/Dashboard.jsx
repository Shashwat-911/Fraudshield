import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  ShieldCheck, ShieldX, IndianRupee,
  Brain, RefreshCw, Loader2, Webhook
} from 'lucide-react'
import ConfusionMatrix from '../components/ConfusionMatrix'

const API = import.meta.env.VITE_API_URL
const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b']

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 
                    flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-slate-400 text-sm">{label}</p>
        <p className="text-white text-2xl font-bold">{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function MetricBadge({ label, value, color }) {
  return (
    <div className="bg-slate-900 rounded-lg p-3 text-center">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [batching, setBatching] = useState(false)
  const [batchResult, setBatchResult] = useState(null)
  const [error, setError]     = useState(null)
  const [confusion, setConfusion]     = useState(null)
  const [simulating, setSimulating]   = useState(false)
  const [simResult, setSimResult]     = useState(null)

  const fetchStats = async () => {
    try {
      const [dashRes, confRes] = await Promise.all([
        axios.get(`${API}/dashboard`),
        axios.get(`${API}/metrics/confusion`)
      ])
      setStats(dashRes.data)
      setConfusion(confRes.data)
      setError(null)
    } catch {
      setError('Backend offline. Start the FastAPI server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  const runBatch = async () => {
    setBatching(true)
    setBatchResult(null)
    try {
      const { data } = await axios.post(`${API}/batch?count=100`)
      setBatchResult(data)
      await fetchStats()
    } catch {
      setError('Batch failed. Is the backend running?')
    } finally {
      setBatching(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
      <Loader2 className="animate-spin w-6 h-6" />
      Connecting to FraudShield...
    </div>
  )

  if (error) return (
    <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 text-center">
      <ShieldX className="w-10 h-10 text-red-400 mx-auto mb-2" />
      <p className="text-red-300 font-medium">{error}</p>
      <button onClick={fetchStats}
        className="mt-3 text-sm text-blue-400 hover:underline">
        Retry
      </button>
    </div>
  )

  const pieData = stats ? [
    { name: 'Clean',   value: stats.total_transactions - stats.flagged_fraud },
    { name: 'Flagged', value: stats.flagged_fraud }
  ] : []

  const barData = stats ? [
    { name: 'Precision', value: stats.precision },
    { name: 'Recall',    value: stats.recall    },
    { name: 'F1 Score',  value: stats.f1        },
    { name: 'AUC-ROC',   value: stats.auc_roc   },
  ] : []

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time fraud detection overview
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchStats}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 
                       hover:bg-slate-600 text-white rounded-lg text-sm transition">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={runBatch} disabled={batching}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 
                       hover:bg-blue-500 disabled:opacity-50 text-white 
                       rounded-lg text-sm transition">
            {batching
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
              : <><Brain className="w-4 h-4" /> Run 100 Batch</>}
          </button>
          <button
            onClick={async () => {
              setSimulating(true)
              setSimResult(null)
              try {
                const { data } = await axios.post(
                  `${API}/webhook/simulate?scenario=payment.failed`
                )
                setSimResult(data)
                await fetchStats()
              } catch {
                setSimResult({ error: 'Simulation failed' })
              } finally {
                setSimulating(false)
              }
            }}
            disabled={simulating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 
                       hover:bg-purple-500 disabled:opacity-50 text-white 
                       rounded-lg text-sm transition">
            {simulating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Simulating...</>
              : <><Webhook className="w-4 h-4" /> Simulate Webhook</>}
          </button>
        </div>
      </div>

      {/* Batch result banner */}
      {batchResult && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4 
                        flex items-center justify-between">
          <div>
            <p className="text-blue-300 font-medium">Batch Complete</p>
            <p className="text-slate-400 text-sm">
              {batchResult.flagged} flagged out of {batchResult.batch_size} transactions
              · Flag rate: {(batchResult.flag_rate * 100).toFixed(1)}%
            </p>
          </div>
          <p className="text-green-400 font-bold text-lg">
            ₹{batchResult.total_amount_processed?.toLocaleString('en-IN', 
              { maximumFractionDigits: 0 })} processed
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ShieldCheck}
          label="Total Transactions"
          value={stats.total_transactions.toLocaleString()}
          sub="all time"
          color="bg-blue-600"
        />
        <StatCard
          icon={ShieldX}
          label="Fraud Flagged"
          value={stats.flagged_fraud.toLocaleString()}
          sub={`${stats.total_transactions
            ? ((stats.flagged_fraud/stats.total_transactions)*100).toFixed(1)
            : 0}% flag rate`}
          color="bg-red-600"
        />
        <StatCard
          icon={IndianRupee}
          label="Amount Blocked"
          value={`₹${(stats.amount_blocked/1000).toFixed(1)}K`}
          sub="INR protected"
          color="bg-green-600"
        />
        <StatCard
          icon={Brain}
          label="Avg Fraud Score"
          value={`${(stats.avg_fraud_score * 100).toFixed(1)}%`}
          sub="model confidence"
          color="bg-purple-600"
        />
      </div>

      {/* ML Metrics */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">
          ML Model Performance
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <MetricBadge label="Precision" 
            value={stats.precision?.toFixed(3)} color="text-blue-400" />
          <MetricBadge label="Recall"    
            value={stats.recall?.toFixed(3)}    color="text-green-400" />
          <MetricBadge label="F1 Score"  
            value={stats.f1?.toFixed(3)}        color="text-yellow-400" />
          <MetricBadge label="AUC-ROC"   
            value={stats.auc_roc?.toFixed(3)}   color="text-purple-400" />
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData}>
            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 1]} stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
              formatter={(v) => v.toFixed(4)}
            />
            <Bar dataKey="value" radius={[4,4,0,0]}>
              {barData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Webhook result banner */}
      {simResult && !simResult.error && (
        <div className="bg-purple-900/30 border border-purple-700 rounded-xl p-4
                        flex items-center justify-between">
          <div>
            <p className="text-purple-300 font-medium">
              Webhook Processed — {simResult.event}
            </p>
            <p className="text-slate-400 text-sm">
              Transaction: {simResult.transaction_id} · 
              Action: {simResult.action ?? 'ACKNOWLEDGED'}
            </p>
          </div>
          {simResult.fraud_analysis && (
            <p className={`font-bold text-lg ${
              simResult.fraud_analysis.is_fraud
                ? 'text-red-400' : 'text-green-400'
            }`}>
              {simResult.fraud_analysis.is_fraud ? '🚨 FRAUD' : '✅ CLEAN'}
            </p>
          )}
        </div>
      )}

      {/* Confusion matrix */}
      <ConfusionMatrix data={confusion} />

      {/* Pie + Cost */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">
            Transaction Breakdown
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" 
                   innerRadius={60} outerRadius={90}
                   dataKey="value" paddingAngle={3}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Pie>
              <Legend />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">
            False Positive Cost Analysis
          </h2>
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-lg p-4">
              <p className="text-slate-400 text-sm">False Positive Cost</p>
              <p className="text-yellow-400 text-2xl font-bold">
                ₹{stats.fp_cost_inr?.toLocaleString('en-IN') ?? '—'}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Good transactions incorrectly blocked (₹500 each)
              </p>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <p className="text-slate-400 text-sm">False Negative Cost</p>
              <p className="text-red-400 text-2xl font-bold">
                ₹{stats.fn_cost_inr?.toLocaleString('en-IN') ?? '—'}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Fraud missed by model (₹5,000 each)
              </p>
            </div>
            <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4">
              <p className="text-slate-400 text-sm">Net Model Value</p>
              <p className="text-green-400 text-2xl font-bold">
                ₹{stats.amount_blocked?.toLocaleString('en-IN', 
                  { maximumFractionDigits: 0 }) ?? '—'}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Total fraud value blocked
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
