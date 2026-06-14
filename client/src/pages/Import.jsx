import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import api from '../services/api';
import toast from 'react-hot-toast';
import AnomalyCard from '../components/AnomalyCard';
import Navbar from '../components/Navbar';
import Spinner from '../components/Spinner';

const STEPS = ['Upload', 'Summary', 'Review', 'Confirm', 'Report'];
const STEP = { UPLOAD: 0, SUMMARY: 1, REVIEW: 2, CONFIRM: 3, REPORT: 4 };

const TYPE_COLORS = {
  DUPLICATE_ROW:             'bg-orange-950/50 text-orange-400 border border-orange-500/20',
  DUPLICATE_AMOUNT_MISMATCH: 'bg-amber-950/50 text-amber-400 border border-amber-500/20',
  NEGATIVE_AMOUNT:           'bg-red-950/50 text-red-400 border border-red-500/20',
  ZERO_AMOUNT:               'bg-slate-800 text-slate-400 border border-white/5',
  MISSING_REQUIRED_FIELD:    'bg-red-950/50 text-red-400 border border-red-500/20',
  INVALID_DATE:              'bg-red-950/50 text-red-400 border border-red-500/20',
  FUTURE_DATE:               'bg-yellow-950/50 text-yellow-400 border border-yellow-500/20',
  UNKNOWN_MEMBER:            'bg-purple-950/50 text-purple-400 border border-purple-500/20',
  MEMBER_NOT_ACTIVE:         'bg-purple-950/50 text-purple-400 border border-purple-500/20',
  CURRENCY_MISMATCH:         'bg-blue-950/50 text-blue-400 border border-blue-500/20',
  SETTLEMENT_AS_EXPENSE:     'bg-teal-950/50 text-teal-400 border border-teal-500/20',
  SPLIT_SUM_MISMATCH:        'bg-pink-950/50 text-pink-400 border border-pink-500/20',
  INVALID_SPLIT_TYPE:        'bg-rose-950/50 text-rose-400 border border-rose-500/20',
};

