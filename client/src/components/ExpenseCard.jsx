import { Link } from 'react-router-dom'
import { format } from 'date-fns'

const SPLIT_TYPE_COLORS = {
  EQUAL:      'badge-blue',
  EXACT:      'badge-purple',
  PERCENTAGE: 'badge-green',
  SHARES:     'badge-yellow',
}

export default function ExpenseCard({ expense, currency = 'INR' }) {
  const fmt = new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(expense.amountInGroupCurrency)

  return (
    <Link
      to={`/expenses/${expense.id}`}
      className={`block card-sm hover:border-brand-700 transition-all duration-200 group
        ${expense.isDeleted ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-slate-100 truncate group-hover:text-brand-300 transition-colors">
              {expense.description}
            </p>
            {expense.isDeleted && <span className="badge-gray text-xs">Deleted</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={SPLIT_TYPE_COLORS[expense.splitType] || 'badge-gray'}>
              {expense.splitType}
            </span>
            {expense.originalRowIndex !== null && expense.originalRowIndex !== undefined && (
              <span className="badge-gray">Row #{expense.originalRowIndex + 1}</span>
            )}
            <span className="text-xs text-slate-500">
              {expense.date ? format(new Date(expense.date), 'MMM d, yyyy') : '—'}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-base font-bold text-slate-100">{fmt}</p>
          <p className="text-xs text-slate-500">
            paid by <span className="text-slate-300">{expense.paidBy?.name}</span>
          </p>
          {expense.currency !== currency && (
            <p className="text-xs text-brand-400 mt-0.5">
              orig {expense.currency} {expense.amount}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
