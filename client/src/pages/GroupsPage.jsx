import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function GroupsPage() {
  const [groups, setGroups]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/groups')
      .then(r => setGroups(r.data.data))
      .catch(() => toast.error('Failed to load groups'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">My Groups</h1>
          <p className="page-subtitle">Manage shared expenses across all your groups</p>
        </div>
        <Link to="/groups/new" id="create-group-btn" className="btn-primary">
          + New Group
        </Link>
      </div>

      {/* Groups grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse h-40">
              <div className="h-4 bg-surface-700 rounded w-1/2 mb-3" />
              <div className="h-3 bg-surface-700 rounded w-1/3 mb-6" />
              <div className="h-3 bg-surface-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">💸</div>
          <h2 className="text-xl font-semibold text-slate-300 mb-2">No groups yet</h2>
          <p className="text-slate-500 mb-6">Create a group to start splitting expenses with friends</p>
          <Link to="/groups/new" className="btn-primary">Create your first group</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(g => (
            <Link
              key={g.id}
              to={`/groups/${g.id}`}
              className="card hover:border-brand-700 transition-all duration-200 group block"
            >
              {/* Currency badge */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-cyan-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {g.name[0].toUpperCase()}
                </div>
                <span className="badge-blue">{g.currency}</span>
              </div>

              <h3 className="text-base font-bold text-slate-100 mb-1 group-hover:text-brand-300 transition-colors">
                {g.name}
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Created {format(new Date(g.createdAt), 'MMM d, yyyy')}
              </p>

              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>{g.activeMemberCount || g.memberships?.filter(m => !m.leftAt).length || 0} members</span>
                <span>·</span>
                <span className="text-brand-400 group-hover:underline">View →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
