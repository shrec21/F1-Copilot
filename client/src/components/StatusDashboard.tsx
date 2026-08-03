import { useEffect, useRef, useState } from 'react';
import { getStatus } from '../api';
import type { StatusResponse } from '../api';

// ── Info popover ─────────────────────────────────────────────────────────────

function InfoPopover({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-5 h-5 rounded-full border border-gray-300 text-gray-400 hover:text-blue-600 hover:border-blue-400 text-xs font-bold leading-none flex items-center justify-center transition-colors"
        aria-label="More information"
      >
        i
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs text-gray-600 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, max, status }: { value: number; max: number; status: 'ok' | 'warning' | 'exceeded' | 'safe' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color =
    status === 'exceeded' ? 'bg-red-500' :
    status === 'warning'  ? 'bg-yellow-400' :
    'bg-green-500';
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5 mt-2">
      <div
        className={`${color} h-2.5 rounded-full transition-all`}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      />
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, label }: { status: 'ok' | 'warning' | 'exceeded' | 'safe' | 'at-risk'; label?: string }) {
  const styles = {
    ok:       'bg-green-100 text-green-800',
    safe:     'bg-green-100 text-green-800',
    warning:  'bg-yellow-100 text-yellow-800',
    exceeded: 'bg-red-100 text-red-800',
    'at-risk':'bg-red-100 text-red-800',
  };
  const defaultLabels = { ok: 'OK', safe: 'Safe', warning: 'Warning', exceeded: 'Exceeded', 'at-risk': 'At Risk' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      {label ?? defaultLabels[status]}
    </span>
  );
}

// ── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ title, info, children }: { title: string; info: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{title}</h2>
        <InfoPopover>{info}</InfoPopover>
      </div>
      {children}
    </section>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export function StatusDashboard() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStatus()
      .then((res) => { setData(res); setLoading(false); })
      .catch((err: Error & { status?: number }) => {
        setLoading(false);
        if (err.status === 404) setNoProfile(true);
        else setError(err.message || 'Failed to load status');
      });
  }, []);

  if (loading) return <div className="p-6 text-gray-400 text-sm animate-pulse">Loading compliance status…</div>;
  if (noProfile) return (
    <div className="p-6 text-gray-600 bg-gray-50 rounded-xl border border-gray-200 text-sm">
      Set up your profile to see compliance status.
    </div>
  );
  if (error) return <div className="p-6 text-red-700 bg-red-50 rounded-xl border border-red-200 text-sm">Error: {error}</div>;
  if (!data) return null;

  const optCap = data.unemployment ? data.unemployment.usedDays + data.unemployment.remainingDays : 90;
  const cptCapDays = 360; // 12 months × 30 days

  return (
    <div className="space-y-4">

      {/* OPT Unemployment Clock */}
      <Card
        title="OPT Unemployment"
        info={
          <>
            <p className="font-semibold text-gray-800 mb-1">What is the OPT unemployment clock?</p>
            <p>While on OPT you are allowed a limited number of unemployed days. USCIS counts days when you have no authorized employment:</p>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li><strong>Standard OPT:</strong> 90-day cap</li>
              <li><strong>STEM OPT extension:</strong> 150-day cap</li>
            </ul>
            <p className="mt-1">Exceeding the cap means your OPT is considered violated, which can jeopardize your visa status. Consult your DSO immediately if you are approaching the limit.</p>
          </>
        }
      >
        {data.unemployment ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{data.unemployment.usedDays} <span className="text-sm font-normal text-gray-500">/ {optCap} days used</span></p>
                <p className="text-sm mt-0.5">
                  <span className={data.unemployment.remainingDays <= 0 ? 'text-red-600 font-semibold' : data.unemployment.remainingDays <= 20 ? 'text-yellow-600 font-semibold' : 'text-green-700 font-semibold'}>
                    {data.unemployment.remainingDays <= 0 ? 'No days remaining' : `${data.unemployment.remainingDays} days remaining`}
                  </span>
                </p>
              </div>
              <StatusBadge status={data.unemployment.status} />
            </div>
            <ProgressBar value={data.unemployment.usedDays} max={optCap} status={data.unemployment.status} />
            <p className="text-xs text-gray-400 mt-2">Rule: {data.unemployment.appliedRuleId}</p>
          </>
        ) : (
          <p className="text-sm text-gray-500">No OPT window on record. Log an OPT authorization to track unemployment days.</p>
        )}
      </Card>

      {/* CPT Impact */}
      <Card
        title="CPT — OPT Eligibility Impact"
        info={
          <>
            <p className="font-semibold text-gray-800 mb-1">How does CPT affect OPT eligibility?</p>
            <p>Under <strong>8 CFR § 214.2(f)(10)(ii)(A)</strong>, students who accumulate <strong>12 or more months of full-time CPT</strong> lose OPT eligibility entirely.</p>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li><strong>Full-time CPT:</strong> more than 20 hrs/week — counts toward the cap</li>
              <li><strong>Part-time CPT:</strong> 20 hrs/week or less — does not count</li>
            </ul>
            <p className="mt-1">This tool counts actual working days (not calendar months) and flags when you are approaching or have exceeded the 360-day (12-month) threshold.</p>
          </>
        }
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {data.cptImpact.totalFullTimeDays}
              <span className="text-sm font-normal text-gray-500"> / {cptCapDays} days full-time CPT</span>
            </p>
            <p className="text-sm mt-0.5">
              {data.cptImpact.optEligibilityAtRisk ? (
                <span className="text-red-600 font-semibold">OPT eligibility lost — 12-month cap exceeded</span>
              ) : (
                <span className="text-green-700 font-semibold">
                  {cptCapDays - data.cptImpact.totalFullTimeDays} days remaining before cap
                </span>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{data.cptImpact.totalFullTimeMonths} months</p>
          </div>
          <StatusBadge
            status={data.cptImpact.optEligibilityAtRisk ? 'at-risk' : 'safe'}
            label={data.cptImpact.optEligibilityAtRisk ? 'At Risk' : 'Safe'}
          />
        </div>
        <ProgressBar
          value={data.cptImpact.totalFullTimeDays}
          max={cptCapDays}
          status={data.cptImpact.optEligibilityAtRisk ? 'exceeded' : 'ok'}
        />
        <p className="text-xs text-gray-400 mt-2">Rule: {data.cptImpact.appliedRuleId}</p>
      </Card>

      {/* Concurrent Employment Conflicts */}
      <Card
        title="Concurrent Employment Conflicts"
        info={
          <>
            <p className="font-semibold text-gray-800 mb-1">What are concurrent employment conflicts?</p>
            <p>F-1 regulations tie CPT authorization to a specific employer and course. Issues arise when:</p>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li>Two CPT jobs overlap in time (each CPT authorization must be per-employer)</li>
              <li>Employment periods suggest unauthorized concurrent work</li>
            </ul>
            <p className="mt-1">Conflicts flagged here should be reviewed with your DSO — they do not necessarily mean a violation, but they require verification.</p>
          </>
        }
      >
        {!data.conflicts || data.conflicts.length === 0 ? (
          <div className="flex items-center gap-2">
            <StatusBadge status="ok" label="No conflicts" />
            <span className="text-sm text-gray-500">No overlapping employment periods detected.</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.conflicts.map((c, i) => (
              <li key={i} className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-800 border border-red-200">
                <p className="font-medium">{c.description}</p>
                <p className="text-xs mt-0.5 text-red-500">{c.overlapStart} – {c.overlapEnd}</p>
                <p className="text-xs text-red-400 mt-0.5">Rule: {c.ruleId}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* D/S Transition */}
      <Card
        title="D/S Status Transition"
        info={
          <>
            <p className="font-semibold text-gray-800 mb-1">What is the D/S transition?</p>
            <p><strong>Duration of Status (D/S)</strong> means your legal stay lasts as long as you maintain valid F-1 status — there is no fixed end date on your I-94.</p>
            <p className="mt-1">A USCIS rule effective <strong>September 15, 2026</strong> transitions D/S students to a fixed-date admission system. After your transition deadline:</p>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li>Your I-94 will show a specific end date instead of D/S</li>
              <li>You must maintain status within that date</li>
              <li>A grace period applies after your program ends</li>
            </ul>
            <p className="mt-1">Consult your DSO or an immigration attorney about how this affects your specific situation.</p>
          </>
        }
      >
        {data.dsStatus && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${data.dsStatus.regime === 'D/S' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                {data.dsStatus.regime === 'D/S' ? 'Currently D/S' : 'Fixed-date'}
              </span>
            </div>
            <div className="text-sm text-gray-700 space-y-1 mt-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Transition deadline</span>
                <span className="font-medium">{data.dsStatus.transitionDeadline ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Grace period end</span>
                <span className="font-medium">{data.dsStatus.graceperiodEndDate ?? 'N/A'}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">Rule: {data.dsStatus.appliedRuleId}</p>
          </div>
        )}
      </Card>

    </div>
  );
}
