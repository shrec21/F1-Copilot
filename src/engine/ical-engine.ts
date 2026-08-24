import type { Deadline } from './deadline-engine';

/**
 * RFC 5545 iCal text escaping: backslash-escape semicolons, commas, backslashes,
 * and convert newlines to literal \n.
 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * RFC 5545 line folding: lines longer than 75 octets are folded by inserting
 * a CRLF followed by a single space character.
 */
function foldLine(line: string): string {
  const MAX = 75;
  if (Buffer.byteLength(line, 'utf-8') <= MAX) return line;

  const parts: string[] = [];
  let remaining = line;
  let isFirst = true;

  while (Buffer.byteLength(remaining, 'utf-8') > MAX) {
    // On continuation lines the leading space counts toward the 75-byte limit
    const limit = isFirst ? MAX : MAX - 1;
    let cut = limit;
    // Walk back to avoid splitting a multi-byte character
    while (cut > 0 && Buffer.byteLength(remaining.slice(0, cut), 'utf-8') > limit) {
      cut--;
    }
    parts.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
    isFirst = false;
  }

  if (remaining.length > 0) {
    parts.push(remaining);
  }

  return parts.join('\r\n ');
}

/**
 * Format an ISO date string (YYYY-MM-DD) as an iCal DATE value (YYYYMMDD).
 */
function toIcalDate(iso: string): string {
  return iso.replace(/-/g, '');
}

/**
 * Return the next calendar day as YYYYMMDD (for exclusive DTEND on all-day events).
 */
function nextDay(iso: string): string {
  const parts = iso.split('-');
  const d = new Date(Date.UTC(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10),
  ));
  d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Map deadline severity to a summary prefix.
 */
function severityPrefix(severity: Deadline['severity']): string {
  switch (severity) {
    case 'critical': return '[CRITICAL]';
    case 'warning':  return '[WARNING]';
    case 'info':     return '[INFO]';
    default:         return '';
  }
}

/**
 * Generate an RFC 5545 iCal string from an array of deadlines.
 *
 * Pure function — no I/O, deterministic given the same inputs.
 * Past deadlines (severity === 'past') are filtered out.
 * Each remaining deadline becomes an all-day VEVENT with two VALARM reminders
 * (7 days and 1 day before).
 */
export function generateIcal(deadlines: Deadline[], nowIso: string): string {
  const activeDeadlines = deadlines.filter(d => d.severity !== 'past');

  const dtstamp = nowIso.replace(/-/g, '') + 'T000000Z';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//F1 Compliance Copilot//Deadlines//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:F1 Compliance Deadlines`,
  ];

  for (const d of activeDeadlines) {
    const uid = `${d.id}@f1-compliance-copilot`;
    const prefix = severityPrefix(d.severity);
    const summary = prefix ? `${prefix} ${d.title}` : d.title;
    const description = `${d.description}\\n\\nCitation: ${d.citation}`;

    lines.push('BEGIN:VEVENT');
    lines.push(foldLine(`UID:${uid}`));
    lines.push(foldLine(`DTSTAMP:${dtstamp}`));
    lines.push(foldLine(`DTSTART;VALUE=DATE:${toIcalDate(d.date)}`));
    lines.push(foldLine(`DTEND;VALUE=DATE:${nextDay(d.date)}`));
    lines.push(foldLine(`SUMMARY:${escapeText(summary)}`));
    lines.push(foldLine(`DESCRIPTION:${escapeText(description)}`));

    // 7-day reminder
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-P7D');
    lines.push('ACTION:DISPLAY');
    lines.push(foldLine(`DESCRIPTION:${escapeText(summary)} in 7 days`));
    lines.push('END:VALARM');

    // 1-day reminder
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-P1D');
    lines.push('ACTION:DISPLAY');
    lines.push(foldLine(`DESCRIPTION:${escapeText(summary)} tomorrow`));
    lines.push('END:VALARM');

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // RFC 5545 requires CRLF line endings
  return lines.join('\r\n') + '\r\n';
}
