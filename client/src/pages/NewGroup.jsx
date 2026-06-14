import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../services/api';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED', 'AUD', 'CAD'];

export default function NewGroup() {
  const navigate = useNavigate();
  const [form,    setForm]    = useState({ name: '', currency: 'INR' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/groups', form);
      if (data.success) {
        navigate(`/groups/${data.data.id}`);
      } else {
        setError(data.error || 'Failed to create group');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-10 page-enter">
        <div className="mb-8">
          <button
            onClick={() => navigate('/groups')}
            className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1.5 mb-4 transition-colors"
          >
            ← Back to groups
          </button>
          <h1 className="text-2xl font-bold text-white">Create a New Group</h1>
          <p className="text-slate-400 text-sm mt-1">A group is a shared space for tracking expenses.</p>
        </div>

        <div className="glass-card p-8">
          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="group-name" className="input-label">Group Name</label>
              <input
                id="group-name"
                type="text"
                className="input"
                placeholder="e.g. Goa Trip 2025"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                maxLength={200}
              />
            </div>

            <div>
              <label htmlFor="group-currency" className="input-label">Default Currency</label>
              <select
                id="group-currency"
                className="input"
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              >
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-2">
                All expense amounts are stored in this currency. Multi-currency expenses are converted automatically.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate('/groups')} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                id="create-group-submit"
                type="submit"
                className="btn-primary flex-1"
                disabled={loading || !form.name.trim()}
              >
                {loading ? (
                  <><div className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin" />Creating…</>
                ) : 'Create Group'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
