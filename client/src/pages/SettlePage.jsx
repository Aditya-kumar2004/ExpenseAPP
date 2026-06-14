import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function SettlePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [group, setGroup]     = useState(null)
  const [members, setMembers] = useState([])
  const [balances, setBalances] = useState(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    fromUserId: '',
    toUserId:   '',
    amount:     '',
    date:       format(new Date(), 'yyyy-MM-dd'),
    note:       '',
    currency:   'INR',
  })

  useEffect(() => {
    Promise.all([
      api.get(`/groups/${id}`),
      api.get(`/groups/${id}/balances`),
    ]).then(([gR, bR]) => {
      setGroup(gR.data.data)
      setBalances(bR.data.data)
      setMembers(gR.data.data.memberships.map(m => m.user))
    }).catch(() => toast.error('Failed to load group'))
  }, [id])

  const prefillFromSuggested = (t) => {
    setForm(f => ({
      ...f,
      fromUserId: t.from.id,
      toUserId:   t.to.id,
      amount:     String(t.amount),
    }))
  }

  const handle = async (e) => {
    e.preventDefault()
    if (form.fromUserId === form.toUserId) return toast.error('From and To must be different people')

    setLoading(true)
    try {
      await api.post(`/groups/${id}/settlements`, form)
      toast.success('Settlement recorded!')
      navigate(`/groups/${id}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record settlement')
    } finally {
      setLoading(false)
    }
  }

  if (!group) return <div className="page-wrapper"><p className="text-slate-400">Loading…</p></div>

  return (
    <div className="page-wrapper max-w-lg">
      <div className="mb-6">
        <Link to={`/groups/${id}`} className="text-sm text-slate-500 hover:text-slate-300">← {group.name}</Link>
        <h1 className="page-title mt-2">Record Settlement</h1>
        <p className="page-subtitle">Mark a payment made between two members</p>
      </div>

      {/* Suggested settlements */}
      {balances?.transactions?.length > 0 && (
        <div className="card mb-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Quick fill from suggestions</h2>
          <div className="space-y-2">
            {balances.transactions.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => prefillFromSuggested(t)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-800 border border-surface-700 hover:border-brand-700 transition-all text-sm"
              >
                <span className="text-slate-300">
                  <span className="text-slate-100 font-medium">{t.from.name}</span>
                  {' → '}
                  <span className="text-slate-100 font-medium">{t.to.name}</span>
                </span>
                <span className="badge-blue font-semibold">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: group.currency }).format(t.amount)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <form onSubmit={handle} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="settle-from" className="label">From (payer)</label>
              <select id="settle-from" required value={form.fromUserId}
                onChange={e => setForm(f => ({ ...f, fromUserId: e.target.value }))}
                className="input">
                <option value="">Select…</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="settle-to" className="label">To (receiver)</label>
              <select id="settle-to" required value={form.toUserId}
                onChange={e => setForm(f => ({ ...f, toUserId: e.target.value }))}
                className="input">
                <option value="">Select…</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="settle-amount" className="label">Amount</label>
              <input id="settle-amount" type="number" required min="0.01" step="0.01" placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="input" />
            </div>
            <div>
              <label htmlFor="settle-date" className="label">Date</label>
              <input id="settle-date" type="date" required value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="input" />
            </div>
          </div>

          <div>
            <label htmlFor="settle-note" className="label">Note (optional)</label>
            <input id="settle-note" type="text" placeholder="UPI, cash, etc."
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="input" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate(`/groups/${id}`)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button id="settle-submit" type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Recording…' : '💸 Record Settlement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
