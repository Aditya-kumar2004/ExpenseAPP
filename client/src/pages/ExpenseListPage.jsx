import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import ExpenseCard from '../components/ExpenseCard'

export default function ExpenseListPage() {
  const { id } = useParams()
  const [group, setGroup]           = useState(null)
  const [expenses, setExpenses]     = useState([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [showDeleted, setShowDeleted] = useState(false)
  const LIMIT = 20

  useEffect(() => {
    api.get(`/groups/${id}`).then(r => setGroup(r.data.data)).catch(() => {})
  }, [id])

  useEffect(() => {
    setLoading(true)
    api.get(`/groups/${id}/expenses`, { params: { page, limit: LIMIT, showDeleted } })
      .then(r => { setExpenses(r.data.data.expenses); setTotal(r.data.data.total) })
      .catch(() => toast.error('Failed to load expenses'))
      .finally(() => setLoading(false))
  }, [id, page, showDeleted])

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="page-wrapper">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to={`/groups/${id}`} className="hover:text-slate-300">← {group?.name}</Link>
          </div>
          <h1 className="page-title">All Expenses</h1>
          <p className="page-subtitle">{total} expenses</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={e => { setShowDeleted(e.target.checked); setPage(1) }}
              className="rounded"
            />
            Show deleted
          </label>
          <Link to={`/groups/${id}/expenses/new`} className="btn-primary">+ Add Expense</Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card-sm animate-pulse h-16">
              <div className="h-3 bg-surface-700 rounded w-1/2 mb-2" />
              <div className="h-3 bg-surface-700 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-slate-400">No expenses found</p>
          <Link to={`/groups/${id}/expenses/new`} className="btn-primary mt-4 inline-flex">
            Add first expense
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {expenses.map(e => (
              <ExpenseCard key={e.id} expense={e} currency={group?.currency || 'INR'} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-xs"
              >
                ← Prev
              </button>
              <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-xs"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
