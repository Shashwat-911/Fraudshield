import { useState } from 'react'
import axios from 'axios'
import {
  ShieldX, ShieldCheck, Loader2, Brain,
  AlertTriangle, CreditCard, Smartphone, Globe
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL

const DEFAULTS = {
  amount: 75000,
  merchant_id: 'MER-001',
  customer_id: 'CUST-1042',
  payment_method: 'card',
  location: 'Mumbai',
  device_type: 'mobile',
  hour_of_day: 2,
  transactions_last_hour: 8,
  is_new_device: true,
  amount_zscore: 3.2
}

const PRESETS = [
  {
    label: '🚨 Card Testing',
    description: 'High velocity, odd hours',
    values: {
      amount: 150,
      hour_of_day: 2,
      transactions_last_hour: 12,
      is_new_device: true,
      amount_zscore: 0.5,
      payment_method: 'card',
      location: 'Delhi',
      device_type: 'mobile'
    }
  },
  {
    label: '🔓 Account Takeover',
    description: 'New device, massive amount',
    values: {
      amount: 485000,
      hour_of_day: 3,
      transactions_last_hour: 2,
      is_new_device: true,
      amount_zscore: 4.8,
      payment_method: 'netbanking',
      location: 'Bangalore',
      device_type: 'desktop'
    }
  },
  {
    label: '✅ Legitimate',
    description: 'Normal shopping pattern',
    values: {
      amount: 2499,
      hour_of_day: 14,
      transactions_last_hour: 1,
      is_new_device: false,
      amount_zscore: 0.2,
      payment_method: 'upi',
      location: 'Pune',
      device_type: 'mobile'
    }
  },
  {
    label: '⚠️ Borderline',
    description: 'Ambiguous — watch the score',
    values: {
      amount: 28000,
      hour_of_day: 22,
      transactions_last_hour: 4,
      is_new_device: true,
      amount_zscore: 1.8,
      payment_method: 'card',
      location: 'Chennai',
      device_type: 'tablet'
    }
  }
]

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-slate-400 text-xs mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputCls = `w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 
                  text-white text-sm focus:outline-none focus:border-blue-500 transition`

const selectCls = `w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 
                   text-white text-sm focus:outline-none focus:border-blue-500 transition`

export default function Analyze() {
  const [form, setForm]       = useState(DEFAULTS)
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [history, setHistory] = useState([])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const applyPreset = (preset) => {
    setForm(f => ({ ...f, ...preset.values }))
    setResult(null)
  }

  const analyze = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        hour_of_day: parseInt(form.hour_of_day),
        transactions_last_hour: parseInt(form.transactions_last_hour),
        amount_zscore: parseFloat(form.amount_zscore),
        is_new_device: Boolean(form.is_new_device)
      }
      const { data } = await axios.post(`${API}/analyze`, payload)
      setResult(data)
      setHistory(h => [{ ...data, amount: form.amount }, ...h.slice(0, 4)])
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Analysis failed. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = (score) => {
    if (score > 0.7) return 'text-red-400'
    if (score > 0.4) return 'text-yellow-400'
    return 'text-green-400'
  }

  const scoreBarColor = (score) => {
    if (score > 0.7) return 'bg-red-500'
    if (score > 0.4) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Transaction Analyzer</h1>
        <p className="text-slate-400 text-sm mt-1">
          Test the ML model live — try presets or enter custom values
        </p>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PRESETS.map((preset) => (
          <button key={preset.label} onClick={() => applyPreset(preset)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-600 
                       hover:border-blue-500 rounded-xl p-3 text-left transition">
            <p className="text-white text-sm font-medium">{preset.label}</p>
            <p className="text-slate-400 text-xs mt-0.5">{preset.description}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Form */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-400" />
            Transaction Details
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (INR)">
              <input type="number" value={form.amount}
                onChange={e => set('amount', e.target.value)}
                className={inputCls} />
            </Field>
            <Field label="Amount Z-Score">
              <input type="number" step="0.1" value={form.amount_zscore}
                onChange={e => set('amount_zscore', e.target.value)}
                className={inputCls} />
            </Field>
            <Field label="Hour of Day (0-23)">
              <input type="number" min="0" max="23" value={form.hour_of_day}
                onChange={e => set('hour_of_day', e.target.value)}
                className={inputCls} />
            </Field>
            <Field label="Transactions Last Hour">
              <input type="number" min="0" value={form.transactions_last_hour}
                onChange={e => set('transactions_last_hour', e.target.value)}
                className={inputCls} />
            </Field>
            <Field label="Payment Method">
              <select value={form.payment_method}
                onChange={e => set('payment_method', e.target.value)}
                className={selectCls}>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="netbanking">Net Banking</option>
                <option value="wallet">Wallet</option>
              </select>
            </Field>
            <Field label="Device Type">
              <select value={form.device_type}
                onChange={e => set('device_type', e.target.value)}
                className={selectCls}>
                <option value="mobile">Mobile</option>
                <option value="desktop">Desktop</option>
                <option value="tablet">Tablet</option>
              </select>
            </Field>
            <Field label="Location">
              <select value={form.location}
                onChange={e => set('location', e.target.value)}
                className={selectCls}>
                {['Mumbai','Delhi','Bangalore','Chennai',
                  'Hyderabad','Kolkata','Pune','Ahmedabad'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="New Device?">
              <select value={form.is_new_device ? 'true' : 'false'}
                onChange={e => set('is_new_device', e.target.value === 'true')}
                className={selectCls}>
                <option value="false">No — known device</option>
                <option value="true">Yes — unrecognized</option>
              </select>
            </Field>
          </div>

          <button onClick={analyze} disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3
                       bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                       text-white rounded-lg font-medium transition">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
              : <><Brain className="w-4 h-4" /> Analyze Transaction</>}
          </button>

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Result */}
        <div className="space-y-4">
          {result ? (
            <div className={`border rounded-xl p-5 space-y-4 ${
              result.is_fraud
                ? 'bg-red-900/20 border-red-700'
                : 'bg-green-900/20 border-green-700'
            }`}>
              <div className="flex items-center gap-3">
                {result.is_fraud
                  ? <ShieldX className="w-8 h-8 text-red-400" />
                  : <ShieldCheck className="w-8 h-8 text-green-400" />}
                <div>
                  <p className={`text-xl font-bold ${
                    result.is_fraud ? 'text-red-300' : 'text-green-300'
                  }`}>
                    {result.is_fraud ? 'FRAUD DETECTED' : 'TRANSACTION APPROVED'}
                  </p>
                  <p className="text-slate-400 text-sm">
                    {result.transaction_id}
                  </p>
                </div>
              </div>

              {/* Score bar */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-slate-400 text-xs">Fraud Score</span>
                  <span className={`text-sm font-bold ${scoreColor(result.fraud_score)}`}>
                    {(result.fraud_score * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-700 ${
                      scoreBarColor(result.fraud_score)
                    }`}
                    style={{ width: `${result.fraud_score * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-slate-500">0% — Safe</span>
                  <span className="text-xs text-slate-500">50% threshold</span>
                  <span className="text-xs text-slate-500">100% — Fraud</span>
                </div>
              </div>

              {result.is_fraud && result.fraud_type && (
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Fraud Classification</p>
                  <p className="text-orange-300 font-medium capitalize">
                    {result.fraud_type.replace(/_/g, ' ').toUpperCase()}
                  </p>
                </div>
              )}

              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1">Audit Reason</p>
                <p className="text-slate-300 text-sm">{result.audit?.reason}</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 
                            flex flex-col items-center justify-center text-center h-64">
              <Brain className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-400">
                Fill in the transaction details and click Analyze
              </p>
              <p className="text-slate-500 text-sm mt-1">
                Or pick a preset to see the model in action
              </p>
            </div>
          )}

          {/* Recent history */}
          {history.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <h3 className="text-slate-400 text-xs font-medium mb-3 uppercase tracking-wide">
                Recent Analyses
              </h3>
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i}
                    className="flex items-center justify-between py-1.5 
                               border-b border-slate-700/50 last:border-0">
                    <div className="flex items-center gap-2">
                      {h.is_fraud
                        ? <ShieldX className="w-3.5 h-3.5 text-red-400" />
                        : <ShieldCheck className="w-3.5 h-3.5 text-green-400" />}
                      <span className="text-slate-300 text-xs font-mono">
                        {h.transaction_id}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-xs">
                        ₹{Number(h.amount).toLocaleString('en-IN')}
                      </span>
                      <span className={`text-xs font-bold ${scoreColor(h.fraud_score)}`}>
                        {(h.fraud_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
