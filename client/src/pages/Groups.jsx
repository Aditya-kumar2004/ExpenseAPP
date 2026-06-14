import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Spinner from '../components/Spinner';
import api from '../services/api';

function fmt(n, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

export default function Groups() {
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get('/groups')
      .then(r => setGroups(r.data.data || []))
      .catch(e => setError(e.response?.data?.error || 'Failed to load groups'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-10 page-enter">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Your Groups</h1>
            <p className="text-slate-400 text-sm mt-1">Manage shared expenses across all your groups</p>
          </div>
          <Link to="/groups/new" id="create-group-btn" className="btn-primary">
            <span className="text-lg leading-none">+</span>
            New Group
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : error ? (
          <div className="glass-card p-6 text-red-400 text-center">{error}</div>
        ) : groups.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <div className="text-6xl mb-4">💸</div>
            <h2 className="text-xl font-semibold text-white mb-2">No groups yet</h2>
            <p className="text-slate-400 mb-6">Create your first group to start splitting expenses</p>
            <Link to="/groups/new" className="btn-primary">Create a Group</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map(group => {
              const activeMembers = group.memberships?.filter(m => !m.leftAt) || [];
              return (
                <Link
                  key={group.id}
                  to={`/groups/${group.id}`}
                  id={`group-card-${group.id}`}
                  className="glass-card p-6 hover:border-brand-500/40 hover:shadow-glow-sm transition-all duration-200 group block"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white group-hover:text-brand-300 transition-colors">
                        {group.name}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''}
                        {' · '}
                        {group.currency}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                      <span className="text-white font-bold text-lg">{group.name[0]}</span>
                    </div>
                  </div>

                  {/* Members avatars */}
                  <div className="flex -space-x-2">
                    {activeMembers.slice(0, 5).map(m => (
                      <div
                        key={m.id}
                        title={m.user?.name}
                        className="w-7 h-7 rounded-full bg-surface-500 border-2 border-surface-700 flex items-center justify-center text-xs font-bold text-slate-300 uppercase"
                      >
                        {m.user?.name?.[0] || '?'}
                      </div>
                    ))}
                    {activeMembers.length > 5 && (
                      <div className="w-7 h-7 rounded-full bg-surface-500 border-2 border-surface-700 flex items-center justify-center text-xs text-slate-400">
                        +{activeMembers.length - 5}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Created {new Date(group.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-brand-400 text-xs font-semibold group-hover:text-brand-300 transition-colors">
                      View →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
