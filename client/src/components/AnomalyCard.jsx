import { useState } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'

const TYPE_LABELS = {
  DUPLICATE_ROW:             { label: 'Duplicate Row',            color: 'orange' },
  DUPLICATE_AMOUNT_MISMATCH: { label: 'Amount Mismatch',          color: 'amber' },
  NEGATIVE_AMOUNT:           { label: 'Negative Amount',          color: 'red' },
  ZERO_AMOUNT:               { label: 'Zero Amount',              color: 'gray' },
  MISSING_REQUIRED_FIELD:    { label: 'Missing Field',            color: 'red' },
  INVALID_DATE:              { label: 'Invalid Date',             color: 'red' },
  FUTURE_DATE:               { label: 'Future Date',              color: 'yellow' },
  UNKNOWN_MEMBER:            { label: 'Unknown Member',           color: 'purple' },
  MEMBER_NOT_ACTIVE:         { label: 'Member Not Active',        color: 'purple' },
  CURRENCY_MISMATCH:         { label: 'Currency Mismatch',        color: 'blue' },
  SETTLEMENT_AS_EXPENSE:     { label: 'Settlement as Expense',   color: 'teal' },
  SPLIT_SUM_MISMATCH:        { label: 'Split Sum Mismatch',       color: 'pink' },
  INVALID_SPLIT_TYPE:        { label: 'Invalid Split Type',       color: 'rose' },
}

export default function AnomalyCard({ anomaly, sessionId, onResolved }) {
  const [loading, setLoading] = useState(false)
  const [resolved, setResolved] = useState(!!anomaly.userAction)
  const [action, setAction]   = useState(anomaly.userAction)

  const meta = TYPE_LABELS[anomaly.anomalyType] || { label: anomaly.anomalyType, color: 'gray' }

  const resolve = async (userAction) => {
    setLoading(true)
    try {
      await api.put(`/import/${sessionId}/anomalies/${anomaly.id}`, { userAction })
      setAction(userAction)
      setResolved(true)
      onResolved?.(anomaly.id, userAction)
      toast.success(`Marked as ${userAction}`)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to resolve')
    } finally {
      setLoading(false)
    }
  }

  const rowData = anomaly.rowData || {}

  return (
    <div className={`card border-l-4 transition-all duration-200
      ${resolved
        ? action === 'APPROVE' ? 'border-l-emerald-500 opacity-75' :
          action === 'REJECT'  ? 'border-l-red-500 opacity-75' :
          'border-l-yellow-500 opacity-75'
        : `anomaly-border-${meta.color} border-l-orange-500`}`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`anomaly-${anomaly.anomalyType}`}>{meta.label}</span>
          <span className="badge-gray">Row #{anomaly.rowIndex + 1}</span>
          {resolved && (
            <span className={
              action === 'APPROVE' ? 'badge-green' :
              action === 'REJECT'  ? 'badge-red' :
              'badge-yellow'
            }>{action}</span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-300 mb-2">{anomaly.description}</p>
      <p className="text-xs text-slate-500 mb-4">
        <span className="text-slate-400 font-medium">Suggestion:</span> {anomaly.suggestedAction}
      </p>

      {/* Raw row data */}
      <details className="mb-4">
        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
          View raw row data
        </summary>
        <div className="mt-2 p-3 rounded-lg bg-surface-800 border border-surface-700 overflow-x-auto">
          <table className="text-xs w-full">
            <tbody>
              {Object.entries(rowData).filter(([, v]) => v !== '').map(([k, v]) => (
                <tr key={k}>
                  <td className="text-slate-500 pr-4 py-0.5 font-mono">{k}</td>
                  <td className="text-slate-200 font-mono">{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Actions */}
      {!resolved ? (
        <div className="flex gap-2 flex-wrap">
          <button
            id={`anomaly-approve-${anomaly.id}`}
            onClick={() => resolve('APPROVE')}
            disabled={loading}
            className="btn-success text-xs"
          >
            ✓ Approve
          </button>
          <button
            id={`anomaly-reject-${anomaly.id}`}
            onClick={() => resolve('REJECT')}
            disabled={loading}
            className="btn-danger text-xs"
          >
            ✗ Reject
          </button>
          <button
            id={`anomaly-skip-${anomaly.id}`}
            onClick={() => resolve('SKIP')}
            disabled={loading}
            className="btn-secondary text-xs"
          >
            → Skip
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setResolved(false); setAction(null) }}
          className="btn-ghost text-xs"
        >
          Change decision
        </button>
      )}
    </div>
  )
}
