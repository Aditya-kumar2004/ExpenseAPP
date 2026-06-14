import { format } from 'date-fns'

export default function MemberList({ memberships }) {
  if (!memberships?.length) {
    return <p className="text-sm text-slate-500">No members yet.</p>
  }

  const fmt = (d) => d ? format(new Date(d), 'MMM d, yyyy') : null

  return (
    <div className="space-y-2">
      {memberships.map((m) => {
        const isActive = !m.leftAt
        return (
          <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-800 border border-surface-700">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${isActive ? 'bg-brand-700 text-white' : 'bg-surface-700 text-slate-500'}`}>
                {m.user?.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">{m.user?.name}</p>
                <p className="text-xs text-slate-500">{m.user?.email}</p>
              </div>
            </div>
            <div className="text-right text-xs">
              {isActive ? (
                <span className="badge-green">Active</span>
              ) : (
                <span className="badge-gray">Left</span>
              )}
              <div className="text-slate-500 mt-1 space-y-0.5">
                <p>Joined {fmt(m.joinedAt)}</p>
                {m.leftAt && <p className="text-red-400">Left {fmt(m.leftAt)}</p>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
