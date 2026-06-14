import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Spinner from '../components/Spinner';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function fmt(n, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

export default function GroupDashboard() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group,      setGroup]      = useState(null);
  const [expenses,   setExpenses]   = useState([]);
  const [balances,   setBalances]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [addEmail,   setAddEmail]   = useState('');
  const [addName,      setAddName]      = useState('');
  const [addJoinedAt,  setAddJoinedAt]  = useState('');
  const [addLeftAt,    setAddLeftAt]    = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError,   setAddError]   = useState('');
  const [activeTab,  setActiveTab]  = useState('expenses');

  const [editingUserId, setEditingUserId] = useState(null);
  const [editJoinedAt,  setEditJoinedAt]  = useState('');
  const [editLeftAt,    setEditLeftAt]    = useState('');
  const [editLoading,   setEditLoading]   = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/groups/${id}`),
      api.get(`/groups/${id}/expenses`),
      api.get(`/groups/${id}/balances`),
    ])
      .then(([g, e, b]) => {
        setGroup(g.data.data);
        setExpenses(e.data.data?.expenses || []);
        setBalances(b.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    try {
      const payload = {
        email: addEmail,
        name: addName || undefined,
        joinedAt: addJoinedAt ? new Date(addJoinedAt).toISOString() : undefined,
        leftAt: addLeftAt ? new Date(addLeftAt).toISOString() : undefined,
      };
      const { data } = await api.post(`/groups/${id}/members`, payload);
      if (data.success) {
        setGroup(g => {
          const exists = g.memberships.some(m => m.userId === data.data.userId);
          const newMemberships = exists
            ? g.memberships.map(m => m.userId === data.data.userId ? data.data : m)
            : [...(g.memberships || []), data.data];
          return { ...g, memberships: newMemberships };
        });
        setAddEmail('');
        setAddName('');
        setAddJoinedAt('');
        setAddLeftAt('');
        toast.success('Member added successfully');
      } else {
        setAddError(data.error || 'Failed to add member');
      }
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setAddLoading(false);
    }
  };

  const startEditing = (m) => {
    setEditingUserId(m.userId);
    setEditJoinedAt(m.joinedAt ? new Date(m.joinedAt).toISOString().split('T')[0] : '');
    setEditLeftAt(m.leftAt ? new Date(m.leftAt).toISOString().split('T')[0] : '');
  };

  const handleUpdateMember = async (uid) => {
    setEditLoading(true);
    try {
      const { data } = await api.put(`/groups/${id}/members/${uid}`, {
        joinedAt: editJoinedAt ? new Date(editJoinedAt).toISOString() : null,
        leftAt: editLeftAt ? new Date(editLeftAt).toISOString() : null,
      });
      if (data.success) {
        setGroup(g => ({
          ...g,
          memberships: g.memberships.map(m => m.userId === uid ? data.data : m),
        }));
        setEditingUserId(null);
        toast.success('Member dates updated successfully');
      } else {
        alert(data.error || 'Failed to update member');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update member');
    } finally {
      setEditLoading(false);
    }
  };

  const handleRemoveMember = async (uid) => {
    if (!confirm('Remove this member? Their expenses will remain.')) return;
    try {
      await api.delete(`/groups/${id}/members/${uid}`);
      setGroup(g => ({
        ...g,
        memberships: g.memberships.map(m =>
          m.userId === uid ? { ...m, leftAt: new Date().toISOString() } : m
        ),
      }));
      toast.success('Member removed');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleDeleteExpense = async (expId) => {
    if (!confirm('Soft-delete this expense?')) return;
    try {
      await api.delete(`/expenses/${expId}`);
      setExpenses(prev => prev.filter(e => e.id !== expId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete expense');
    }
  };

  if (loading) return (
    <div className="min-h-screen"><Navbar /><div className="flex justify-center pt-24"><Spinner size="lg" /></div></div>
  );

  if (!group) return (
    <div className="min-h-screen"><Navbar /><div className="text-center pt-24 text-slate-400">Group not found.</div></div>
  );

  const currency = group.currency || 'INR';
  const activeMembers = group.memberships?.filter(m => !m.leftAt) || [];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-10 page-enter">

        {/* Top bar */}
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <button onClick={() => navigate('/groups')} className="text-slate-400 hover:text-slate-200 text-sm mb-2 flex items-center gap-1 transition-colors">
              ← Groups
            </button>
            <h1 className="text-2xl font-bold text-white">{group.name}</h1>
            <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
              <span>{activeMembers.length} active member{activeMembers.length !== 1 ? 's' : ''} · {currency}</span>
              {activeMembers.length <= 1 && (
                <span className="text-amber-400 text-xs font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  ⚠️ Needs members
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {activeMembers.length > 1 ? (
              <>
                <Link to={`/groups/${id}/expenses/new`} id="add-expense-btn" className="btn-primary">+ Add Expense</Link>
                <Link to={`/groups/${id}/settle`} className="btn-secondary">Settle Up</Link>
                <Link to={`/groups/${id}/import`} className="btn-secondary">📄 Import CSV</Link>
              </>
            ) : (
              <button onClick={() => setActiveTab('members')} className="btn-primary">+ Add Members</button>
            )}
          </div>
        </div>

        {/* Balance overview */}
        {balances && (
          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            {balances.perMember?.map(({ user: u, balance }) => (
              <div key={u.id} className="glass-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold text-sm uppercase shrink-0">
                    {u.name?.[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                </div>
                <p className={`text-xl font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {balance >= 0 ? '+' : ''}{fmt(balance, currency)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {balance > 0.01 ? 'is owed' : balance < -0.01 ? 'owes' : 'settled up'}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Suggested settlements */}
        {balances?.transactions?.length > 0 && (
          <div className="glass-card p-6 mb-8">
            <p className="section-title mb-4">💡 Suggested Settlements</p>
            <div className="space-y-2">
              {balances.transactions.map((t, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="font-semibold text-slate-200">{t.from.name}</span>
                  <span className="text-slate-500">→</span>
                  <span className="font-semibold text-slate-200">{t.to.name}</span>
                  <span className="ml-auto text-emerald-400 font-bold">{fmt(t.amount, currency)}</span>
                  <Link
                    to={`/groups/${id}/settle`}
                    state={{ prefill: t }}
                    className="btn-success !px-3 !py-1 text-xs"
                  >
                    Record
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 glass-card w-fit">
          {['expenses', 'members'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 capitalize ${
                activeTab === tab
                  ? 'bg-gradient-brand text-white shadow-glow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Expenses tab */}
        {activeTab === 'expenses' && (
          <div className="space-y-3">
            {activeMembers.length <= 1 ? (
              <div className="glass-card p-12 text-center max-w-2xl mx-auto">
                <div className="text-5xl mb-4">👥</div>
                <h3 className="text-xl font-bold text-white mb-2">You are the only member!</h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
                  Before you can split expenses, record settlements, or import transactions, you need to add other members to this group.
                </p>
                <button
                  onClick={() => {
                    setActiveTab('members');
                    setTimeout(() => {
                      document.getElementById('add-member-form')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  className="btn-primary"
                >
                  ➕ Add Members Now
                </button>
              </div>
            ) : expenses.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <div className="text-4xl mb-3">🧾</div>
                <p className="text-slate-400">No expenses yet.</p>
                <Link to={`/groups/${id}/expenses/new`} className="btn-primary mt-4 inline-flex">Add First Expense</Link>
              </div>
            ) : expenses.map(exp => (
              <div key={exp.id} className="glass-card p-5 flex items-center gap-4 hover:border-white/20 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-surface-600 flex items-center justify-center shrink-0 text-lg">
                  💰
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/expenses/${exp.id}`}
                    className="font-semibold text-white hover:text-brand-300 transition-colors line-clamp-1"
                  >
                    {exp.description}
                  </Link>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(exp.date).toLocaleDateString()} · paid by {exp.paidBy?.name} · {exp.splitType}
                    {exp.originalRowIndex != null && ` · CSV row ${exp.originalRowIndex + 1}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-white">{fmt(exp.amountInGroupCurrency, currency)}</p>
                  {exp.currency !== currency && (
                    <p className="text-xs text-slate-500">{exp.currency} {exp.amount.toFixed(2)}</p>
                  )}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDeleteExpense(exp.id)}
                    className="btn-danger !px-2.5 !py-1.5 text-xs"
                    title="Soft delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Members tab */}
        {activeTab === 'members' && (
          <div>
            <div className="space-y-3 mb-6">
              {group.memberships?.map(m => (
                <div key={m.id}>
                  {editingUserId === m.userId ? (
                    <div className="glass-card p-5 flex flex-col gap-4 border border-brand-500/30">
                      <div className="flex items-center gap-4 w-full">
                        <div className="w-10 h-10 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold uppercase shrink-0">
                          {m.user?.name?.[0] || '?'}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-white">{m.user?.name}</p>
                          <p className="text-xs text-slate-500">{m.user?.email}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 font-semibold mb-1 block">Joined Date</label>
                          <input
                            type="date"
                            className="input text-xs !py-1.5 w-full"
                            value={editJoinedAt}
                            onChange={e => setEditJoinedAt(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-semibold mb-1 block">Left Date (Optional)</label>
                          <input
                            type="date"
                            className="input text-xs !py-1.5 w-full"
                            value={editLeftAt}
                            onChange={e => setEditLeftAt(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingUserId(null)}
                          className="btn-secondary !px-3 !py-1 text-xs"
                          disabled={editLoading}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUpdateMember(m.userId)}
                          className="btn-primary !px-3 !py-1 text-xs"
                          disabled={editLoading}
                        >
                          {editLoading ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="glass-card p-5 flex items-center gap-4 hover:border-white/20 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold uppercase shrink-0">
                        {m.user?.name?.[0] || '?'}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{m.user?.name}</p>
                        <p className="text-xs text-slate-500">
                          {m.user?.email} · Joined {new Date(m.joinedAt).toLocaleDateString()}
                          {m.leftAt ? ` · Left ${new Date(m.leftAt).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditing(m)}
                          className="btn-secondary !px-2.5 !py-1 text-xs"
                        >
                          Edit Dates
                        </button>
                        {!m.leftAt && m.userId !== user?.id && (
                          <button
                            onClick={() => handleRemoveMember(m.userId)}
                            className="btn-danger !px-2.5 !py-1 text-xs"
                          >
                            Remove
                          </button>
                        )}
                        {m.leftAt && <span className="badge badge-neutral">Left</span>}
                        {!m.leftAt && m.userId === user?.id && <span className="badge badge-positive">You</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add member form */}
            <div id="add-member-form" className="glass-card p-6">
              <p className="section-title mb-4">Add Member</p>
              {addError && (
                <p className="text-red-400 text-sm mb-3">{addError}</p>
              )}
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 font-semibold mb-1 block">Email Address (required)</label>
                    <input
                      type="email"
                      className="input w-full"
                      placeholder="member@example.com"
                      value={addEmail}
                      onChange={e => setAddEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-semibold mb-1 block">Name (optional)</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="e.g. Rohan"
                      value={addName}
                      onChange={e => setAddName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 font-semibold mb-1 block">Joined Date (optional)</label>
                    <input
                      type="date"
                      className="input w-full"
                      value={addJoinedAt}
                      onChange={e => setAddJoinedAt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-semibold mb-1 block">Left Date (optional)</label>
                    <input
                      type="date"
                      className="input w-full"
                      value={addLeftAt}
                      onChange={e => setAddLeftAt(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full" disabled={addLoading}>
                  {addLoading ? (
                    <div className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin mx-auto" />
                  ) : (
                    'Add Member'
                  )}
                </button>
              </form>
              <p className="text-xs text-slate-500 mt-2">
                If the user does not have a SPlit account, a guest profile will be automatically created with the password <strong>password123</strong>.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
