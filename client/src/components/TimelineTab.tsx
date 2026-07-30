import { useEffect, useState } from 'react';
import { getAuthorizations, getEmployment, type AuthorizationRecord, type EmploymentRecord } from '../api';

const AUTH_COLORS: Record<AuthorizationRecord['authType'], string> = {
  'OPT': 'bg-blue-400',
  'STEM-OPT': 'bg-green-400',
  'CPT': 'bg-purple-400',
};

const EMP_COLORS: Record<EmploymentRecord['authorizationType'], string> = {
  'OPT': 'bg-blue-200',
  'STEM-OPT': 'bg-green-200',
  'CPT': 'bg-purple-200',
};

function toMs(iso: string): number {
  const parts = iso.split('-');
  return Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

function pct(ms: number, minMs: number, rangeMs: number): string {
  return `${((ms - minMs) / rangeMs) * 100}%`;
}

function width(startMs: number, endMs: number, _minMs: number, rangeMs: number): string {
  const w = ((endMs - startMs) / rangeMs) * 100;
  return `${Math.max(w, 0.5)}%`;
}

interface Bar {
  label: string;
  colorClass: string;
  startMs: number;
  endMs: number;
  tooltip: string;
}

export function TimelineTab() {
  const [authorizations, setAuthorizations] = useState<AuthorizationRecord[]>([]);
  const [employment, setEmployment] = useState<EmploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayMs = toMs(todayIso);

  useEffect(() => {
    Promise.all([getAuthorizations(), getEmployment()])
      .then(([auths, emps]) => {
        setAuthorizations(auths);
        setEmployment(emps);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading timeline…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (authorizations.length === 0 && employment.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-900">Authorization & Employment Timeline</h2>
        <p className="text-sm text-gray-500">
          No authorization or employment records found. Log some data first.
        </p>
      </div>
    );
  }

  // Compute date span: min/max across all records ± 30 days
  const allDates: number[] = [
    ...authorizations.flatMap(a => [toMs(a.startDate), toMs(a.endDate)]),
    ...employment.flatMap(e => [toMs(e.period.start), e.period.end ? toMs(e.period.end) : todayMs]),
    todayMs,
  ];
  const rawMin = Math.min(...allDates);
  const rawMax = Math.max(...allDates);
  const minMs = rawMin - 30 * 86400000;
  const maxMs = rawMax + 30 * 86400000;
  const rangeMs = maxMs - minMs;

  // Build authorization bars
  const authBars: Bar[] = authorizations.map(a => ({
    label: `${a.authType}${a.employer ? ` — ${a.employer}` : ''}`,
    colorClass: AUTH_COLORS[a.authType],
    startMs: toMs(a.startDate),
    endMs: toMs(a.endDate),
    tooltip: `${a.authType}: ${a.startDate} → ${a.endDate}`,
  }));

  // Build employment bars
  const empBars: Bar[] = employment.map(e => ({
    label: `${e.authorizationType} @ ${e.employer}`,
    colorClass: EMP_COLORS[e.authorizationType],
    startMs: toMs(e.period.start),
    endMs: e.period.end ? toMs(e.period.end) : todayMs,
    tooltip: `${e.authorizationType} @ ${e.employer}: ${e.period.start} → ${e.period.end ?? 'ongoing'}`,
  }));

  // Build date axis labels (roughly every 3 months)
  const axisLabels: { label: string; leftPct: string }[] = [];
  const start = new Date(minMs);
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor.getTime() <= maxMs) {
    const label = cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    axisLabels.push({ label, leftPct: pct(cursor.getTime(), minMs, rangeMs) });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 3, 1));
  }

  function renderBars(bars: Bar[], rowHeight = 20) {
    return bars.map((bar, i) => (
      <div key={i} className="relative mb-1" style={{ height: rowHeight }}>
        <span className="absolute text-xs text-gray-600 truncate" style={{ left: 0, top: 2, width: '130px', fontSize: '10px' }}>
          {bar.label}
        </span>
        <div className="absolute inset-y-0" style={{ left: '140px', right: 0 }}>
          <div
            title={bar.tooltip}
            className={`absolute top-1 bottom-1 rounded ${bar.colorClass} opacity-80 hover:opacity-100 cursor-help`}
            style={{
              left: pct(Math.max(bar.startMs, minMs), minMs, rangeMs),
              width: width(Math.max(bar.startMs, minMs), Math.min(bar.endMs, maxMs), minMs, rangeMs),
            }}
          />
        </div>
      </div>
    ));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Authorization & Employment Timeline</h2>
        <p className="text-sm text-gray-500">Visualizes your authorization windows and employment periods over time.</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-400" /> OPT (auth)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-400" /> STEM-OPT (auth)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-purple-400" /> CPT (auth)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-200" /> OPT (employment)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-200" /> STEM-OPT (employment)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-purple-200" /> CPT (employment)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-500" /> Today</span>
      </div>

      {/* Timeline chart */}
      <div className="overflow-x-auto">
        <div className="relative min-w-[600px]">

          {/* Authorization rows */}
          {authBars.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 ml-0">Authorizations</div>
              {renderBars(authBars)}
            </div>
          )}

          {/* Employment rows */}
          {empBars.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Employment</div>
              {renderBars(empBars)}
            </div>
          )}

          {/* Today marker — positioned relative to the bar area starting at 140px */}
          <div
            className="absolute top-0 bottom-8 border-l-2 border-red-500 z-10"
            style={{ left: `calc(140px + (100% - 140px) * ${(todayMs - minMs) / rangeMs})` }}
            title={`Today: ${todayIso}`}
          >
            <span className="absolute -top-1 -translate-x-1/2 text-xs text-red-600 font-semibold whitespace-nowrap">
              Today
            </span>
          </div>

          {/* Date axis */}
          <div className="relative h-5 ml-[140px]">
            {axisLabels.map((l, i) => (
              <span
                key={i}
                className="absolute text-xs text-gray-400 -translate-x-1/2"
                style={{ left: l.leftPct }}
              >
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 italic">
        Hover over a bar for details. All dates are UTC. Authorization windows require logging via the Profile/Employment tabs.
      </p>
    </div>
  );
}
