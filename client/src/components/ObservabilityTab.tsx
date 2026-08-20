import { useEffect, useRef, useState } from 'react';
import { getMetrics } from '../api';
import type { MetricsResponse, LatencyStat } from '../api';

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt(ms: number | null, unit = 'ms'): string {
  if (ms === null) return '—';
  if (unit === 's' || ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(1)} ms`;
}

function latencyColor(ms: number | null, warnMs: number, critMs: number): string {
  if (ms === null) return 'text-gray-400';
  if (ms >= critMs) return 'text-red-600';
  if (ms >= warnMs) return 'text-yellow-600';
  return 'text-green-700';
}

function barColor(ms: number, warnMs: number, critMs: number): string {
  if (ms >= critMs) return 'bg-red-400';
  if (ms >= warnMs) return 'bg-yellow-400';
  return 'bg-green-400';
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values, warnMs, critMs }: { values: number[]; warnMs: number; critMs: number }) {
  if (values.length === 0) {
    return <p className="text-xs text-gray-400 mt-2">No samples yet.</p>;
  }
  const max = Math.max(...values);
  return (
    <div className="flex items-end gap-px h-10 mt-3">
      {values.map((v, i) => (
        <div
          key={i}
          title={`${v.toFixed(1)} ms`}
          className={`flex-1 rounded-sm ${barColor(v, warnMs, critMs)}`}
          style={{ height: `${Math.max(8, (v / (max || 1)) * 100)}%` }}
        />
      ))}
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  title,
  stat,
  sparkline,
  warnMs,
  critMs,
  unit,
}: {
  title: string;
  stat: LatencyStat;
  sparkline: number[];
  warnMs: number;
  critMs: number;
  unit?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">p50</p>
          <p className={`text-xl font-bold ${latencyColor(stat.p50Ms, warnMs, critMs)}`}>
            {fmt(stat.p50Ms, unit)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">p95</p>
          <p className={`text-xl font-bold ${latencyColor(stat.p95Ms, warnMs, critMs)}`}>
            {fmt(stat.p95Ms, unit)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-0.5">samples</p>
          <p className="text-xl font-bold text-gray-700">{stat.count}</p>
        </div>
      </div>
      <Sparkline values={sparkline} warnMs={warnMs} critMs={critMs} />
      {stat.count === 0 && (
        <p className="text-xs text-gray-400 mt-1">Trigger some requests to populate.</p>
      )}
    </div>
  );
}

// ── Stat row ──────────────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{value}</span>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{children}</h3>
  );
}

// ── Rule distribution bar ─────────────────────────────────────────────────────

function RuleBar({
  ruleId, pass, warning, violation, notApplicable, total,
}: {
  ruleId: string; pass: number; warning: number;
  violation: number; notApplicable: number; total: number;
}) {
  const pct = (n: number) => total > 0 ? (n / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-52 shrink-0 truncate" title={ruleId}>{ruleId}</span>
      <div className="flex-1 flex rounded overflow-hidden h-4">
        {pass > 0 && (
          <div className="bg-green-400" style={{ width: `${pct(pass)}%` }} title={`${pass} pass`} />
        )}
        {warning > 0 && (
          <div className="bg-yellow-400" style={{ width: `${pct(warning)}%` }} title={`${warning} warning`} />
        )}
        {violation > 0 && (
          <div className="bg-red-400" style={{ width: `${pct(violation)}%` }} title={`${violation} violation`} />
        )}
        {notApplicable > 0 && (
          <div className="bg-gray-200" style={{ width: `${pct(notApplicable)}%` }} title={`${notApplicable} N/A`} />
        )}
      </div>
      <div className="flex gap-2 text-xs shrink-0">
        {pass > 0 && <span className="text-green-700">{pass}P</span>}
        {warning > 0 && <span className="text-yellow-700">{warning}W</span>}
        {violation > 0 && <span className="text-red-700">{violation}V</span>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const AUTO_REFRESH_INTERVAL_MS = 30_000;

export function ObservabilityTab() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const m = await getMetrics();
      setData(m);
      setRefreshedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(load, AUTO_REFRESH_INTERVAL_MS);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh]);

  // Overall system health
  const healthy = data
    ? data.outbox.pendingCount === 0 && data.watcher.errorRate === 0 &&
      !data.ruleDistribution.some(r => r.violation > 0)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Observability</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Latency, outbox health, watcher sources, and cohort rule distribution.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {refreshedAt && (
            <span className="text-xs text-gray-400">Updated {refreshedAt}</span>
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto (30s)
          </label>
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* System health banner */}
      {healthy !== null && (
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
          healthy
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-yellow-50 border-yellow-200 text-yellow-800'
        }`}>
          <span className={`text-lg ${healthy ? 'text-green-500' : 'text-yellow-500'}`}>
            {healthy ? '●' : '◐'}
          </span>
          <span className="text-sm font-medium">
            {healthy ? 'All systems healthy' : 'Issues detected — check sections below'}
          </span>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Rule Engine */}
          <section>
            <SectionHeading>Rule Engine</SectionHeading>
            <MetricCard
              title="evaluateAllRules() — per student"
              stat={data.ruleEval}
              sparkline={data.sparklines.ruleEval}
              warnMs={5}
              critMs={20}
            />
          </section>

          {/* Claude API */}
          <section>
            <SectionHeading>Claude API (Anthropic)</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricCard
                title="Chat agent — askAgent()"
                stat={data.askAgent}
                sparkline={data.sparklines.askAgent}
                warnMs={3000}
                critMs={8000}
                unit="s"
              />
              <MetricCard
                title="DSO email generator"
                stat={data.dsoEmail}
                sparkline={data.sparklines.dsoEmail}
                warnMs={3000}
                critMs={8000}
                unit="s"
              />
            </div>
          </section>

          {/* Outbox */}
          <section>
            <SectionHeading>Outbox Health</SectionHeading>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  data.outbox.pendingCount === 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {data.outbox.pendingCount === 0 ? 'No pending events' : `${data.outbox.pendingCount} pending`}
                </span>
                <span className="text-xs text-gray-400">
                  {data.outbox.dispatchedCount} dispatched total
                </span>
              </div>
              <StatRow label="Avg dispatch lag" value={fmt(data.outbox.avgLagMs)} />
              <StatRow label="p95 dispatch lag" value={fmt(data.outbox.p95LagMs)} />
              {data.outbox.dispatchedCount === 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Outbox lag appears once events are processed by the dispatcher.
                </p>
              )}
            </div>
          </section>

          {/* Watcher */}
          <section>
            <SectionHeading>Regulation Watcher</SectionHeading>
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                    data.watcher.errorRate === 0
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {data.watcher.errorRate === 0
                      ? 'No errors'
                      : `${(data.watcher.errorRate * 100).toFixed(1)}% error rate`}
                  </span>
                  <span className="text-xs text-gray-400">
                    {data.watcher.totalRuns} run{data.watcher.totalRuns !== 1 ? 's' : ''} recorded
                  </span>
                </div>
                <StatRow
                  label="Last run"
                  value={data.watcher.lastRunAt
                    ? new Date(data.watcher.lastRunAt).toLocaleString()
                    : '—'}
                />
                <StatRow label="Avg run duration" value={fmt(data.watcher.avgDurationMs, 's')} />
                <StatRow label="p95 run duration" value={fmt(data.watcher.p95DurationMs, 's')} />
              </div>

              {/* Per-source table */}
              {data.sources.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-2 font-semibold text-gray-500">Source</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-500">Last checked</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sources.map(s => (
                        <tr key={s.sourceId} className="border-b border-gray-50 last:border-0">
                          <td className="px-4 py-2 font-mono text-gray-700">{s.sourceId}</td>
                          <td className="px-4 py-2 text-gray-500">
                            {new Date(s.checkedAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold ${
                              s.changed
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {s.changed ? 'Changed' : 'No change'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Rule distribution */}
          {data.ruleDistribution.length > 0 && (
            <section>
              <SectionHeading>Rule Violation Distribution — Synthetic Cohort</SectionHeading>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
                <div className="flex gap-4 text-xs text-gray-500 mb-1">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" />Pass</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" />Warning</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Violation</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" />N/A</span>
                </div>
                {data.ruleDistribution.map(r => (
                  <RuleBar key={r.ruleId} {...r} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
