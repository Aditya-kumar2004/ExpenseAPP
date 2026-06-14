/**
 * SimplifiedDebts — renders the minimum transaction list.
 * e.g. "Alice → Bob  ₹500"
 */
export default function SimplifiedDebts({ transactions, currency = 'INR' }) {
  if (!transactions?.length) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p className="text-2xl mb-2">🎉</p>
        <p className="text-sm font-medium">All settled up!</p>
      </div>
    )
  }

  const fmt = (n) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(n)

  return (
    <div className="space-y-2">
      {transactions.map((t, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-800 border border-surface-700">
          {/* From */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-full bg-red-900 text-red-300 flex items-center justify-center text-xs font-bold shrink-0">
              {t.from?.name?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-medium text-slate-200 truncate">{t.from?.name}</span>
          </div>

          {/* Arrow + Amount */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-slate-500 text-sm">→</div>
            <span className="badge-blue text-xs font-semibold">{fmt(t.amount)}</span>
            <div className="text-slate-500 text-sm">→</div>
          </div>

          {/* To */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-sm font-medium text-slate-200 truncate">{t.to?.name}</span>
            <div className="w-7 h-7 rounded-full bg-emerald-900 text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">
              {t.to?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
