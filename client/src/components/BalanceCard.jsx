/**
 * BalanceCard — shows net balance for one member.
 * positive = they're owed money (green)
 * negative = they owe money (red)
 */
export default function BalanceCard({ user, amount, currency = 'INR' }) {
  const isPositive = amount > 0.01
  const isNegative = amount < -0.01
  const isSettled  = !isPositive && !isNegative

  const fmtAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(Math.abs(amount))

  return (
    <div className={`card-sm flex items-center justify-between transition-all duration-200
      ${isPositive ? 'border-emerald-800/50 bg-emerald-950/30' :
        isNegative ? 'border-red-800/50 bg-red-950/30' :
        'border-surface-700'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
          ${isPositive ? 'bg-emerald-600 text-white' :
            isNegative ? 'bg-red-600 text-white' :
            'bg-surface-700 text-slate-400'}`}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-200">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold
          ${isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-slate-500'}`}>
          {isSettled ? 'Settled' : (isPositive ? '+' : '−') + fmtAmount}
        </p>
        <p className="text-xs text-slate-500">
          {isPositive ? 'gets back' : isNegative ? 'owes' : ''}
        </p>
      </div>
    </div>
  )
}
