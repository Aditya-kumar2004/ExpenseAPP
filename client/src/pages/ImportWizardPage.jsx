import { useState, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import api from '../lib/api'
import toast from 'react-hot-toast'
import AnomalyCard from '../components/AnomalyCard'

const STEPS = ['Upload', 'Summary', 'Review', 'Confirm', 'Report']
const STEP = { UPLOAD: 0, SUMMARY: 1, REVIEW: 2, CONFIRM: 3, REPORT: 4 }

// ─── Anomaly type color map for summary ───────────────────────────────────────
const TYPE_COLORS = {
  DUPLICATE_ROW:             'bg-orange-900 text-orange-300',
  DUPLICATE_AMOUNT_MISMATCH: 'bg-amber-900 text-amber-300',
  NEGATIVE_AMOUNT:           'bg-red-900 text-red-300',
  ZERO_AMOUNT:               'bg-slate-700 text-slate-300',
  MISSING_REQUIRED_FIELD:    'bg-red-900 text-red-300',
  INVALID_DATE:              'bg-red-900 text-red-300',
  FUTURE_DATE:               'bg-yellow-900 text-yellow-300',
  UNKNOWN_MEMBER:            'bg-purple-900 text-purple-300',
  MEMBER_NOT_ACTIVE:         'bg-purple-900 text-purple-300',
  CURRENCY_MISMATCH:         'bg-blue-900 text-blue-300',
  SETTLEMENT_AS_EXPENSE:     'bg-teal-900 text-teal-300',
  SPLIT_SUM_MISMATCH:        'bg-pink-900 text-pink-300',
  INVALID_SPLIT_TYPE:        'bg-rose-900 text-rose-300',
}

export default function ImportWizardPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [step, setStep]           = useState(STEP.UPLOAD)
  const [file, setFile]           = useState(null)
  const [uploading, setUploading] = useState(false)

  // Session data
  const [sessionId, setSessionId]           = useState(null)
  const [uploadResult, setUploadResult]     = useState(null) // { totalRows, cleanRows, anomalyCount, anomalyCountByType }
  const [anomalies, setAnomalies]           = useState([])
  const [resolvedMap, setResolvedMap]       = useState({}) // { anomalyId: action }
  const [executing, setExecuting]           = useState(false)
  const [executeResult, setExecuteResult]   = useState(null)
  const [report, setReport]                 = useState(null)

  // Keep parsed rows in memory for execute stage
  const allRowsRef = useRef(null)

  // ─── Dropzone ────────────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept:   { 'text/csv': ['.csv'] },
    maxFiles: 1,
  })

  // ─── Stage 1: Upload ─────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) return toast.error('Please select a CSV file')

    setUploading(true)
    try {
      // Parse client-side to cache rows for execute stage
      const text = await file.text()
      const { data } = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() })
      allRowsRef.current = data

      // Upload to server
      const formData = new FormData()
      formData.append('file', file)
      formData.append('groupId', id)

      const r = await api.post('/import/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const result = r.data.data
      setSessionId(result.sessionId)
      setUploadResult(result)

      // Fetch full anomaly list
      const sessionR = await api.get(`/import/${result.sessionId}`)
      setAnomalies(sessionR.data.data.anomalies)

      toast.success(`Upload complete — ${result.anomalyCount} anomalies detected`)
      setStep(STEP.SUMMARY)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // ─── Anomaly resolved callback ───────────────────────────────────────────────
  const handleAnomalyResolved = (anomalyId, action) => {
    setResolvedMap(m => ({ ...m, [anomalyId]: action }))
  }

  const resolvedCount = Object.keys(resolvedMap).length
  const allResolved   = resolvedCount === anomalies.length

  const approvedRows = anomalies.filter(a => resolvedMap[a.id] === 'APPROVE').length
  const rejectedRows = anomalies.filter(a => resolvedMap[a.id] !== 'APPROVE').length
  const cleanRows    = uploadResult?.cleanRows || 0
  const totalImport  = cleanRows + approvedRows

  // ─── Stage 4: Execute ────────────────────────────────────────────────────────
  const handleExecute = async () => {
    setExecuting(true)
    try {
      const r = await api.post(`/import/${sessionId}/execute`, {
        allRows: allRowsRef.current,
      })
      setExecuteResult(r.data.data)

      // Fetch report
      const rr = await api.get(`/import/${sessionId}/report`)
      setReport(rr.data.data)

      toast.success(`Import complete — ${r.data.data.importedCount} rows imported!`)
      setStep(STEP.REPORT)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed')
    } finally {
      setExecuting(false)
    }
  }

  // ─── Step indicator ──────────────────────────────────────────────────────────
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all
            ${i < step  ? 'bg-brand-600 text-white' :
              i === step ? 'bg-brand-500 text-white ring-2 ring-brand-400 ring-offset-2 ring-offset-surface-950' :
              'bg-surface-800 text-slate-500'}`}>
            {i < step ? '✓' : i + 1}
          </div>
          <div className="ml-2 mr-4 hidden sm:block">
            <p className={`text-xs font-medium ${i === step ? 'text-brand-300' : i < step ? 'text-slate-400' : 'text-slate-600'}`}>
              {s}
            </p>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-6 sm:w-8 mr-2 ${i < step ? 'bg-brand-600' : 'bg-surface-700'}`} />
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="page-wrapper max-w-3xl">
      <div className="mb-6">
        <Link to={`/groups/${id}`} className="text-sm text-slate-500 hover:text-slate-300">← Back to group</Link>
        <h1 className="page-title mt-2">CSV Import Wizard</h1>
        <p className="page-subtitle">Import expenses from a CSV file with automatic anomaly detection</p>
      </div>

      <StepIndicator />

      {/* ── STEP 0: Upload ─────────────────────────────────────────────────────── */}
      {step === STEP.UPLOAD && (
        <div className="card space-y-5">
          <h2 className="text-base font-semibold text-slate-100">Step 1 — Upload CSV</h2>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
              ${isDragActive
                ? 'border-brand-500 bg-brand-900/20'
                : file
                  ? 'border-emerald-600 bg-emerald-900/10'
                  : 'border-surface-700 hover:border-surface-600 hover:bg-surface-800/50'}`}
          >
            <input {...getInputProps()} id="csv-file-input" />
            <div className="text-4xl mb-3">{file ? '📄' : '📤'}</div>
            {file ? (
              <div>
                <p className="text-sm font-semibold text-emerald-400">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
              </div>
            ) : isDragActive ? (
              <p className="text-sm text-brand-300">Drop the CSV here…</p>
            ) : (
              <div>
                <p className="text-sm text-slate-300 font-medium">Drag & drop CSV here</p>
                <p className="text-xs text-slate-500 mt-1">or click to browse · Max 10 MB</p>
              </div>
            )}
          </div>

          {/* CSV format hint */}
          <div className="p-3 rounded-xl bg-surface-800 border border-surface-700">
            <p className="text-xs text-slate-400 font-medium mb-1">Expected CSV columns:</p>
            <p className="text-xs text-slate-500 font-mono">
              date, description, amount, currency, paidBy, splitType, participants
            </p>
          </div>

          <button
            id="csv-upload-btn"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn-primary w-full"
          >
            {uploading ? 'Uploading & Detecting Anomalies…' : '🚀 Upload & Analyze'}
          </button>
        </div>
      )}

      {/* ── STEP 1: Summary ────────────────────────────────────────────────────── */}
      {step === STEP.SUMMARY && uploadResult && (
        <div className="space-y-5">
          <div className="card">
            <h2 className="text-base font-semibold text-slate-100 mb-4">Step 2 — Import Summary</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 rounded-xl bg-surface-800 border border-surface-700">
                <p className="text-2xl font-bold text-slate-100">{uploadResult.totalRows}</p>
                <p className="text-xs text-slate-500">Total rows</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-emerald-900/30 border border-emerald-800/50">
                <p className="text-2xl font-bold text-emerald-400">{uploadResult.cleanRows}</p>
                <p className="text-xs text-slate-500">Clean rows</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-red-900/30 border border-red-800/50">
                <p className="text-2xl font-bold text-red-400">{uploadResult.anomalyCount}</p>
                <p className="text-xs text-slate-500">Anomalies</p>
              </div>
            </div>

            {/* Anomalies by type */}
            {Object.entries(uploadResult.anomalyCountByType || {}).length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wide">Anomalies by type</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(uploadResult.anomalyCountByType).map(([type, count]) => (
                    <span key={type} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${TYPE_COLORS[type] || 'bg-surface-700 text-slate-300'}`}>
                      {type.replace(/_/g, ' ')} <span className="font-bold">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {uploadResult.anomalyCount === 0 ? (
            <div className="card text-center py-8">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm font-medium text-emerald-400">No anomalies detected!</p>
              <p className="text-xs text-slate-500 mt-1">All {uploadResult.totalRows} rows are clean and ready to import.</p>
              <button onClick={() => setStep(STEP.CONFIRM)} className="btn-primary mt-4">
                Continue to Import →
              </button>
            </div>
          ) : (
            <button onClick={() => setStep(STEP.REVIEW)} className="btn-primary w-full">
              Review {uploadResult.anomalyCount} Anomalies →
            </button>
          )}
        </div>
      )}

      {/* ── STEP 2: Review ─────────────────────────────────────────────────────── */}
      {step === STEP.REVIEW && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">
              Step 3 — Review Anomalies
            </h2>
            <div className="text-xs text-slate-500">
              <span className="text-emerald-400 font-semibold">{resolvedCount}</span> / {anomalies.length} resolved
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-all duration-300"
              style={{ width: `${anomalies.length > 0 ? (resolvedCount / anomalies.length) * 100 : 0}%` }}
            />
          </div>

          {/* Anomaly cards */}
          <div className="space-y-3">
            {anomalies.map(a => (
              <AnomalyCard
                key={a.id}
                anomaly={a}
                sessionId={sessionId}
                onResolved={handleAnomalyResolved}
              />
            ))}
          </div>

          {allResolved && (
            <button onClick={() => setStep(STEP.CONFIRM)} className="btn-primary w-full mt-2">
              ✓ All Resolved — Continue →
            </button>
          )}
        </div>
      )}

      {/* ── STEP 3: Confirm ────────────────────────────────────────────────────── */}
      {step === STEP.CONFIRM && (
        <div className="card space-y-5">
          <h2 className="text-base font-semibold text-slate-100">Step 4 — Confirm Import</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-5 rounded-xl bg-emerald-900/30 border border-emerald-800/50">
              <p className="text-3xl font-bold text-emerald-400">{totalImport}</p>
              <p className="text-sm text-slate-400 mt-1">Rows to import</p>
              <p className="text-xs text-slate-500">({cleanRows} clean + {approvedRows} approved anomalies)</p>
            </div>
            <div className="text-center p-5 rounded-xl bg-red-900/30 border border-red-800/50">
              <p className="text-3xl font-bold text-red-400">{rejectedRows}</p>
              <p className="text-sm text-slate-400 mt-1">Rows to skip</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-800 border border-surface-700">
            <p className="text-sm text-slate-300">
              <span className="text-brand-300 font-semibold">{totalImport} rows</span> will be imported as expenses.{' '}
              <span className="text-red-400 font-semibold">{rejectedRows} rows</span> will be skipped.
            </p>
            <p className="text-xs text-slate-500 mt-1">This action cannot be undone (expenses can be soft-deleted later).</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(STEP.REVIEW)} className="btn-secondary flex-1">
              ← Back to Review
            </button>
            <button
              id="execute-import-btn"
              onClick={handleExecute}
              disabled={executing}
              className="btn-primary flex-1"
            >
              {executing ? '⏳ Importing…' : `🚀 Import ${totalImport} Rows`}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Report ─────────────────────────────────────────────────────── */}
      {step === STEP.REPORT && report && (
        <div className="space-y-5">
          <div className="card">
            <h2 className="text-base font-semibold text-slate-100 mb-4">Step 5 — Import Report</h2>

            {executeResult && (
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="text-center p-4 rounded-xl bg-emerald-900/30 border border-emerald-800/50">
                  <p className="text-2xl font-bold text-emerald-400">{executeResult.importedCount}</p>
                  <p className="text-xs text-slate-500">Imported</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-surface-800 border border-surface-700">
                  <p className="text-2xl font-bold text-slate-400">{executeResult.skippedCount}</p>
                  <p className="text-xs text-slate-500">Skipped</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 text-center mb-5">
              {Object.entries(report.summary).map(([k, v]) => (
                <div key={k} className="p-3 rounded-xl bg-surface-800">
                  <p className="text-lg font-bold text-slate-100">{v}</p>
                  <p className="text-xs text-slate-500 capitalize">{k}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Full anomaly table */}
          {report.anomalies?.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Anomaly Log</h3>
              <div className="table-wrapper">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.anomalies.map(a => (
                      <tr key={a.id}>
                        <td>#{a.rowIndex + 1}</td>
                        <td>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[a.anomalyType] || ''}`}>
                            {a.anomalyType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="max-w-xs truncate">{a.description}</td>
                        <td>
                          <span className={
                            a.userAction === 'APPROVE' ? 'text-emerald-400 font-semibold' :
                            a.userAction === 'REJECT'  ? 'text-red-400 font-semibold' :
                            a.userAction === 'SKIP'    ? 'text-yellow-400 font-semibold' :
                            'text-slate-500'
                          }>
                            {a.userAction || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Link to={`/groups/${id}`} className="btn-primary flex-1 text-center">
              ✓ Done — View Group
            </Link>
            <Link to={`/groups/${id}/expenses`} className="btn-secondary flex-1 text-center">
              View Imported Expenses →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
