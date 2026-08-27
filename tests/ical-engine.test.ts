import { describe, it, expect } from 'vitest';
import { generateIcal } from '../src/engine/ical-engine';
import type { Deadline } from '../src/engine/deadline-engine';

const NOW = '2026-08-24';

function makeDeadline(overrides: Partial<Deadline> = {}): Deadline {
  return {
    id: 'test-deadline',
    title: 'Test Deadline',
    description: 'A test deadline description.',
    date: '2026-09-15',
    daysUntil: 22,
    severity: 'warning',
    ruleId: 'test-rule',
    citation: '8 CFR § 214.2(f)(5)',
    ...overrides,
  };
}

describe('generateIcal', () => {
  it('produces a valid VCALENDAR wrapper', () => {
    const result = generateIcal([], NOW);
    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('VERSION:2.0');
    expect(result).toContain('PRODID:-//F1 Compliance Copilot//Deadlines//EN');
    expect(result).toContain('END:VCALENDAR');
  });

  it('returns a valid empty calendar when given no deadlines', () => {
    const result = generateIcal([], NOW);
    expect(result).not.toContain('BEGIN:VEVENT');
    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('END:VCALENDAR');
  });

  it('filters out past deadlines', () => {
    const deadlines: Deadline[] = [
      makeDeadline({ id: 'future', severity: 'warning', date: '2026-10-01', daysUntil: 38 }),
      makeDeadline({ id: 'past', severity: 'past', date: '2026-01-01', daysUntil: -235 }),
    ];
    const result = generateIcal(deadlines, NOW);
    expect(result).toContain('future@f1-compliance-copilot');
    expect(result).not.toContain('past@f1-compliance-copilot');
  });

  it('formats all-day dates correctly (DTSTART and DTEND)', () => {
    const deadlines = [makeDeadline({ date: '2026-09-15' })];
    const result = generateIcal(deadlines, NOW);
    expect(result).toContain('DTSTART;VALUE=DATE:20260915');
    expect(result).toContain('DTEND;VALUE=DATE:20260916'); // next day (exclusive end)
  });

  it('handles month/year boundary for DTEND', () => {
    const deadlines = [makeDeadline({ date: '2026-12-31' })];
    const result = generateIcal(deadlines, NOW);
    expect(result).toContain('DTSTART;VALUE=DATE:20261231');
    expect(result).toContain('DTEND;VALUE=DATE:20270101');
  });

  it('includes severity prefix in SUMMARY', () => {
    const critical = makeDeadline({ severity: 'critical', title: 'Filing Deadline' });
    const warning = makeDeadline({ id: 'w', severity: 'warning', title: 'Grace Period' });
    const info = makeDeadline({ id: 'i', severity: 'info', title: 'Program End' });

    const resultCritical = generateIcal([critical], NOW);
    expect(resultCritical).toContain('SUMMARY:[CRITICAL] Filing Deadline');

    const resultWarning = generateIcal([warning], NOW);
    expect(resultWarning).toContain('SUMMARY:[WARNING] Grace Period');

    const resultInfo = generateIcal([info], NOW);
    expect(resultInfo).toContain('SUMMARY:[INFO] Program End');
  });

  it('includes citation in DESCRIPTION', () => {
    const deadlines = [makeDeadline({ citation: '8 CFR § 214.2(f)(5)' })];
    const result = generateIcal(deadlines, NOW);
    expect(result).toContain('Citation: 8 CFR');
  });

  it('generates 2 VALARM blocks per event', () => {
    const deadlines = [makeDeadline()];
    const result = generateIcal(deadlines, NOW);
    const alarmCount = (result.match(/BEGIN:VALARM/g) || []).length;
    expect(alarmCount).toBe(2);
    expect(result).toContain('TRIGGER:-P7D');
    expect(result).toContain('TRIGGER:-P1D');
  });

  it('uses CRLF line endings throughout', () => {
    const result = generateIcal([makeDeadline()], NOW);
    // Every line should end with \r\n
    const lines = result.split('\r\n');
    // The last element after splitting on \r\n should be empty (trailing CRLF)
    expect(lines[lines.length - 1]).toBe('');
    // There should be no bare \n (not preceded by \r)
    expect(result.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('generates stable UIDs', () => {
    const deadlines = [makeDeadline({ id: 'ds-transition' })];
    const result = generateIcal(deadlines, NOW);
    expect(result).toContain('UID:ds-transition@f1-compliance-copilot');
  });

  it('escapes special characters in text fields', () => {
    const deadlines = [makeDeadline({
      title: 'D/S; Filing, Deadline',
      description: 'Line1\nLine2',
    })];
    const result = generateIcal(deadlines, NOW);
    expect(result).toContain('D/S\\; Filing\\, Deadline');
  });

  it('handles multiple active deadlines', () => {
    const deadlines = [
      makeDeadline({ id: 'a', severity: 'critical', date: '2026-09-01' }),
      makeDeadline({ id: 'b', severity: 'warning', date: '2026-10-01' }),
      makeDeadline({ id: 'c', severity: 'info', date: '2027-01-15' }),
    ];
    const result = generateIcal(deadlines, NOW);
    const eventCount = (result.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBe(3);
  });
});
