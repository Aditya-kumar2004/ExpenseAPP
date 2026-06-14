import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function ExpenseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [expense, setExpense]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api.get(`/expenses/${id}`)
      .then(r => setExpense(r.data.data))
      .catch(() => toast.error('Expense not found'))
      .finally(() => setLoading(false))
  }, [id])

  const softDelete = async () => {
    if (!window.confirm('Delete this expense? (soft delete — it can be recovered)')) return
    setDeleting(true)
    try {
      await api.delete(`/expenses/${id}`)
      toast.success('Expense deleted')
      navigate(`/groups/${expense.groupId}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className="page-wrapper"><p className="text-slate-400">Loading…</p></div>
  if (!expense) return <div className="page-wrapper"><p className="text-red-400">Expense not found</p></div>

  const fmt = new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: expense.group?.currency || 'INR', maximumFractionDigits: 2,
  }).format

  return (
    <div className="page-wrapper max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to={`/groups/${expense.groupId}`} className="hover:text-slate-300">
          {expense.group?.name}
        </Link>
        <span>›</span>
        <Link to={`/groups/${expense.groupId}/expenses`} className="hover:text-slate-300">
          Expenses
        </Link>
        <span>›</span>
        <span className="text-slate-300 truncate">{expense.description}</span>
      </div>

      {/* Header */}
      <div className="card mb-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="page-title">{expense.description}</h1>
              {expense.isDeleted && <span className="badge-red">Deleted</span>}
            </div>
            <p className="text-slate-400 text-sm">
              {expense.date ? format(new Date(expense.date), 'MMMM d, yyyy') : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-100">{fmt(expense.amountInGroupCurrency)}</p>
            {expense.currency !== expense.group?.currency && (
              <p className="text-xs text-brand-400 mt-0.5">
                Originally {expense.currency} {expense.amount}
                <br />
                Rate: 1 {expense.currency} = {expense.exchangeRate?.toFixed(4)} {expense.group?.currency}
              </p>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 border-t border-surface-800">
          <div>
            <p className="text-xs text-slate-500 mb-1">Paid by</p>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-brand-700 text-white flex items-center justify-center text-xs font-bold">
                {expense.paidBy?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-200">{expense.paidBy?.name}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Split type</p>
            <span className={`badge ${expense.splitType === 'EQUAL' ? 'badge-blue' : expense.splitType === 'PERCENTAGE' ? 'badge-green' : 'badge-purple'}`}>
              {expense.splitType}
            </span>
          </div>
          {expense.originalRowIndex !== null && expense.originalRowIndex !== undefined && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Import row</p>
              <span className="badge-gray">Row #{expense.originalRowIndex + 1}</span>
            </div>
          )}
        </div>
      </div>

      {/* Splits */}
      <div className="card mb-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Split Breakdown</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Amount</th>
                {expense.splitType === 'PERCENTAGE' && <th>%</th>}
                {expense.splitType === 'SHARES'     && <th>Shares</th>}
              </tr>
            </thead>
            <tbody>
              {expense.splits?.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-slate-400">
                        {s.user?.name?.[0]?.toUpperCase()}
                      </div>
                      {s.user?.name}
                    </div>
                  </td>
                  <td className="font-semibold">{fmt(s.amount)}</td>
                  {expense.splitType === 'PERCENTAGE' && <td>{s.percentage?.toFixed(1)}%</td>}
                  {expense.splitType === 'SHARES'     && <td>{s.shares}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      {!expense.isDeleted && (
        <div className="flex gap-3">
          <button onClick={softDelete} disabled={deleting} className="btn-danger">
            {deleting ? 'Deleting…' : '🗑 Delete Expense'}
          </button>
        </div>
      )}
    </div>
  )
}
