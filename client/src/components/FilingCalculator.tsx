import { useEffect, useState } from 'react';
import { getFilingWindows, type FilingWindow, type FilingStatus } from '../api';

const STATUS_CONFIG: Record<FilingStatus, { label: string; badge: string; bar: string; border: string }> = {
  upcoming:       { label: 'Upcoming',     badge: 'bg-blue-100 text-blue-700',   bar: 'bg-blue-400',  border: 'border-blue-200' },
  open:           { label: 'Open',         badge: 'bg-green-100 text-green-700', bar: 'bg-green-500', border: 'border-green-200' },
  expiring:       { label: 'Expiring soon',badge: 'bg-red-100 text-red-700',     bar: 'bg-red-500',   border: 'border-red-300'  },
  closed:         { label: 'Closed',       badge: 'bg-gray-100 text-gray-500',   bar: 'bg-gray-300',  border: 'border-gray-200' },
  'not-applicable':{ label: 'N/A',         badge: 'bg-gray-100 text-gray-400',   bar: 'bg-gray-200',  border: 'border-gray-100' },
};

const ENTITY_BADGE: Record<FilingWindow['filingEntity'], string> = {
  USCIS: 'bg-indigo-100 text-indigo-700',
  DSO:   'bg-purple-100 text-purple-700',
  CBP:   'bg-cyan-100 text-cyan-700',
  'N/A': 'bg-gray-100 text-gray-500',
};

function toMs(iso: string): number {
  const p = iso.split('-');
  return Date.UTC(+p[0], +p[1] - 1, +p[2]);
}

/** Returns a 0–100 percentage showing where today sits within [opens, deadline]. */
function windowProgress(windowOpens: string, hardDeadline: string): number {
  const now      = Date.now();
  const openMs   = toMs(windowOpens);
  const closeMs  = toMs(hardDeadline);
  const rangeMs  = closeMs - openMs;
  if (rangeMs <= 0) return 100;
  const pct = ((now - openMs) / rangeMs) * 100;
  return Math.min(Math.max(pct, 0), 100);
}

function DaysCounter({ days, status }: { days: number; status: FilingStatus }) {
  if (status === 'closed') {
    return <span className="text-2xl font-bold text-gray-400 tabular-nums">Past</span>;
  }
  if (days < 0) {
    return <span className="text-2xl font-bold text-green-600 tabular-nums">Open</span>;
  }
  const color =
    days <= 14  ? 'text-red-600' :
    days <= 60  ? 'text-orange-600' :
    days <= 90  ? 'text-yellow-600' : 'text-gray-700';
  return (
    <div className="text-right">
      <span className={`text-2xl font-bold tabular-nums ${color}`}>{days}</span>
      <span className="text-xs text-gray-400 ml-1">days</span>
    </div>
  );
}

function WindowProgressBar({
  window: w,
}: {
  window: FilingWindow;
}) {
  const pct = windowProgress(w.windowOpens, w.hardDeadline);
  const cfg = STATUS_CONFIG[w.status];
  const isOpen = w.status === 'open' || w.status === 'expiring';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>Opens {w.windowOpens}</span>
        <span>Deadline {w.hardDeadline}</span>
      </div>
      <div className="relative w-full bg-gray-100 rounded-full h-3">
        {/* filled portion = elapsed */}
        <div
          className={`h-3 rounded-full transition-all ${cfg.bar} ${w.status === 'closed' ? 'opacity-40' : ''}`}
          style={{ width: `${pct}%` }}
        />
        {/* Today marker */}
        {isOpen && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full shadow"
            style={{ left: `calc(${pct}% - 6px)` }}
            title="Today"
          />
        )}
      </div>
      <div className="flex justify-between text-xs">
        <span className={cfg.badge + ' px-1.5 py-0.5 rounded font-medium'}>{cfg.label}</span>
        {isOpen && pct > 0 && (
          <span className="text-gray-400">{Math.round(pct)}% of window elapsed</span>
        )}
      </div>
    </div>
  );
}

