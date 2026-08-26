import { useEffect, useState } from 'react'
import axios from 'axios'
import { ShieldX, ShieldCheck, FileText, Loader2, RefreshCw } from 'lucide-react'

const API = 'http://localhost:8000/api'

const FRAUD_TYPE_COLORS = {
  card_testing:     'bg-orange-900/40 text-orange-300 border-orange-700',
  account_takeover: 'bg-red-900/40 text-red-300 border-red-700',
  friendly_fraud:   'bg-yellow-900/40 text-yellow-300 border-yellow-700',
}

const FRAUD_TYPE_LABELS = {
  card_testing:     'Card Testing',
  account_takeover: 'Account Takeover',
  friendly_fraud:   'Friendly Fraud',
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [filter, setFilter]             = useState('all')
  const [generating, setGenerating]     = useState(null)
  const [letter, setLetter]             = useState(null)

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/transactions`)
      setTransactions(data)
      setError(null)
    } catch {
      setError('Could not load transactions. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTransactions() }, [])

  const generateChargeback = async (txId) => {
    setGenerating(txId)
    setLetter(null)
    try {
      const { data } = await axios.post(`${API}/chargeback/${txId}`)
      setLetter(data)
    } catch (e) {
      alert(e.response?.data?.detail ?? 'Failed to generate chargeback letter')
    } finally {
      setGenerating(null)
    }
  }

  const filtered = transactions.filter(tx => {
    if (filter === 'fraud') return tx.is_fraud === 1
    if (filter === 'clean') return tx.is_fraud === 0
    return true
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
      <Loader2 className="animate-spin w-6 h-6" />
      Loading transactions...
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
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-slate-400 text-sm mt-1">
            {filtered.length} of {transactions.length} transactions
          </p>
        </div>
        <button onClick={fetchTransactions}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 
                     hover:bg-slate-600 text-white rounded-lg text-sm transition">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['all', 'fraud', 'clean'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition
              ${filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Chargeback letter modal */}
      {letter && (
        <div className="bg-slate-800 border border-blue-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">
              Chargeback Dispute Letter
            </h2>
            <button onClick={() => setLetter(null)}
              className="text-slate-400 hover:text-white text-sm">
              ✕ Close
            </button>
          </div>
          <div className="bg-slate-900 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-2">
              Transaction: {letter.transaction_id} · 
              Type: {FRAUD_TYPE_LABELS[letter.fraud_type] ?? letter.fraud_type}
            </p>
            <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
              {letter.dispute_letter}
            </pre>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(letter.dispute_letter)}
            className="mt-3 text-xs text-blue-400 hover:underline">
            Copy to clipboard
          </button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          No transactions yet. Run a batch from the Dashboard.
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  {['Transaction ID','Amount','Method','Location',
                    'Hour','Velocity','Score','Status','Action'].map(h => (
                    <th key={h}
                      className="px-4 py-3 text-left text-slate-400 
                                 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx, i) => (
                  <tr key={tx.id}
                    className={`border-b border-slate-700/50 transition
                      ${tx.is_fraud
                        ? 'bg-red-900/10 hover:bg-red-900/20'
                        : 'hover:bg-slate-700/30'}`}>

                    <td className="px-4 py-3 font-mono text-xs text-slate-300">
                      {tx.id}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">
                      ₹{Number(tx.amount).toLocaleString('en-IN', 
                        { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-slate-300 capitalize">
                      {tx.payment_method}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {tx.location}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {tx.hour_of_day}:00
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {tx.transactions_last_hour}x/hr
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              tx.fraud_score > 0.7 ? 'bg-red-500' :
                              tx.fraud_score > 0.4 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${tx.fraud_score * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">
                          {(tx.fraud_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {tx.is_fraud ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-red-400">
                            <ShieldX className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">Flagged</span>
                          </div>
                          {tx.fraud_type && (
                            <span className={`text-xs px-1.5 py-0.5 rounded border
                              ${FRAUD_TYPE_COLORS[tx.fraud_type] ?? 
                                'bg-slate-700 text-slate-300 border-slate-600'}`}>
                              {FRAUD_TYPE_LABELS[tx.fraud_type] ?? tx.fraud_type}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-green-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Clean</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {tx.is_fraud && (
                        <button
                          onClick={() => generateChargeback(tx.id)}
                          disabled={generating === tx.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 
                                     bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                                     text-white rounded text-xs transition">
                          {generating === tx.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <FileText className="w-3 h-3" />}
                          Dispute
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
