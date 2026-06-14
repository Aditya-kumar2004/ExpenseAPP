import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY']

export default function NewGroupPage() {
  const navigate = useNavigate()
  const [form, setForm]       = useState({ name: '', currency: 'INR' })
  const [loading, setLoading] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await api.post('/groups', form)
      toast.success(`Group "${form.name}" created!`)
      navigate(`/groups/${r.data.data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-wrapper max-w-lg">
      <div className="mb-8">
        <h1 className="page-title">Create Group</h1>
        <p className="page-subtitle">Set up a new group to track shared expenses</p>
      </div>

      <div className="card">
        <form onSubmit={handle} className="space-y-5">
          <div>
            <label htmlFor="group-name" className="label">Group name</label>
            <input
              id="group-name"
              type="text"
              required
              placeholder="Goa Trip 2024, Flatmates, etc."
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="group-currency" className="label">Group currency</label>
            <select
              id="group-currency"
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              className="input"
            >
              {CURRENCIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              All expenses will be converted to this currency for balance calculations.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button id="create-group-submit" type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
