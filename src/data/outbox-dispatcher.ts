/**
 * Transactional outbox dispatcher.
 *
 * Polls outbox_events every 2 seconds for undispatched events.
 * For each event, evaluates all compliance rules against the student and writes
 * the results to compliance_events + audit_trail — all in a single SQLite
 * transaction (guaranteeing consistency even if the process crashes mid-flight).
 *
 * To migrate to a real message broker (Kafka, Redis Streams, etc.), replace the
 * setInterval loop with a broker consumer and replace insertComplianceEvent with
 * a broker publish call. The rule evaluation and audit-trail writes are unchanged.
 */

import { randomUUID } from 'crypto';
import { getDb } from './schema';
import {
  getUndispatchedEvents,
  getStudentById,
  getRuleContextForStudent,
  insertComplianceEvent,
  insertAuditEntry,
  markEventDispatched,
} from './queries';
import { evaluateAllRules } from '@f1/rule-engine';

const POLL_INTERVAL_MS = 2_000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Processes one outbox event inside the caller's transaction. */
function processEvent(event: {
  id: string;
  type: string;
  studentId: string;
  payload: string;
  createdAt: string;
}): void {
  const student = getStudentById(event.studentId);
  if (!student) {
    // Student may have been deleted; mark dispatched and skip
    markEventDispatched(event.id, nowIso());
    return;
  }

  const context = getRuleContextForStudent(event.studentId);
  const results = evaluateAllRules(student, context, todayIso());

  const eventId = randomUUID();
  insertComplianceEvent({
    id: eventId,
    type: event.type,
    studentId: event.studentId,
    occurredAt: event.createdAt,
    payload: JSON.parse(event.payload) as Record<string, unknown>,
  });

  for (const result of results) {
    insertAuditEntry({
      id: randomUUID(),
      studentId: event.studentId,
      eventId,
      ruleId: result.rule.id,
      ruleVersion: result.rule.version,
      status: result.status,
      inputsJson: JSON.stringify(result.inputs),
      outputsJson: JSON.stringify(result.outputs),
      sourceCitation: result.rule.sourceCitation,
      message: result.message,
      createdAt: nowIso(),
    });
  }

  markEventDispatched(event.id, nowIso());
}

/** Runs one dispatch cycle: wraps everything in a single SQLite transaction. */
function dispatchCycle(): void {
  const events = getUndispatchedEvents(20);
  if (events.length === 0) return;

  const db = getDb();
  const runInTransaction = db.transaction(() => {
    for (const event of events) {
      processEvent(event);
    }
  });

  try {
    runInTransaction();
  } catch (err) {
    // Log but do not crash — the outbox rows remain undispatched and will be retried
    console.error('[outbox-dispatcher] dispatch cycle failed:', err);
  }
}

let _intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startOutboxDispatcher(): void {
  if (_intervalHandle) return; // already running
  _intervalHandle = setInterval(dispatchCycle, POLL_INTERVAL_MS);
  // Run immediately on start so the first event is not delayed 2 seconds
  dispatchCycle();
}

export function stopOutboxDispatcher(): void {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}
