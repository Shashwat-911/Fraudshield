export default function ConfusionMatrix({ data }) {
  if (!data) return null

  const { matrix, labels, precision, recall, f1, auc_roc,
          fp_cost_inr, fn_cost_inr, total_cost_inr,
          train_samples, test_samples } = data

  const cells = [
    { label: 'True Negative',  value: matrix[0][0], color: 'bg-green-900/40 border-green-700', text: 'text-green-300', desc: 'Correctly approved' },
    { label: 'False Positive', value: matrix[0][1], color: 'bg-yellow-900/40 border-yellow-700', text: 'text-yellow-300', desc: 'Blocked incorrectly' },
    { label: 'False Negative', value: matrix[1][0], color: 'bg-red-900/40 border-red-700', text: 'text-red-300', desc: 'Fraud missed' },
    { label: 'True Positive',  value: matrix[1][1], color: 'bg-blue-900/40 border-blue-700', text: 'text-blue-300', desc: 'Fraud caught' },
  ]

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">Confusion Matrix</h2>
        <span className="text-xs text-slate-500">
          Test set: {test_samples} samples
        </span>
      </div>

      {/* Matrix grid */}
      <div className="grid grid-cols-2 gap-2">
        {cells.map((cell) => (
          <div key={cell.label}
            className={`border rounded-lg p-3 text-center ${cell.color}`}>
            <p className="text-slate-400 text-xs">{cell.label}</p>
            <p className={`text-3xl font-bold my-1 ${cell.text}`}>
              {cell.value}
            </p>
            <p className="text-slate-500 text-xs">{cell.desc}</p>
          </div>
        ))}
      </div>

      {/* Axis labels */}
      <div className="flex justify-between text-xs text-slate-500 px-1">
        <span>← Predicted Legitimate</span>
        <span>Predicted Fraud →</span>
      </div>

      {/* Cost breakdown */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="bg-slate-900 rounded-lg p-2 text-center">
          <p className="text-slate-500 text-xs">FP Cost</p>
          <p className="text-yellow-400 font-bold text-sm">
            ₹{fp_cost_inr?.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-slate-900 rounded-lg p-2 text-center">
          <p className="text-slate-500 text-xs">FN Cost</p>
          <p className="text-red-400 font-bold text-sm">
            ₹{fn_cost_inr?.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-slate-900 rounded-lg p-2 text-center">
          <p className="text-slate-500 text-xs">Total Cost</p>
          <p className="text-white font-bold text-sm">
            ₹{total_cost_inr?.toLocaleString('en-IN')}
          </p>
        </div>
      </div>
    </div>
  )
}
