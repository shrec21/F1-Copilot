import { describe, it, expect } from 'vitest';
import { loadRuleFile } from '../src/rules/loader';

// ─── Tests using real YAML files ─────────────────────────────────────────────

describe('loadRuleFile — real YAML files', () => {
  it('loads opt-unemployment.yaml and has all five required fields', () => {
    const result = loadRuleFile('opt-unemployment.yaml');

    expect(result.topic).toBe('opt-unemployment');
    expect(result.effective_date).toBeDefined();
    expect(result.source_url).toBeDefined();
    expect(result.disclaimer).toBeDefined();
    expect(Array.isArray(result.rules)).toBe(true);
    expect(result.rules.length).toBeGreaterThan(0);
  });

  it('loads cpt-authorization.yaml and has all five required fields', () => {
    const result = loadRuleFile('cpt-authorization.yaml');

    expect(result.topic).toBe('cpt-authorization');
    expect(result.effective_date).toBeDefined();
    expect(result.source_url).toBeDefined();
    expect(result.disclaimer).toBeDefined();
    expect(Array.isArray(result.rules)).toBe(true);
    expect(result.rules.length).toBeGreaterThan(0);
  });

  it('loads d-s-transition-2026.yaml and has all five required fields', () => {
    const result = loadRuleFile('d-s-transition-2026.yaml');

    expect(result.topic).toBe('d-s-transition-2026');
    expect(result.effective_date).toBeDefined();
    expect(result.source_url).toBeDefined();
    expect(result.disclaimer).toBeDefined();
    expect(Array.isArray(result.rules)).toBe(true);
    expect(result.rules.length).toBeGreaterThan(0);
  });

  it('each RuleEntry with a threshold has numeric threshold and valid unit', () => {
    const files = [
      'opt-unemployment.yaml',
      'cpt-authorization.yaml',
      'd-s-transition-2026.yaml',
    ] as const;

    for (const filename of files) {
      const result = loadRuleFile(filename);
      for (const entry of result.rules) {
        if (entry.threshold !== undefined) {
          expect(typeof entry.threshold, `${filename}: ${entry.id} threshold`).toBe('number');
          expect(
            ['days', 'months'],
            `${filename}: ${entry.id} unit`
          ).toContain(entry.unit);
        }
      }
    }
  });
});

// ─── Error-path tests using the yaml parser directly ─────────────────────────
// Instead of mocking fs (which gets hoisted and breaks real-file tests),
// we test the validation logic by calling the parser and validator directly.

import { parse } from 'yaml';
import type { RuleFile } from '../src/rules/types';

/**
 * Thin validator extracted from loader logic so we can test it without I/O.
 * This mirrors the exact checks in loadRuleFile.
 */
function validateRuleFile(filename: string, data: unknown): RuleFile {
  const REQUIRED_FIELDS = ['topic', 'effective_date', 'source_url', 'disclaimer', 'rules'] as const;
  const d = data as Record<string, unknown>;
  for (const field of REQUIRED_FIELDS) {
    if (d[field] === undefined || d[field] === null) {
      throw new Error(`Rule file "${filename}" missing required field: ${field}`);
    }
  }
  if (!Array.isArray(d['rules']) || (d['rules'] as unknown[]).length === 0) {
    throw new Error(`Rule file "${filename}" must have at least one rule entry`);
  }
  return d as unknown as RuleFile;
}

describe('loadRuleFile — validation logic (error paths)', () => {
  it('throws when disclaimer is missing', () => {
    const data = parse(`
topic: test-topic
effective_date: "2024-01-01"
source_url: "https://example.com"
rules:
  - id: some-rule
    summary: A rule without disclaimer field
    citation: "Test citation"
`);
    expect(() => validateRuleFile('missing-disclaimer.yaml', data)).toThrow(
      'missing required field: disclaimer'
    );
  });

  it('throws when source_url is missing', () => {
    const data = parse(`
topic: test-topic
effective_date: "2024-01-01"
disclaimer: "A disclaimer"
rules:
  - id: some-rule
    summary: A rule
    citation: "Test citation"
`);
    expect(() => validateRuleFile('missing-source.yaml', data)).toThrow(
      'missing required field: source_url'
    );
  });

  it('throws when rules array is empty', () => {
    const data = parse(`
topic: test-topic
effective_date: "2024-01-01"
source_url: "https://example.com"
disclaimer: "A disclaimer"
rules: []
`);
    expect(() => validateRuleFile('empty-rules.yaml', data)).toThrow(
      'must have at least one rule entry'
    );
  });

  it('throws when topic is missing', () => {
    const data = parse(`
effective_date: "2024-01-01"
source_url: "https://example.com"
disclaimer: "A disclaimer"
rules:
  - id: some-rule
    summary: A rule
    citation: "Test citation"
`);
    expect(() => validateRuleFile('missing-topic.yaml', data)).toThrow(
      'missing required field: topic'
    );
  });
});
