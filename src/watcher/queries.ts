/**
 * Database queries for the regulation-change watcher.
 *
 * BOUNDARY ENFORCEMENT: This module writes ONLY to the three watcher tables:
 *   watcher_check_log, source_snapshots, rule_review_queue.
 *
 * It imports nothing from the rule engine and contains no function that can
 * read or write ComplianceRule data. This is the structural guarantee that the
 * watcher subsystem cannot automatically modify any rule — there is no such
 * affordance in this module's public API.
 */

import { db } from '../data/schema';

// ── Check log ────────────────────────────────────────────────────────────────

export function insertCheckLog(id: string, startedAt: string): void {
  db.prepare(`
    INSERT INTO watcher_check_log (id, started_at)
    VALUES (?, ?)
  `).run(id, startedAt);
}

export function updateCheckLog(
  id: string,
  data: {
    finishedAt: string;
    sourcesChecked: number;
    changesFound: number;
    ticketsCreated: number;
    error?: string;
  },
): void {
  db.prepare(`
    UPDATE watcher_check_log
    SET finished_at = ?, sources_checked = ?, changes_found = ?, tickets_created = ?, error = ?
    WHERE id = ?
  `).run(
    data.finishedAt,
    data.sourcesChecked,
    data.changesFound,
    data.ticketsCreated,
    data.error ?? null,
    id,
  );
}

export function getCheckLogs(limit = 20): Array<{
  id: string;
  startedAt: string;
  finishedAt: string | null;
  sourcesChecked: number;
  changesFound: number;
  ticketsCreated: number;
  error: string | null;
}> {
  return db.prepare(`
    SELECT id, started_at AS startedAt, finished_at AS finishedAt,
           sources_checked AS sourcesChecked, changes_found AS changesFound,
           tickets_created AS ticketsCreated, error
    FROM watcher_check_log
    ORDER BY started_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: string; startedAt: string; finishedAt: string | null;
    sourcesChecked: number; changesFound: number; ticketsCreated: number; error: string | null;
  }>;
}

// ── Source snapshots ─────────────────────────────────────────────────────────

export function insertSourceSnapshot(snap: {
  id: string;
  checkRunId: string;
  sourceId: string;
  url: string;
  contentHash: string;
  contentExcerpt: string;
  checkedAt: string;
  changed: 0 | 1;
}): void {
  db.prepare(`
    INSERT INTO source_snapshots
      (id, check_run_id, source_id, url, content_hash, content_excerpt, checked_at, changed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    snap.id, snap.checkRunId, snap.sourceId, snap.url,
    snap.contentHash, snap.contentExcerpt, snap.checkedAt, snap.changed,
  );
}

/** Returns the most recent snapshot for every source — for the observability source table. */
export function getLatestSourceSnapshots(): Array<{
  sourceId: string;
  url: string;
  checkedAt: string;
  changed: boolean;
}> {
  const rows = db.prepare(`
    SELECT s.source_id AS sourceId, s.url, s.checked_at AS checkedAt, s.changed
    FROM source_snapshots s
    INNER JOIN (
      SELECT source_id, MAX(checked_at) AS max_checked
      FROM source_snapshots
      GROUP BY source_id
    ) latest ON s.source_id = latest.source_id AND s.checked_at = latest.max_checked
    ORDER BY s.source_id
  `).all() as Array<{ sourceId: string; url: string; checkedAt: string; changed: number }>;
  return rows.map(r => ({ ...r, changed: r.changed === 1 }));
}

/** Returns the most recent snapshot for a source, or null on first run (bootstrap). */
export function getLastSnapshot(sourceId: string): {
  contentHash: string;
  contentExcerpt: string;
} | null {
  const row = db.prepare(`
    SELECT content_hash AS contentHash, content_excerpt AS contentExcerpt
    FROM source_snapshots
    WHERE source_id = ?
    ORDER BY checked_at DESC
    LIMIT 1
  `).get(sourceId) as { contentHash: string; contentExcerpt: string } | undefined;
  return row ?? null;
}

// ── Review queue ─────────────────────────────────────────────────────────────

export function insertReviewTicket(ticket: {
  id: string;
  sourceId: string;
  sourceUrl: string;
  diffSummary: string;
  affectedRuleIds: string;   // JSON-encoded string[]
  createdAt: string;
}): void {
  db.prepare(`
    INSERT INTO rule_review_queue
      (id, source_id, source_url, diff_summary, affected_rule_ids, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    ticket.id, ticket.sourceId, ticket.sourceUrl,
    ticket.diffSummary, ticket.affectedRuleIds, ticket.createdAt,
  );
}

export type ReviewStatus =
  | 'pending'
  | 'reviewed-no-change'
  | 'reviewed-rule-updated'
  | 'reviewed-false-positive';

export interface ReviewTicketRow {
  id: string;
  sourceId: string;
  sourceUrl: string;
  diffSummary: string;
  affectedRuleIds: string[];
  createdAt: string;
  status: ReviewStatus;
  reviewedAt: string | null;
  reviewerNote: string | null;
}

export function getAllReviewTickets(status?: ReviewStatus): ReviewTicketRow[] {
  const rows = status
    ? db.prepare(`
        SELECT id, source_id AS sourceId, source_url AS sourceUrl,
               diff_summary AS diffSummary, affected_rule_ids AS affectedRuleIds,
               created_at AS createdAt, status, reviewed_at AS reviewedAt,
               reviewer_note AS reviewerNote
        FROM rule_review_queue WHERE status = ? ORDER BY created_at DESC
      `).all(status)
    : db.prepare(`
        SELECT id, source_id AS sourceId, source_url AS sourceUrl,
               diff_summary AS diffSummary, affected_rule_ids AS affectedRuleIds,
               created_at AS createdAt, status, reviewed_at AS reviewedAt,
               reviewer_note AS reviewerNote
        FROM rule_review_queue ORDER BY created_at DESC
      `).all();

  return (rows as Array<Omit<ReviewTicketRow, 'affectedRuleIds'> & { affectedRuleIds: string }>)
    .map(r => ({ ...r, affectedRuleIds: JSON.parse(r.affectedRuleIds) as string[] }));
}

export function resolveReviewTicket(
  id: string,
  status: Exclude<ReviewStatus, 'pending'>,
  reviewerNote: string,
  reviewedAt: string,
): boolean {
  const result = db.prepare(`
    UPDATE rule_review_queue
    SET status = ?, reviewer_note = ?, reviewed_at = ?
    WHERE id = ? AND status = 'pending'
  `).run(status, reviewerNote, reviewedAt, id);
  return result.changes > 0;
}