export default function Import() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [group, setGroup]         = useState(null);
  const [fetching, setFetching]   = useState(true);
  const [step, setStep]           = useState(STEP.UPLOAD);
  const [file, setFile]           = useState(null);
  const [uploading, setUploading] = useState(false);

  // Session data
  const [sessionId, setSessionId]           = useState(null);
  const [uploadResult, setUploadResult]     = useState(null); 
  const [anomalies, setAnomalies]           = useState([]);
  const [resolvedMap, setResolvedMap]       = useState({}); 
  const [executing, setExecuting]           = useState(false);
  const [executeResult, setExecuteResult]   = useState(null);
  const [report, setReport]                 = useState(null);

  // Keep parsed rows in memory for execute stage
  const allRowsRef = useRef(null);

  useEffect(() => {
    api.get(`/groups/${id}`)
      .then(r => setGroup(r.data.data))
      .catch(() => toast.error('Failed to load group info'))
      .finally(() => setFetching(false));
  }, [id]);

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept:   { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return toast.error('Please select a CSV file');

    setUploading(true);
    try {
      const text = await file.text();
      const { data } = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() });
      allRowsRef.current = data;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('groupId', id);

      const r = await api.post('/import/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const result = r.data.data;
      setSessionId(result.sessionId);
      setUploadResult(result);

      // Fetch full anomaly list
      const sessionR = await api.get(`/import/${result.sessionId}`);
      setAnomalies(sessionR.data.data.anomalies);

      toast.success(`Upload complete — ${result.anomalyCount} anomalies detected`);
      setStep(STEP.SUMMARY);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAnomalyResolved = (anomalyId, action) => {
    setResolvedMap(m => ({ ...m, [anomalyId]: action }));
  };

  const resolvedCount = Object.keys(resolvedMap).length;
  const allResolved   = resolvedCount === anomalies.length;

  const approvedRows = anomalies.filter(a => resolvedMap[a.id] === 'APPROVE').length;
  const rejectedRows = anomalies.filter(a => resolvedMap[a.id] !== 'APPROVE').length;
  const cleanRows    = uploadResult?.cleanRows || 0;
  const totalImport  = cleanRows + approvedRows;

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const r = await api.post(`/import/${sessionId}/execute`, {
        allRows: allRowsRef.current,
      });
      setExecuteResult(r.data.data);

      const rr = await api.get(`/import/${sessionId}/report`);
      setReport(rr.data.data);

      toast.success(`Import complete — ${r.data.data.importedCount} rows imported!`);
      setStep(STEP.REPORT);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setExecuting(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all
            ${i < step  ? 'bg-brand-600 text-white' :
              i === step ? 'bg-brand-500 text-white ring-2 ring-brand-400 ring-offset-2 ring-offset-surface-950' :
              'bg-surface-750 text-slate-500 border border-white/5'}`}>
            {i < step ? '✓' : i + 1}
          </div>
          <div className="ml-2 mr-4 hidden sm:block">
            <p className={`text-xs font-semibold ${i === step ? 'text-brand-300' : i < step ? 'text-slate-400' : 'text-slate-500'}`}>
              {s}
            </p>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-6 sm:w-8 mr-2 ${i < step ? 'bg-brand-600' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  );

  if (fetching) return (
    <div className="min-h-screen">
      <Navbar />
      <div className="flex justify-center pt-24"><Spinner size="lg" /></div>
    </div>
  );

  if (!group) return (
    <div className="min-h-screen">
      <Navbar />
      <div className="text-center pt-24 text-red-400">Group not found</div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-10 page-enter">
        <div className="mb-6">
          <button onClick={() => navigate(`/groups/${id}`)} className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1 mb-4 transition-colors">
            ← Back to {group.name}
          </button>
          <h1 className="text-2xl font-bold text-white">CSV Import Wizard</h1>
          <p className="text-slate-400 text-sm mt-1">Import expenses from a CSV file with automatic anomaly detection</p>
        </div>

        <StepIndicator />

        {/* ── STEP 0: Upload ─────────────────────────────────────────────────────── */}
        {step === STEP.UPLOAD && (
          <div className="glass-card p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-100">Step 1 — Upload CSV</h2>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
                ${isDragActive
                  ? 'border-brand-500 bg-brand-900/20'
                  : file
                    ? 'border-emerald-600 bg-emerald-900/10'
                    : 'border-white/10 hover:border-brand-500/50 hover:bg-surface-650/40'}`}
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

            <div className="p-4 rounded-xl bg-surface-800/50 border border-white/5">
              <p className="text-xs text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Expected CSV columns:</p>
              <p className="text-xs text-slate-300 font-mono bg-surface-900/50 p-2.5 rounded-lg border border-white/5 overflow-x-auto">
                date, description, amount, currency, paidBy, splitType, participants
              </p>
            </div>

            <button
              id="csv-upload-btn"
              onClick={handleUpload}
              disabled={!file || uploading}
              className="btn-primary w-full"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin" />
                  Analyzing file…
                </>
              ) : '🚀 Upload & Analyze'}
            </button>
          </div>
        )}

        {/* ── STEP 1: Summary ────────────────────────────────────────────────────── */}
        {step === STEP.SUMMARY && uploadResult && (
          <div className="space-y-5">
            <div className="glass-card p-6">
              <h2 className="text-base font-semibold text-slate-100 mb-4">Step 2 — Import Summary</h2>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 rounded-xl bg-surface-800/30 border border-white/5">
                  <p className="text-2xl font-bold text-white">{uploadResult.totalRows}</p>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">Total rows</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-2xl font-bold text-emerald-400">{uploadResult.cleanRows}</p>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">Clean rows</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-2xl font-bold text-red-400">{uploadResult.anomalyCount}</p>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">Anomalies</p>
                </div>
              </div>

              {Object.entries(uploadResult.anomalyCountByType || {}).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-3 uppercase tracking-wider">Anomalies by type</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(uploadResult.anomalyCountByType).map(([type, count]) => (
                      <span key={type} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${TYPE_COLORS[type] || 'bg-slate-700 text-slate-300'}`}>
                        {type.replace(/_/g, ' ')} <span className="font-bold bg-white/10 px-1.5 py-0.5 rounded-md ml-1">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {uploadResult.anomalyCount === 0 ? (
              <div className="glass-card p-8 text-center space-y-4">
                <p className="text-4xl">🎉</p>
                <h3 className="text-lg font-semibold text-emerald-400">No anomalies detected!</h3>
                <p className="text-slate-400 text-sm">All {uploadResult.totalRows} rows are clean and ready to import.</p>
                <button onClick={() => setStep(STEP.CONFIRM)} className="btn-primary w-full">
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
              <div className="text-xs text-slate-400">
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

            {/* Anomaly list */}
            <div className="space-y-4">
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
              <button onClick={() => setStep(STEP.CONFIRM)} className="btn-primary w-full mt-4">
                ✓ All Resolved — Continue →
              </button>
            )}
          </div>
        )}

        {/* ── STEP 3: Confirm ────────────────────────────────────────────────────── */}
        {step === STEP.CONFIRM && (
          <div className="glass-card p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-100 font-bold">Step 4 — Confirm Import</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-3xl font-bold text-emerald-400">{totalImport}</p>
                <p className="text-sm text-slate-350 mt-1.5 font-medium">Rows to import</p>
                <p className="text-xs text-slate-500 mt-1">({cleanRows} clean + {approvedRows} approved)</p>
              </div>
              <div className="text-center p-5 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-3xl font-bold text-red-400">{rejectedRows}</p>
                <p className="text-sm text-slate-350 mt-1.5 font-medium">Rows to skip/reject</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-800/50 border border-white/5">
              <p className="text-sm text-slate-300">
                <span className="text-brand-300 font-semibold">{totalImport} rows</span> will be imported as expenses.
                {' '}<span className="text-red-400 font-semibold">{rejectedRows} rows</span> will be skipped.
              </p>
              <p className="text-xs text-slate-500 mt-1.5">Note: This action cannot be undone. Imported expenses can be soft-deleted later.</p>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(STEP.REVIEW)} className="btn-secondary flex-1">
                ← Back to Review
              </button>
              <button
                id="execute-import-btn"
                onClick={handleExecute}
                disabled={executing}
                className="btn-primary flex-1"
              >
                {executing ? (
                  <>
                    <div className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin" />
                    Importing…
                  </>
                ) : `🚀 Import ${totalImport} Rows`}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Report ─────────────────────────────────────────────────────── */}
        {step === STEP.REPORT && report && (
          <div className="space-y-5">
            <div className="glass-card p-6">
              <h2 className="text-base font-semibold text-slate-100 mb-4">Step 5 — Import Report</h2>

              {executeResult && (
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-2xl font-bold text-emerald-400">{executeResult.importedCount}</p>
                    <p className="text-xs text-slate-550 mt-1 uppercase tracking-wider font-semibold">Imported</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-surface-800/30 border border-white/5">
                    <p className="text-2xl font-bold text-slate-400">{executeResult.skippedCount}</p>
                    <p className="text-xs text-slate-550 mt-1 uppercase tracking-wider font-semibold">Skipped</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-center mb-5">
                {Object.entries(report.summary).map(([k, v]) => (
                  <div key={k} className="p-3.5 rounded-xl bg-surface-700/40 border border-white/5">
                    <p className="text-lg font-bold text-white">{v}</p>
                    <p className="text-xs text-slate-500 capitalize mt-0.5">{k}</p>
                  </div>
                ))}
              </div>
            </div>

            {report.anomalies?.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Anomaly Decision Log</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-350">
                    <thead>
                      <tr className="border-b border-white/5 text-slate-400 font-semibold">
                        <th className="py-2">Row</th>
                        <th className="py-2">Type</th>
                        <th className="py-2">Description</th>
                        <th className="py-2">User Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {report.anomalies.map(a => (
                        <tr key={a.id} className="hover:bg-white/[0.01]">
                          <td className="py-2.5 font-mono text-slate-400">#{a.rowIndex + 1}</td>
                          <td className="py-2.5">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${TYPE_COLORS[a.anomalyType] || 'bg-slate-700 text-slate-300'}`}>
                              {a.anomalyType.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 max-w-xs truncate text-slate-300" title={a.description}>{a.description}</td>
                          <td className="py-2.5">
                            <span className={
                              a.userAction === 'APPROVE' ? 'text-emerald-400 font-bold' :
                              a.userAction === 'REJECT'  ? 'text-red-400 font-bold' :
                              'text-yellow-400 font-bold'
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

            <div className="flex gap-4">
              <Link to={`/groups/${id}`} className="btn-primary flex-1 text-center">
                ✓ Done — Group Dashboard
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
