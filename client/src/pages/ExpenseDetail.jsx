import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Navbar from '../components/Navbar';
import Spinner from '../components/Spinner';

export default function ExpenseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/expenses/${id}`)
      .then(r => setExpense(r.data.data))
      .catch(() => toast.error('Expense not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const softDelete = async () => {
    if (!window.confirm('Delete this expense? (soft delete — it can be recovered)')) return;
    setDeleting(true);
    try {
      await api.delete(`/expenses/${id}`);
      toast.success('Expense deleted');
      navigate(`/groups/${expense.groupId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen">
      <Navbar />
      <div className="flex justify-center pt-24"><Spinner size="lg" /></div>
    </div>
  );

  if (!expense) return (
    <div className="min-h-screen">
      <Navbar />
      <div className="text-center pt-24 text-red-400">Expense not found</div>
    </div>
  );

  const fmt = new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: expense.group?.currency || 'INR', maximumFractionDigits: 2,
  }).format;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10 page-enter">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link to={`/groups/${expense.groupId}`} className="hover:text-slate-300">
            {expense.group?.name}
          </Link>
          <span>›</span>
          <span className="text-slate-300 truncate">{expense.description}</span>
        </div>

        {/* Header card */}
        <div className="glass-card p-6 mb-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-white">{expense.description}</h1>
                {expense.isDeleted && <span className="badge badge-negative">Deleted</span>}
              </div>
              <p className="text-slate-400 text-sm">
                {expense.date ? format(new Date(expense.date), 'MMMM d, yyyy') : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{fmt(expense.amountInGroupCurrency)}</p>
              {expense.currency !== expense.group?.currency && (
                <p className="text-xs text-brand-400 mt-1">
                  Originally {expense.currency} {expense.amount.toFixed(2)}
                  <br />
                  Rate: 1 {expense.currency} = {expense.exchangeRate?.toFixed(4)} {expense.group?.currency}
                </p>
              )}
            </div>
          </div>

          {/* Meta details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 border-t border-white/5 mt-6">
            <div>
              <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-semibold">Paid by</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-700 text-white flex items-center justify-center text-xs font-bold uppercase">
                  {expense.paidBy?.name?.[0]}
                </div>
                <span className="text-sm font-medium text-slate-200">{expense.paidBy?.name}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-semibold">Split type</p>
              <span className={`badge ${expense.splitType === 'EQUAL' ? 'badge-blue bg-blue-500/20 text-blue-400' : expense.splitType === 'PERCENTAGE' ? 'badge-positive' : 'badge-neutral'}`}>
                {expense.splitType}
              </span>
            </div>
            {expense.originalRowIndex !== null && expense.originalRowIndex !== undefined && (
              <div>
                <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-semibold">Import row</p>
                <span className="badge badge-neutral">Row #{expense.originalRowIndex + 1}</span>
              </div>
            )}
          </div>
        </div>

        {/* Splits card */}
        <div className="glass-card p-6 mb-5">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Split Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 font-semibold">
                  <th className="py-2.5">Member</th>
                  <th className="py-2.5">Amount</th>
                  {expense.splitType === 'PERCENTAGE' && <th className="py-2.5">%</th>}
                  {expense.splitType === 'SHARES'     && <th className="py-2.5">Shares</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {expense.splits?.map(s => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface-500 flex items-center justify-center text-xs font-bold text-slate-300 uppercase">
                          {s.user?.name?.[0]}
                        </div>
                        <span className="text-slate-200">{s.user?.name}</span>
                      </div>
                    </td>
                    <td className="py-3 font-semibold text-slate-100">{fmt(s.amount)}</td>
                    {expense.splitType === 'PERCENTAGE' && <td className="py-3 text-slate-400">{s.percentage?.toFixed(1)}%</td>}
                    {expense.splitType === 'SHARES'     && <td className="py-3 text-slate-400">{s.shares}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        {!expense.isDeleted && (
          <div className="flex gap-3">
            <button onClick={softDelete} disabled={deleting} className="btn-danger flex-1 sm:flex-initial">
              {deleting ? 'Deleting…' : '🗑 Delete Expense'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
