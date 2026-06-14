import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Navbar from '../components/Navbar';
import Spinner from '../components/Spinner';

export default function Settle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [group, setGroup]       = useState(null);
  const [members, setMembers]   = useState([]);
  const [balances, setBalances] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [fetching, setFetching] = useState(true);

  const [form, setForm] = useState({
    fromUserId: '',
    toUserId:   '',
    amount:     '',
    date:       format(new Date(), 'yyyy-MM-dd'),
    note:       '',
    currency:   'INR',
  });

  useEffect(() => {
    Promise.all([
      api.get(`/groups/${id}`),
      api.get(`/groups/${id}/balances`),
    ]).then(([gR, bR]) => {
      const g = gR.data.data;
      setGroup(g);
      setBalances(bR.data.data);
      const activeMembers = g.memberships?.filter(m => !m.leftAt).map(m => m.user) || [];
      setMembers(activeMembers);

      // Check if there is a prefill passed in state
      const prefill = location.state?.prefill;
      setForm(f => ({
        ...f,
        currency: g.currency || 'INR',
        fromUserId: prefill?.from?.id || '',
        toUserId:   prefill?.to?.id || '',
        amount:     prefill?.amount ? String(prefill.amount) : '',
      }));
    })
    .catch(() => toast.error('Failed to load group data'))
    .finally(() => setFetching(false));
  }, [id, location.state]);

  const prefillFromSuggested = (t) => {
    setForm(f => ({
      ...f,
      fromUserId: t.from.id,
      toUserId:   t.to.id,
      amount:     String(t.amount),
    }));
    toast.success(`Filled suggestion: ${t.from.name} → ${t.to.name}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.fromUserId === form.toUserId) {
      return toast.error('Payer and receiver must be different members');
    }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      return toast.error('Please enter a valid amount');
    }

    setLoading(true);
    try {
      await api.post(`/groups/${id}/settlements`, {
        fromUserId: form.fromUserId,
        toUserId:   form.toUserId,
        amount:     amt,
        date:       new Date(form.date).toISOString(),
        note:       form.note,
        currency:   form.currency,
      });
      toast.success('Settlement recorded successfully!');
      navigate(`/groups/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record settlement');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div className="min-h-screen">
      <Navbar />
      <div className="flex justify-center pt-24"><Spinner size="lg" /></div>
    </div>
  );

  if (!group) return (
    <div className="min-h-screen">
      <Navbar />
      <div className="text-center pt-24 text-red-400">Group not found</div>
    </div>
  );

  const currency = group.currency || 'INR';

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-10 page-enter">
        <div className="mb-6">
          <button onClick={() => navigate(`/groups/${id}`)} className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1 mb-4 transition-colors">
            ← Back to {group.name}
          </button>
          <h1 className="text-2xl font-bold text-white">Record Settlement</h1>
          <p className="text-slate-400 text-sm mt-1">Mark a payment made between two members to settle debts</p>
        </div>

        {/* Suggested settlements */}
        {balances?.transactions?.length > 0 && (
          <div className="glass-card p-6 mb-6">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">💡 Suggested Settlements</h2>
            <div className="space-y-2">
              {balances.transactions.map((t, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => prefillFromSuggested(t)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-surface-600/30 border border-white/5 hover:border-brand-500/50 hover:bg-surface-500/30 transition-all text-sm group"
                >
                  <span className="text-slate-300">
                    <span className="text-white font-medium group-hover:text-brand-300 transition-colors">{t.from.name}</span>
                    <span className="text-slate-500 mx-2">→</span>
                    <span className="text-white font-medium group-hover:text-brand-300 transition-colors">{t.to.name}</span>
                  </span>
                  <span className="badge badge-positive font-bold bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(t.amount)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Settlement Form */}
        <div className="glass-card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="settle-from" className="input-label">From (Payer)</label>
                <select
                  id="settle-from"
                  required
                  value={form.fromUserId}
                  onChange={e => setForm(f => ({ ...f, fromUserId: e.target.value }))}
                  className="input"
                >
                  <option value="">Select…</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="settle-to" className="input-label">To (Receiver)</label>
                <select
                  id="settle-to"
                  required
                  value={form.toUserId}
                  onChange={e => setForm(f => ({ ...f, toUserId: e.target.value }))}
                  className="input"
                >
                  <option value="">Select…</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="settle-amount" className="input-label">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-500 text-sm font-semibold">{currency}</span>
                  <input
                    id="settle-amount"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="input pl-14"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="settle-date" className="input-label">Date</label>
                <input
                  id="settle-date"
                  type="date"
                  required
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label htmlFor="settle-note" className="input-label">Note (optional)</label>
              <input
                id="settle-note"
                type="text"
                placeholder="e.g. UPI, cash payment, Bank transfer"
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="input"
              />
            </div>

            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => navigate(`/groups/${id}`)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button id="settle-submit" type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? <div className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin" /> : '💸 Record Settlement'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
