import { randomUUID } from 'crypto';
import { SOURCES } from './sources';
import { fetchAndExtractText } from './fetcher';
import { summarizeChange } from './agent';
import {
  insertCheckLog,
  updateCheckLog,
  insertSourceSnapshot,
  insertReviewTicket,
  getLastSnapshot,
} from './queries';

function nowIso(): string {
  return new Date().toISOString();
}

export interface CheckerDeps {
  /** Override HTTP fetch + text extraction (used in tests to avoid real network calls). */
  fetchText?: (url: string) => Promise<{ hash: string; excerpt: string }>;
  /** Override the Claude summarizer (used in tests to avoid real API calls). */
  summarize?: (sourceId: string, oldExcerpt: string, newExcerpt: string) => Promise<string>;
}

/**
 * Runs one complete check cycle against all SOURCES.
 *
 * For each source:
 *   1. Fetch page + extract visible text
 *   2. Compare SHA-256 hash to the most recent stored snapshot
 *   3. If changed → call summarizeChange() → open a rule_review_queue ticket
 *   4. Always write a source_snapshots row (including unchanged runs — the log
 *      of "nothing changed" is as important as the log of changes)
 *
 * All DB writes happen via watcher/queries.ts, which has no access to any
 * rule-engine table. See that module's header comment for the boundary guarantee.
 *
 * @param deps - Optional overrides for fetch/summarize (enables unit testing
 *               without network or Claude API calls).
 */
export async function runCheckCycle(deps: CheckerDeps = {}): Promise<{
  sourcesChecked: number;
  changesFound: number;
  ticketsCreated: number;
  error: string | undefined;
}> {
  const fetchText = deps.fetchText ?? ((url: string) =>
    fetchAndExtractText(url).then(r => ({ hash: r.hash, excerpt: r.excerpt }))
  );
  const summarize = deps.summarize ?? summarizeChange;

  const runId = randomUUID();
  insertCheckLog(runId, nowIso());

  let sourcesChecked = 0;
  let changesFound = 0;
  let ticketsCreated = 0;
  let runError: string | undefined;

  for (const source of SOURCES) {
    try {
      const { hash, excerpt } = await fetchText(source.url);
      const prev = getLastSnapshot(source.id);

      // Bootstrap run (no previous snapshot): store baseline, do NOT open a ticket.
      // A first-run hash with no baseline isn't a "change" — it's just new data.
      const isBootstrap = prev === null;
      const changed = !isBootstrap && prev.contentHash !== hash;

      insertSourceSnapshot({
        id: randomUUID(),
        checkRunId: runId,
        sourceId: source.id,
        url: source.url,
        contentHash: hash,
        contentExcerpt: excerpt,
        checkedAt: nowIso(),
        changed: changed ? 1 : 0,
      });

      if (changed) {
        changesFound++;
        let diffSummary: string;
        try {
          diffSummary = await summarize(source.id, prev.contentExcerpt, excerpt);
        } catch (err) {
          // If Claude call fails, still open the ticket — human review is more
          // important than a missing AI summary.
          diffSummary =
            `[AI summary unavailable: ${(err as Error).message}]\n\n`
            + `Manual review required. Source: ${source.url}`;
        }

        insertReviewTicket({
          id: randomUUID(),
          sourceId: source.id,
          sourceUrl: source.url,
          diffSummary,
          affectedRuleIds: JSON.stringify(source.affectedRuleIds),
          createdAt: nowIso(),
        });
        ticketsCreated++;

        console.log(
          `[watcher] CHANGE DETECTED — ${source.id} — review ticket created`,
        );
      } else if (isBootstrap) {
        console.log(`[watcher] bootstrapped baseline for ${source.id}`);
      } else {
        console.log(`[watcher] no change — ${source.id}`);
      }

      sourcesChecked++;
    } catch (err) {
      // Log fetch failures but continue with remaining sources.
      const msg = (err as Error).message;
      console.error(`[watcher] failed to check ${source.id} (${source.url}): ${msg}`);
      runError = runError ? `${runError}; ${msg}` : msg;
    }
  }

  updateCheckLog(runId, {
    finishedAt: nowIso(),
    sourcesChecked,
    changesFound,
    ticketsCreated,
    error: runError,
  });

  console.log(
    `[watcher] cycle complete — ${sourcesChecked}/${SOURCES.length} sources checked, `
    + `${changesFound} change(s), ${ticketsCreated} ticket(s) created`,
  );

  return { sourcesChecked, changesFound, ticketsCreated, error: runError };
}
