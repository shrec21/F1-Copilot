import { useEffect, useState, useCallback } from 'react';
import {
  getWatcherLog,
  triggerWatcherRun,
  getReviewQueue,
  resolveReviewTicket,
} from '../api';
import type { WatcherCheckLog, ReviewTicket, ReviewStatus } from '../api';

// ─── Check log table ─────────────────────────────────────────────────────────

function CheckLogTable({ logs }: { logs: WatcherCheckLog[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">
        No check runs yet. Click "Run Check Now" to trigger one.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-gray-200">
      <table className="w-full text-xs">
        <thead className="bg-gray-100 text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Started</th>
            <th className="px-3 py-2 text-left font-medium">Finished</th>
            <th className="px-3 py-2 text-left font-medium">Sources</th>
            <th className="px-3 py-2 text-left font-medium">Changes</th>
            <th className="px-3 py-2 text-left font-medium">Tickets</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.map((log) => {
            const pending = log.finishedAt === null;
            return (
              <tr key={log.id} className={pending ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                <td className="px-3 py-2 font-mono text-gray-700">
                  {log.startedAt.slice(0, 16).replace('T', ' ')}
                </td>
                <td className="px-3 py-2 text-gray-500">
                  {log.finishedAt ? log.finishedAt.slice(0, 16).replace('T', ' ') : '—'}
                </td>
                <td className="px-3 py-2 text-center">{log.sourcesChecked}</td>
                <td className="px-3 py-2 text-center">
                  {log.changesFound > 0 ? (
                    <span className="font-bold text-amber-700">{log.changesFound}</span>
                  ) : (
                    <span className="text-gray-400">{log.changesFound}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {log.ticketsCreated > 0 ? (
                    <span className="font-bold text-red-700">{log.ticketsCreated}</span>
                  ) : (
                    <span className="text-gray-400">{log.ticketsCreated}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {pending ? (
                    <span className="text-blue-600 animate-pulse">Running…</span>
                  ) : log.error ? (
                    <span className="text-red-600" title={log.error}>Error</span>
                  ) : (
                    <span className="text-green-600">Done</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Review ticket card ───────────────────────────────────────────────────────

const RESOLUTION_LABELS: Record<Exclude<ReviewStatus, 'pending'>, string> = {
  'reviewed-no-change': 'No change needed',
  'reviewed-rule-updated': 'Rule updated',
  'reviewed-false-positive': 'False positive',
};

const STATUS_STYLES: Record<ReviewStatus, string> = {
  'pending': 'bg-amber-100 text-amber-800 border-amber-300',
  'reviewed-no-change': 'bg-green-100 text-green-800 border-green-300',
  'reviewed-rule-updated': 'bg-blue-100 text-blue-800 border-blue-300',
  'reviewed-false-positive': 'bg-gray-100 text-gray-600 border-gray-300',
};

function ReviewTicketCard({
  ticket,
  onResolved,
}: {
  ticket: ReviewTicket;
  onResolved: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState<Exclude<ReviewStatus, 'pending'>>('reviewed-no-change');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResolve() {
    if (!note.trim()) { setError('Reviewer note is required.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await resolveReviewTicket(ticket.id, resolution, note);
      onResolved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const isPending = ticket.status === 'pending';

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between gap-4 p-4 bg-white">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${STATUS_STYLES[ticket.status]}`}>
              {ticket.status === 'pending' ? 'Pending Review' : RESOLUTION_LABELS[ticket.status as Exclude<ReviewStatus, 'pending'>]}
            </span>
            <span className="text-xs text-gray-400">{ticket.createdAt.slice(0, 16).replace('T', ' ')}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-800 font-mono truncate" title={ticket.sourceId}>
            {ticket.sourceId}
          </p>
          <a
            href={ticket.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline truncate block"
          >
            {ticket.sourceUrl}
          </a>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {/* Affected rules */}
      <div className="px-4 pb-3 bg-white border-t border-gray-100">
        <p className="text-xs text-gray-500 mb-1">Affected rules:</p>
        <div className="flex flex-wrap gap-1">
          {ticket.affectedRuleIds.map(ruleId => (
            <span key={ruleId} className="bg-purple-50 border border-purple-200 text-purple-800 text-xs rounded px-1.5 py-0.5 font-mono">
              {ruleId}
            </span>
          ))}
        </div>
      </div>

      {/* Expanded: diff summary + resolve form */}
      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">AI Change Summary</p>
            <div className="rounded border border-gray-200 bg-white p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {ticket.diffSummary}
            </div>
          </div>

          {ticket.status !== 'pending' && ticket.reviewerNote && (
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Reviewer Note</p>
              <div className="rounded border border-gray-200 bg-white p-3 text-sm text-gray-600">
                {ticket.reviewerNote}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Reviewed {ticket.reviewedAt?.slice(0, 16).replace('T', ' ')}
              </p>
            </div>
          )}

          {isPending && (
            <div className="rounded border border-amber-200 bg-amber-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Resolve this ticket</p>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Resolution</label>
                <select
                  value={resolution}
                  onChange={e => setResolution(e.target.value as Exclude<ReviewStatus, 'pending'>)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
                >
                  <option value="reviewed-no-change">No change needed — rule is still accurate</option>
                  <option value="reviewed-rule-updated">Rule updated — I have updated the rule engine</option>
                  <option value="reviewed-false-positive">False positive — not a meaningful change</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Reviewer note <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="Describe what you reviewed and what (if anything) was changed in the rule engine…"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 resize-y"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleResolve}
                  disabled={submitting}
                  className="px-4 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Mark Resolved'}
                </button>
                <button
                  onClick={() => setResolving(false)}
                  className="px-4 py-1.5 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* auto-open resolve form when clicking "Resolve" on pending cards */}
      {isPending && !expanded && !resolving && (
        <div className="border-t border-gray-100 px-4 py-2 bg-white">
          <button
            onClick={() => { setExpanded(true); setResolving(true); }}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Review &amp; resolve →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function RegulationWatcherTab() {
  const [logs, setLogs] = useState<WatcherCheckLog[]>([]);
  const [tickets, setTickets] = useState<ReviewTicket[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('all');

  const loadLogs = useCallback(() => {
    getWatcherLog()
      .then(data => { setLogs(data); setLogsLoading(false); })
      .catch((err: Error) => { setError(err.message); setLogsLoading(false); });
  }, []);

  const loadTickets = useCallback(() => {
    const filter = statusFilter === 'all' ? undefined : statusFilter;
    getReviewQueue(filter)
      .then(data => { setTickets(data); setTicketsLoading(false); })
      .catch((err: Error) => { setError(err.message); setTicketsLoading(false); });
  }, [statusFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { loadTickets(); setTicketsLoading(true); }, [loadTickets]);

  async function handleTrigger() {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await triggerWatcherRun();
      setTriggerMsg(res.message);
      // Poll logs every 3s for up to 45s to catch the completed run
      let polls = 0;
      const poll = setInterval(() => {
        polls++;
        void getWatcherLog().then(setLogs);
        void getReviewQueue().then(setTickets);
        if (polls >= 15) clearInterval(poll);
      }, 3_000);
    } catch (err) {
      setTriggerMsg(`Error: ${(err as Error).message}`);
    } finally {
      setTriggering(false);
    }
  }

  const pendingCount = tickets.filter(t => t.status === 'pending').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Regulation-Change Watcher</h2>
        <p className="text-sm text-gray-500 mt-1">
          Monitors 5 regulatory source pages daily. When content changes, it opens a review
          ticket — it never modifies a rule automatically.
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Check log */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
            Check Run History
          </h3>
          <div className="flex items-center gap-3">
            {triggerMsg && (
              <span className="text-xs text-gray-500">{triggerMsg}</span>
            )}
            <button
              onClick={handleTrigger}
              disabled={triggering}
              className="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {triggering ? 'Starting…' : 'Run Check Now'}
            </button>
          </div>
        </div>
        {logsLoading ? (
          <p className="text-sm text-gray-400 animate-pulse">Loading…</p>
        ) : (
          <CheckLogTable logs={logs} />
        )}
      </section>

      {/* Review queue */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
            Review Queue
            {pendingCount > 0 && (
              <span className="ml-2 inline-block rounded-full bg-red-500 text-white text-xs px-2 py-0.5">
                {pendingCount}
              </span>
            )}
          </h3>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as ReviewStatus | 'all')}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
          >
            <option value="all">All tickets</option>
            <option value="pending">Pending</option>
            <option value="reviewed-no-change">No change</option>
            <option value="reviewed-rule-updated">Rule updated</option>
            <option value="reviewed-false-positive">False positive</option>
          </select>
        </div>

        {ticketsLoading ? (
          <p className="text-sm text-gray-400 animate-pulse">Loading…</p>
        ) : tickets.length === 0 ? (
          <div className="rounded border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            No tickets
            {statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.
            {statusFilter === 'all' && pendingCount === 0 && (
              <span> Tickets appear here when the watcher detects a source change.</span>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map(ticket => (
              <ReviewTicketCard
                key={ticket.id}
                ticket={ticket}
                onResolved={() => { loadTickets(); loadLogs(); }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Architecture note — visible to demo visitors */}
      <section className="rounded border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700">How the boundary works</p>
        <p>
          The watcher fetches each source page, hashes the visible text, and compares to the
          last stored hash. If changed, it calls Claude with the old and new excerpts —
          <strong> with no tools array</strong>, so the model can only return text, never
          invoke a function.
        </p>
        <p>
          The Claude call lives in <code>src/watcher/agent.ts</code> and imports nothing from
          the rule engine or the queries module. The only writes in the entire{' '}
          <code>src/watcher/</code> directory go to three tables:{' '}
          <code>watcher_check_log</code>, <code>source_snapshots</code>, and{' '}
          <code>rule_review_queue</code>. There is no code path by which the watcher can
          modify a compliance rule.
        </p>
      </section>
    </div>
  );
}
