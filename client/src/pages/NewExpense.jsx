import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Spinner from '../components/Spinner';
import api from '../services/api';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED', 'AUD', 'CAD'];
const SPLIT_TYPES = ['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'];

export default function NewExpense() {
  const { id: groupId } = useParams();
  const navigate = useNavigate();

  const [group,   setGroup]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const [form, setForm] = useState({
    description: '',
    amount:      '',
    currency:    'INR',
    date:        new Date().toISOString().slice(0, 10),
    paidById:    '',
    splitType:   'EQUAL',
  });

  const [splits, setSplits] = useState([]);

  useEffect(() => {
    api.get(`/groups/${groupId}`)
      .then(r => {
        const g = r.data.data;
        setGroup(g);
        setForm(f => ({ ...f, currency: g.currency, paidById: '' }));
        // Initialise splits for all active members
        const activeMembers = g.memberships?.filter(m => !m.leftAt) || [];
        setSplits(activeMembers.map(m => ({
          userId: m.userId,
          name:   m.user?.name || m.userId,
          amount: '',
          percentage: '',
          shares: '1',
        })));
      })
      .catch(() => setError('Failed to load group'))
      .finally(() => setLoading(false));
  }, [groupId]);

  const activeMembers = group?.memberships?.filter(m => !m.leftAt) || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const amount = parseFloat(form.amount);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount');

      const splitPayload = splits.map(s => {
        const base = { userId: s.userId };
        if (form.splitType === 'EXACT')      return { ...base, amount: parseFloat(s.amount) || 0 };
        if (form.splitType === 'PERCENTAGE') return { ...base, percentage: parseFloat(s.percentage) || 0 };
        if (form.splitType === 'SHARES')     return { ...base, shares: parseFloat(s.shares) || 1 };
        return base; // EQUAL — no extra fields needed
      });

      const { data } = await api.post(`/groups/${groupId}/expenses`, {
        description: form.description,
        amount,
        currency:  form.currency,
        date:      new Date(form.date).toISOString(),
        paidById:  form.paidById,
        splitType: form.splitType,
        splits:    splitPayload,
      });

      if (data.success) {
        navigate(`/groups/${groupId}`);
      } else {
        setError(data.error || 'Failed to create expense');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen"><Navbar /><div className="flex justify-center pt-24"><Spinner size="lg" /></div></div>;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10 page-enter">
        <div className="mb-8">
          <button onClick={() => navigate(`/groups/${groupId}`)} className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1 mb-4 transition-colors">
            ← Back to {group?.name}
          </button>
          <h1 className="text-2xl font-bold text-white">Add Expense</h1>
        </div>

        <div className="glass-card p-8">
          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Description */}
            <div>
              <label className="input-label">Description</label>
              <input id="expense-description" type="text" className="input" placeholder="e.g. Dinner at Taj" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required maxLength={500} />
            </div>

            {/* Amount + Currency */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="input-label">Amount</label>
                <input id="expense-amount" type="number" className="input" placeholder="0.00" step="0.01" min="0.01" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div>
                <label className="input-label">Currency</label>
                <select id="expense-currency" className="input" value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {group?.currency && form.currency !== group.currency && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                ⚡ This amount will be converted from {form.currency} to {group.currency} at today's rate.
              </p>
            )}

            {/* Date + Paid by */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Date</label>
                <input id="expense-date" type="date" className="input" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div>
                <label className="input-label">Paid by</label>
                <select id="expense-paidby" className="input" value={form.paidById}
                  onChange={e => setForm(f => ({ ...f, paidById: e.target.value }))} required>
                  <option value="">Select…</option>
                  {activeMembers.map(m => (
                    <option key={m.userId} value={m.userId}>{m.user?.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Split type */}
            <div>
              <label className="input-label">Split Type</label>
              <div className="grid grid-cols-4 gap-2">
                {SPLIT_TYPES.map(t => (
                  <button key={t} type="button"
                    className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                      form.splitType === t
                        ? 'bg-gradient-brand border-transparent text-white shadow-glow-sm'
                        : 'border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                    onClick={() => setForm(f => ({ ...f, splitType: t }))}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Split details (non-EQUAL only) */}
            {form.splitType !== 'EQUAL' && (
              <div>
                <label className="input-label">
                  {form.splitType === 'EXACT' ? 'Amount per person' : form.splitType === 'PERCENTAGE' ? 'Percentage per person' : 'Shares per person'}
                </label>
                <div className="space-y-2 mt-2">
                  {splits.map((s, i) => (
                    <div key={s.userId} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
                        {s.name[0]}
                      </div>
                      <span className="text-sm text-slate-300 w-28 truncate">{s.name}</span>
                      <input
                        type="number"
                        className="input flex-1"
                        placeholder={form.splitType === 'SHARES' ? '1' : '0'}
                        step={form.splitType === 'EXACT' ? '0.01' : '0.1'}
                        value={
                          form.splitType === 'EXACT'       ? s.amount :
                          form.splitType === 'PERCENTAGE'  ? s.percentage :
                          s.shares
                        }
                        onChange={e => setSplits(prev => prev.map((sp, j) => j === i
                          ? {
                              ...sp,
                              amount:     form.splitType === 'EXACT'      ? e.target.value : sp.amount,
                              percentage: form.splitType === 'PERCENTAGE' ? e.target.value : sp.percentage,
                              shares:     form.splitType === 'SHARES'     ? e.target.value : sp.shares,
                            }
                          : sp
                        ))}
                      />
                      {form.splitType === 'PERCENTAGE' && <span className="text-slate-500 text-sm">%</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate(`/groups/${groupId}`)} className="btn-secondary flex-1">Cancel</button>
              <button id="create-expense-submit" type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? <><div className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin" />Saving…</> : 'Add Expense'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
