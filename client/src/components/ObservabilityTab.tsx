import { useEffect, useState } from 'react';
import { getMetrics } from '../api';
import type { MetricsResponse, LatencyStat } from '../api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(ms: number | null, unit = 'ms'): string {
  if (ms === null) return '—';
  if (unit === 's' || ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(1)} ms`;
}

function severityColor(ms: number | null, warnMs: number, critMs: number): string {
  if (ms === null) return 'text-gray-400';
  if (ms >= critMs) return 'text-red-600';
  if (ms >= warnMs) return 'text-yellow-600';
  return 'text-green-700';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  title,
  stat,
  warnMs,
  critMs,
  unit,
}: {
  title: string;
  stat: LatencyStat;
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
          <p className={`text-xl font-bold ${severityColor(stat.p50Ms, warnMs, critMs)}`}>
            {fmt(stat.p50Ms, unit)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-0.5">p95</p>
          <p className={`text-xl font-bold ${severityColor(stat.p95Ms, warnMs, critMs)}`}>
            {fmt(stat.p95Ms, unit)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-0.5">samples</p>
          <p className="text-xl font-bold text-gray-700">{stat.count}</p>
        </div>
      </div>
      {stat.count === 0 && (
        <p className="text-xs text-gray-400 mt-2">No data yet — trigger some requests to populate.</p>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ObservabilityTab() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Observability</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Live performance metrics — latency, outbox health, and watcher runs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {refreshedAt && (
            <span className="text-xs text-gray-400">Updated {refreshedAt}</span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Rule Engine */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Rule Engine
            </h3>
            <MetricCard
              title="evaluateAllRules() — per student"
              stat={data.ruleEval}
              warnMs={5}
              critMs={20}
            />
          </section>

          {/* Claude API */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Claude API (Anthropic)
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricCard
                title="Chat agent — askAgent()"
                stat={data.askAgent}
                warnMs={3000}
                critMs={8000}
                unit="s"
              />
              <MetricCard
                title="DSO email generator"
                stat={data.dsoEmail}
                warnMs={3000}
                critMs={8000}
                unit="s"
              />
            </div>
          </section>

          {/* Outbox */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Outbox Health
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  data.outbox.pendingCount === 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {data.outbox.pendingCount === 0 ? 'Healthy' : `${data.outbox.pendingCount} pending`}
                </span>
                <span className="text-xs text-gray-400">
                  {data.outbox.dispatchedCount} events dispatched total
                </span>
              </div>
              <StatRow label="Avg dispatch lag" value={fmt(data.outbox.avgLagMs)} />
              <StatRow label="p95 dispatch lag" value={fmt(data.outbox.p95LagMs)} />
              {data.outbox.dispatchedCount === 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  No dispatched events yet — outbox lag will appear once events are processed.
                </p>
              )}
            </div>
          </section>

          {/* Watcher */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Regulation Watcher
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  data.watcher.errorRate === 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {data.watcher.errorRate === 0 ? 'No errors' : `${(data.watcher.errorRate * 100).toFixed(1)}% error rate`}
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
          </section>
        </>
      )}

      {!data && !loading && !error && (
        <p className="text-sm text-gray-500">No metrics data available.</p>
      )}
    </div>
  );
}
