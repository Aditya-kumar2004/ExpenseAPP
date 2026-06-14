import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import SplitEditor from '../components/SplitEditor'
import { format } from 'date-fns'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY']
const SPLIT_TYPES = ['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES']

const SPLIT_TYPE_DESC = {
  EQUAL:      'Divide equally among selected members',
  EXACT:      'Specify exact amount per person',
  PERCENTAGE: 'Specify percentage per person (must total 100%)',
  SHARES:     'Specify unit shares (amounts computed proportionally)',
}

export default function NewExpensePage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [group, setGroup]     = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    description: '',
    amount: '',
    currency: 'INR',
    date: format(new Date(), 'yyyy-MM-dd'),
    paidById: '',
    splitType: 'EQUAL',
  })

  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [splitEntries, setSplitEntries] = useState([])

  useEffect(() => {
    api.get(`/groups/${id}`)
      .then(r => {
        setGroup(r.data.data)
        const activeMembers = r.data.data.memberships
          .filter(m => !m.leftAt)
          .map(m => m.user)
        setMembers(activeMembers)
        setSelectedMemberIds(activeMembers.map(m => m.id))
      })
      .catch(() => toast.error('Failed to load group'))
  }, [id])

  const buildSplitData = () => {
    switch (form.splitType) {
      case 'EQUAL':
        return { memberIds: selectedMemberIds }
      case 'EXACT':
      case 'PERCENTAGE':
      case 'SHARES':
        return { entries: splitEntries }
      default:
        return { memberIds: selectedMemberIds }
    }
  }

  const handle = async (e) => {
    e.preventDefault()

    if (!form.paidById) return toast.error('Select who paid')
    if (form.splitType === 'EQUAL' && selectedMemberIds.length === 0) {
      return toast.error('Select at least one member for equal split')
    }

    setLoading(true)
    try {
      const splitData = buildSplitData()
      await api.post(`/groups/${id}/expenses`, {
        ...form,
        amount: parseFloat(form.amount),
        splitData,
      })
      toast.success('Expense added!')
      navigate(`/groups/${id}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add expense')
    } finally {
      setLoading(false)
    }
  }

  if (!group) {
    return <div className="page-wrapper"><p className="text-slate-400">Loading…</p></div>
  }

  return (
    <div className="page-wrapper max-w-2xl">
      <div className="mb-6">
        <Link to={`/groups/${id}`} className="text-sm text-slate-500 hover:text-slate-300">
          ← {group.name}
        </Link>
        <h1 className="page-title mt-2">Add Expense</h1>
      </div>

      <form onSubmit={handle} className="space-y-5">
        {/* Description */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Expense Details</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="exp-desc" className="label">Description</label>
              <input id="exp-desc" type="text" required placeholder="Dinner, Groceries, etc."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="input" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="exp-amount" className="label">Amount</label>
                <input id="exp-amount" type="number" required min="0.01" step="0.01" placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="input" />
              </div>
              <div>
                <label htmlFor="exp-currency" className="label">Currency</label>
                <select id="exp-currency" value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="input">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {form.currency !== group.currency && (
              <p className="text-xs text-brand-400">
                Amount will be converted from {form.currency} to {group.currency} using current exchange rate.
              </p>
            )}

            <div>
              <label htmlFor="exp-date" className="label">Date</label>
              <input id="exp-date" type="date" required
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="input" />
            </div>

            <div>
              <label htmlFor="exp-paidby" className="label">Paid by</label>
              <select id="exp-paidby" required value={form.paidById}
                onChange={e => setForm(f => ({ ...f, paidById: e.target.value }))}
                className="input">
                <option value="">Select member…</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Split type */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">How to Split?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {SPLIT_TYPES.map(t => (
              <button key={t} type="button"
                onClick={() => setForm(f => ({ ...f, splitType: t }))}
                className={`p-2.5 rounded-xl border text-xs font-semibold transition-all
                  ${form.splitType === t
                    ? 'border-brand-600 bg-brand-900/30 text-brand-300'
                    : 'border-surface-700 bg-surface-800 text-slate-400 hover:border-surface-600'}`}>
                {t}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mb-4">{SPLIT_TYPE_DESC[form.splitType]}</p>

          <SplitEditor
            splitType={form.splitType}
            members={members}
            selectedMemberIds={selectedMemberIds}
            onSelectedMembersChange={setSelectedMemberIds}
            splitEntries={splitEntries}
            onSplitEntriesChange={setSplitEntries}
            totalAmount={parseFloat(form.amount) || 0}
          />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(`/groups/${id}`)} className="btn-secondary flex-1">
            Cancel
          </button>
          <button id="add-expense-submit" type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Adding…' : 'Add Expense'}
          </button>
        </div>
      </form>
    </div>
  )
}
