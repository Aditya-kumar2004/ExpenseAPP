import { useState } from 'react'

/**
 * SplitEditor — dynamic split input based on split type.
 *
 * Props:
 *   splitType: 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES'
 *   members: [{ id, name }]
 *   selectedMemberIds: string[]
 *   onSelectedMembersChange: (ids: string[]) => void
 *   splitEntries: [{ userId, amount?, percentage?, shares? }]
 *   onSplitEntriesChange: (entries) => void
 *   totalAmount: number
 */
export default function SplitEditor({
  splitType,
  members,
  selectedMemberIds,
  onSelectedMembersChange,
  splitEntries,
  onSplitEntriesChange,
  totalAmount,
}) {
  const toggleMember = (id) => {
    if (selectedMemberIds.includes(id)) {
      onSelectedMembersChange(selectedMemberIds.filter(m => m !== id))
    } else {
      onSelectedMembersChange([...selectedMemberIds, id])
    }
  }

  const updateEntry = (userId, field, value) => {
    const existing = splitEntries.find(e => e.userId === userId)
    if (existing) {
      onSplitEntriesChange(splitEntries.map(e =>
        e.userId === userId ? { ...e, [field]: parseFloat(value) || 0 } : e
      ))
    } else {
      onSplitEntriesChange([...splitEntries, { userId, [field]: parseFloat(value) || 0 }])
    }
  }

  const getEntryValue = (userId, field) => {
    const e = splitEntries.find(e => e.userId === userId)
    return e?.[field] ?? ''
  }

  if (splitType === 'EQUAL') {
    const perPerson = selectedMemberIds.length > 0
      ? (totalAmount / selectedMemberIds.length).toFixed(2)
      : '0.00'

    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-400">
          Select members to split equally — each pays <span className="text-brand-300 font-semibold">₹{perPerson}</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMember(m.id)}
              className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm transition-all
                ${selectedMemberIds.includes(m.id)
                  ? 'border-brand-600 bg-brand-900/30 text-brand-300'
                  : 'border-surface-700 bg-surface-800 text-slate-400 hover:border-surface-600'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${selectedMemberIds.includes(m.id) ? 'bg-brand-600 text-white' : 'bg-surface-700 text-slate-400'}`}>
                {m.name[0].toUpperCase()}
              </div>
              <span className="truncate">{m.name}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (splitType === 'EXACT') {
    const sum = splitEntries.reduce((acc, e) => acc + (e.amount || 0), 0)
    const diff = (totalAmount - sum).toFixed(2)

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Enter exact amount per person</p>
          <p className={`text-xs font-semibold ${Math.abs(diff) < 0.01 ? 'text-emerald-400' : 'text-red-400'}`}>
            {Math.abs(diff) < 0.01 ? '✓ Sums match' : `Remaining: ₹${diff}`}
          </p>
        </div>
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
              {m.name[0].toUpperCase()}
            </div>
            <span className="text-sm text-slate-300 flex-1 truncate">{m.name}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={getEntryValue(m.id, 'amount')}
              onChange={e => updateEntry(m.id, 'amount', e.target.value)}
              className="input w-32 text-right"
            />
          </div>
        ))}
      </div>
    )
  }

  if (splitType === 'PERCENTAGE') {
    const sum = splitEntries.reduce((acc, e) => acc + (e.percentage || 0), 0)

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Enter percentage per person (must sum to 100%)</p>
          <p className={`text-xs font-semibold ${Math.abs(sum - 100) < 0.01 ? 'text-emerald-400' : 'text-red-400'}`}>
            {sum.toFixed(1)}%
          </p>
        </div>
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
              {m.name[0].toUpperCase()}
            </div>
            <span className="text-sm text-slate-300 flex-1 truncate">{m.name}</span>
            <div className="flex items-center gap-1">
              <input
                type="number" min="0" max="100" step="0.1" placeholder="0"
                value={getEntryValue(m.id, 'percentage')}
                onChange={e => updateEntry(m.id, 'percentage', e.target.value)}
                className="input w-24 text-right"
              />
              <span className="text-slate-400 text-sm">%</span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (splitType === 'SHARES') {
    const totalShares = splitEntries.reduce((acc, e) => acc + (e.shares || 0), 0)

    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-400">
          Enter share units — amounts are proportional. Total shares: <span className="text-brand-300 font-semibold">{totalShares}</span>
        </p>
        {members.map(m => {
          const shares = getEntryValue(m.id, 'shares') || 0
          const portion = totalShares > 0 ? ((shares / totalShares) * totalAmount).toFixed(2) : '0.00'

          return (
            <div key={m.id} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                {m.name[0].toUpperCase()}
              </div>
              <span className="text-sm text-slate-300 flex-1 truncate">{m.name}</span>
              <span className="text-xs text-slate-500 w-16 text-right">₹{portion}</span>
              <input
                type="number" min="0" step="1" placeholder="1"
                value={getEntryValue(m.id, 'shares')}
                onChange={e => updateEntry(m.id, 'shares', e.target.value)}
                className="input w-24 text-right"
              />
            </div>
          )
        })}
      </div>
    )
  }

  return null
}
