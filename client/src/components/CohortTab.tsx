import { useEffect, useState } from 'react';
import { getCohort, getStudentAudit } from '../api';
import type { CohortStudent, AuditTrailEntry, CohortRuleResult } from '../api';

// ─── Severity badge ─────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const classes: Record<string, string> = {
    violation: 'bg-red-100 text-red-800 border border-red-300',
    warning: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    pass: 'bg-green-100 text-green-800 border border-green-300',
    'not-applicable': 'bg-gray-100 text-gray-500 border border-gray-200',
  };
  const labels: Record<string, string> = {
    violation: 'Violation',
    warning: 'Warning',
    pass: 'Pass',
    'not-applicable': 'N/A',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${classes[severity] ?? classes['not-applicable']}`}>
      {labels[severity] ?? severity}
    </span>
  );
}

// ─── Rule results list ───────────────────────────────────────────────────────

function RuleResultsList({ results }: { results: CohortRuleResult[] }) {
  // Show violations and warnings first, then passes, then N/A
  const sorted = [...results].sort((a, b) => {
    const order = { violation: 0, warning: 1, pass: 2, 'not-applicable': 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });

  return (
    <div className="mt-3 space-y-2">
      {sorted.map((r) => (
        <div
          key={r.rule.id}
          className={`rounded border p-3 text-sm ${
            r.status === 'violation'
              ? 'bg-red-50 border-red-200'
              : r.status === 'warning'
              ? 'bg-yellow-50 border-yellow-200'
              : r.status === 'pass'
              ? 'bg-green-50 border-green-200'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-gray-800">{r.rule.title}</span>
            <SeverityBadge severity={r.status} />
          </div>
          <p className="mt-1 text-gray-600">{r.message}</p>
          <p className="mt-1 text-xs text-gray-400">{r.rule.sourceCitation} · v{r.rule.version}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Audit trail table ───────────────────────────────────────────────────────

function AuditTrailTable({ trail }: { trail: AuditTrailEntry[] }) {
  if (trail.length === 0) {
    return (
      <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        No audit trail entries yet. The outbox dispatcher populates this table when the server
        processes student events. Run the server for a moment to populate.
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto rounded border border-gray-200">
      <table className="w-full text-xs">
        <thead className="bg-gray-100 text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Rule</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-left font-medium">Message</th>
            <th className="px-3 py-2 text-left font-medium">Event</th>
            <th className="px-3 py-2 text-left font-medium">Evaluated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {trail.map((entry) => (
            <tr key={entry.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-gray-700">{entry.ruleId} v{entry.ruleVersion}</td>
              <td className="px-3 py-2">
                <SeverityBadge severity={entry.status} />
              </td>
              <td className="px-3 py-2 text-gray-600 max-w-xs truncate" title={entry.message}>
                {entry.message}
              </td>
              <td className="px-3 py-2 text-gray-500">{entry.eventType}</td>
              <td className="px-3 py-2 text-gray-400">{entry.createdAt.slice(0, 16).replace('T', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Student detail panel ────────────────────────────────────────────────────

function StudentDetailPanel({
  cohortEntry,
  onClose,
}: {
  cohortEntry: CohortStudent;
  onClose: () => void;
}) {
  const { student, ruleResults } = cohortEntry;
  const [trail, setTrail] = useState<AuditTrailEntry[] | null>(null);
  const [trailError, setTrailError] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  function loadAudit() {
    if (trail !== null) {
      setShowAudit(s => !s);
      return;
    }
    getStudentAudit(student.id)
      .then(data => {
        setTrail(data.trail);
        setShowAudit(true);
      })
      .catch((err: Error) => setTrailError(err.message));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{student.fullName}</h2>
            <p className="text-sm text-gray-500">
              {student.major} · {student.programLevel}
              {student.isStemDesignated && (
                <span className="ml-2 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                  STEM
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {/* Student metadata */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 mb-4">
            <div><span className="font-medium text-gray-700">SEVIS ID:</span> {student.sevisId}</div>
            <div><span className="font-medium text-gray-700">Admission:</span> {student.admissionType}</div>
            <div><span className="font-medium text-gray-700">Program start:</span> {student.programStartDate}</div>
            <div><span className="font-medium text-gray-700">Program end:</span> {student.programEndDate}</div>
          </div>

          {/* Rule results */}
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
            Rule Evaluation Results
          </h3>
          <RuleResultsList results={ruleResults} />

          {/* Audit trail toggle */}
          <div className="mt-5">
            <button
              onClick={loadAudit}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {showAudit ? 'Hide' : 'Show'} Audit Trail (outbox-dispatched)
            </button>
            {trailError && (
              <p className="mt-1 text-xs text-red-600">Failed to load audit trail: {trailError}</p>
            )}
            {showAudit && trail !== null && <AuditTrailTable trail={trail} />}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="border-t border-gray-100 px-6 py-3">
          <p className="text-xs text-gray-400">
            Synthetic data only. Not real student records. FOR DEMO PURPOSES.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Student row ─────────────────────────────────────────────────────────────

function StudentRow({
  entry,
  onClick,
}: {
  entry: CohortStudent;
  onClick: () => void;
}) {
  const { student, summary } = entry;
  const borderColor =
    summary.highestSeverity === 'violation'
      ? 'border-l-red-500'
      : summary.highestSeverity === 'warning'
      ? 'border-l-yellow-400'
      : 'border-l-green-400';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border border-gray-200 border-l-4 ${borderColor} rounded-lg p-4 hover:bg-gray-50 transition-colors`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{student.fullName}</p>
          <p className="text-sm text-gray-500 truncate">
            {student.major}
            {student.isStemDesignated && (
              <span className="ml-1.5 inline-block rounded bg-blue-100 px-1 py-0.5 text-xs font-medium text-blue-700">
                STEM
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {summary.violations > 0 && (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
              {summary.violations}V
            </span>
          )}
          {summary.warnings > 0 && (
            <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800">
              {summary.warnings}W
            </span>
          )}
          <SeverityBadge severity={summary.highestSeverity} />
        </div>
      </div>
    </button>
  );
}

// ─── Main CohortTab ──────────────────────────────────────────────────────────

export function CohortTab() {
  const [cohort, setCohort] = useState<CohortStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CohortStudent | null>(null);
  const [filter, setFilter] = useState<'all' | 'violation' | 'warning' | 'pass'>('all');

  useEffect(() => {
    getCohort()
      .then(data => {
        setCohort(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message || 'Failed to load cohort');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-6 text-gray-500 animate-pulse">Loading synthetic cohort…</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-600 bg-red-50 rounded-lg border border-red-200">
        Error: {error}
      </div>
    );
  }

  const filtered = filter === 'all'
    ? cohort
    : cohort.filter(s => s.summary.highestSeverity === filter);

  const violationCount = cohort.filter(s => s.summary.highestSeverity === 'violation').length;
  const warningCount = cohort.filter(s => s.summary.highestSeverity === 'warning').length;
  const passCount = cohort.filter(s => s.summary.highestSeverity === 'pass').length;

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Synthetic Student Cohort</h2>
        <p className="text-sm text-gray-500 mt-1">
          15 synthetic students covering every F-1 compliance scenario. No real data.
          Click any student to see rule evaluations and audit trail.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{violationCount}</p>
          <p className="text-xs text-red-600 font-medium">Violations</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-center">
          <p className="text-2xl font-bold text-yellow-700">{warningCount}</p>
          <p className="text-xs text-yellow-600 font-medium">Warnings</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{passCount}</p>
          <p className="text-xs text-green-600 font-medium">Passing</p>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 mb-4">
        {(['all', 'violation', 'warning', 'pass'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? `All (${cohort.length})` : f === 'violation' ? `Violations (${violationCount})` : f === 'warning' ? `Warnings (${warningCount})` : `Passing (${passCount})`}
          </button>
        ))}
      </div>

      {/* Student list */}
      <div className="space-y-2">
        {filtered.map(entry => (
          <StudentRow
            key={entry.student.id}
            entry={entry}
            onClick={() => setSelected(entry)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm p-4">No students match this filter.</p>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <StudentDetailPanel
          cohortEntry={selected}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Footer disclaimer */}
      <p className="mt-6 text-xs text-gray-400 border-t border-gray-100 pt-4">
        All students are synthetic. This cohort is for portfolio/demo purposes only.
        Rule evaluations use the same engine as the personal compliance tool (packages/rule-engine).
      </p>
    </div>
  );
}
