import { useEffect, useState } from 'react';
import { getStatus } from '../api';
import type { StatusResponse } from '../api';

function ProgressBar({ value, max, status }: { value: number; max: number; status: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color =
    status === 'exceeded'
      ? 'bg-red-500'
      : status === 'warning'
      ? 'bg-yellow-400'
      : 'bg-green-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 mt-1">
      <div
        className={`${color} h-3 rounded-full transition-all`}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      />
    </div>
  );
}

export function StatusDashboard() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStatus()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: Error & { status?: number }) => {
        setLoading(false);
        if (err.status === 404) {
          setNoProfile(true);
        } else {
          setError(err.message || 'Failed to load status');
        }
      });
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-gray-500 animate-pulse">Loading compliance status…</div>
    );
  }

  if (noProfile) {
    return (
      <div className="p-6 text-gray-600 bg-gray-50 rounded-lg border border-gray-200">
        Set up your profile to see compliance status.
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-700 bg-red-50 rounded-lg border border-red-200">
        Error: {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* OPT Unemployment Clock */}
      {data.unemployment && (
        <section className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-2">
            OPT Unemployment Clock
          </h2>
          <p className="text-sm text-gray-600">
            <span className="font-medium">{data.unemployment.usedDays}</span> /{' '}
            {data.unemployment.usedDays + data.unemployment.remainingDays} days used
          </p>
          <ProgressBar
            value={data.unemployment.usedDays}
            max={data.unemployment.usedDays + data.unemployment.remainingDays}
            status={data.unemployment.status}
          />
          <p
            className={`mt-1 text-xs font-medium ${
              data.unemployment.status === 'exceeded'
                ? 'text-red-600'
                : data.unemployment.status === 'warning'
                ? 'text-yellow-600'
                : 'text-green-600'
            }`}
          >
            Status: {data.unemployment.status.toUpperCase()}
          </p>
          <p className="text-xs text-gray-500 mt-1">{data.unemployment.disclaimer}</p>
          <p className="text-xs text-gray-400 mt-0.5">Rule: {data.unemployment.appliedRuleId}</p>
        </section>
      )}

      {/* CPT Impact */}
      {data.cptImpact && (
        <section className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-2">CPT Impact</h2>
          <p className="text-sm text-gray-600">
            Full-time CPT months:{' '}
            <span className="font-medium">{data.cptImpact.totalFullTimeMonths}</span>
          </p>
          <p
            className={`text-sm font-medium mt-1 ${
              data.cptImpact.optEligibilityAtRisk ? 'text-red-600' : 'text-green-600'
            }`}
          >
            OPT eligibility at risk:{' '}
            {data.cptImpact.optEligibilityAtRisk ? 'YES' : 'NO'}
          </p>
          <p className="text-xs text-gray-500 mt-1">{data.cptImpact.disclaimer}</p>
          <p className="text-xs text-gray-400 mt-0.5">Rule: {data.cptImpact.appliedRuleId}</p>
        </section>
      )}

      {/* Conflicts */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-2">Conflicts</h2>
        {!data.conflicts || data.conflicts.length === 0 ? (
          <p className="text-sm text-green-600">No conflicts detected</p>
        ) : (
          <ul className="space-y-2">
            {data.conflicts.map((c, i) => (
              <li
                key={i}
                className="text-sm px-3 py-2 rounded bg-red-50 text-red-800 border border-red-200"
              >
                <p className="font-medium">{c.description}</p>
                <p className="text-xs mt-0.5 text-red-600">
                  {c.overlapStart} – {c.overlapEnd}
                </p>
                <p className="text-xs text-red-400 mt-0.5">Rule: {c.ruleId}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* D/S Transition */}
      {data.dsStatus && (
        <section className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-2">D/S Transition</h2>
          <dl className="text-sm text-gray-600 space-y-1">
            <div>
              <dt className="inline font-medium">Regime: </dt>
              <dd className="inline">{data.dsStatus.regime}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Transition deadline: </dt>
              <dd className="inline">{data.dsStatus.transitionDeadline ?? 'N/A'}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Grace period end: </dt>
              <dd className="inline">{data.dsStatus.graceperiodEndDate ?? 'N/A'}</dd>
            </div>
          </dl>
          <p className="text-xs text-gray-500 mt-1">{data.dsStatus.disclaimer}</p>
          <p className="text-xs text-gray-400 mt-0.5">Rule: {data.dsStatus.appliedRuleId}</p>
        </section>
      )}
    </div>
  );
}