function FilingCard({ w }: { w: FilingWindow }) {
  const [open, setOpen] = useState(w.status === 'expiring' || w.status === 'open');
  const cfg = STATUS_CONFIG[w.status];

  const daysLabel = w.daysUntilDeadline >= 0
    ? `${w.daysUntilDeadline} days until deadline`
    : `Deadline passed ${Math.abs(w.daysUntilDeadline)} days ago`;

  return (
    <div className={`border rounded-xl overflow-hidden ${cfg.border} ${w.status === 'closed' ? 'opacity-60' : ''}`}>
      {/* Header */}
      <button
        className="w-full text-left bg-white px-4 py-3 flex items-start gap-4 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {/* Days counter */}
        <div className="shrink-0 w-16 text-right pt-1">
          <DaysCounter days={w.daysUntilDeadline} status={w.status} />
          <div className="text-xs text-gray-400 mt-0.5">
            {w.status === 'closed' ? '' : w.daysUntilDeadline >= 0 ? 'to deadline' : ''}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">{w.title}</span>
            {w.form && (
              <span className="text-xs font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded border">
                {w.form}
              </span>
            )}
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${ENTITY_BADGE[w.filingEntity]}`}>
              {w.filingEntity}
            </span>
          </div>
          <p className="text-xs text-gray-500 leading-snug">{w.description}</p>
        </div>

        <span className="text-gray-400 text-xs shrink-0 mt-1">{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-4 space-y-4">
          {/* Progress bar */}
          <WindowProgressBar window={w} />

          <p className="text-xs text-gray-500 italic">{daysLabel}</p>

          {/* Key steps */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Steps</p>
            <ol className="space-y-1.5">
              {w.keySteps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-gray-400 font-bold shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Note */}
          {w.note && (
            <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800">
              <strong>Note:</strong> {w.note}
            </div>
          )}

          {/* Citation */}
          <p className="text-xs text-gray-400 italic">{w.citation}</p>
        </div>
      )}
    </div>
  );
}

function SummaryStrip({ windows }: { windows: FilingWindow[] }) {
  const expiring  = windows.filter(w => w.status === 'expiring').length;
  const open      = windows.filter(w => w.status === 'open').length;
  const upcoming  = windows.filter(w => w.status === 'upcoming').length;

  return (
    <div className="flex flex-wrap gap-3">
      {expiring > 0 && (
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs font-semibold text-red-700">{expiring} expiring soon</span>
        </div>
      )}
      {open > 0 && (
        <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs font-semibold text-green-700">{open} open</span>
        </div>
      )}
      {upcoming > 0 && (
        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-xs font-semibold text-blue-700">{upcoming} upcoming</span>
        </div>
      )}
    </div>
  );
}

export function FilingCalculator() {
  const [windows, setWindows] = useState<FilingWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    getFilingWindows()
      .then(setWindows)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Calculating filing windows…</p>;
  if (error)   return <p className="text-sm text-red-600">{error}</p>;
  if (windows.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-900">Filing Deadline Calculator</h2>
        <p className="text-sm text-gray-500">Set up your profile to compute your filing windows.</p>
      </div>
    );
  }

  // Sort: expiring first, then open, then upcoming, then closed
  const ORDER: FilingStatus[] = ['expiring', 'open', 'upcoming', 'closed', 'not-applicable'];
  const sorted = [...windows].sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status),
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-gray-900">Filing Deadline Calculator</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Every USCIS, DSO, and CBP filing window relevant to your situation — computed from your
          profile and OPT records. Cards in red are expiring soon.
        </p>
      </div>

      <SummaryStrip windows={windows} />

      <div className="space-y-3">
        {sorted.map(w => <FilingCard key={w.id} w={w} />)}
      </div>

      <p className="text-xs text-gray-400 italic">
        Filing windows are computed from your stored profile and OPT authorization records.
        Processing times vary — file as early as the window allows. This is not legal advice.
      </p>
    </div>
  );
}
