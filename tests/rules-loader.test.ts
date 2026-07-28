import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';
import { loadRuleFile, validateRuleFile } from '../src/rules/loader';
import type { RuleFile } from '../src/rules/types';

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

// ─── Error-path tests via exported validateRuleFile ───────────────────────────
// We parse inline YAML strings and pass the result directly to validateRuleFile,
// avoiding any need to mock fs (which Vitest hoists and breaks real-file tests).

function parseAs(yaml: string): RuleFile {
  return parse(yaml) as RuleFile;
}

describe('validateRuleFile — error paths', () => {
  it('throws when disclaimer is missing', () => {
    const data = parseAs(`
topic: test-topic
effective_date: "2024-01-01"
source_url: "https://example.com"
rules:
  - id: some-rule
    summary: A rule without disclaimer field
    citation: "Test citation"
`);
    expect(() => validateRuleFile(data, 'missing-disclaimer.yaml')).toThrow(
      'missing required field: disclaimer'
    );
  });

  it('throws when effective_date is missing', () => {
    const data = parseAs(`
topic: test-topic
source_url: "https://example.com"
disclaimer: "A disclaimer"
rules:
  - id: some-rule
    summary: A rule
    citation: "Test citation"
`);
    expect(() => validateRuleFile(data, 'missing-effective-date.yaml')).toThrow(
      'missing required field: effective_date'
    );
  });

  it('throws when source_url is missing', () => {
    const data = parseAs(`
topic: test-topic
effective_date: "2024-01-01"
disclaimer: "A disclaimer"
rules:
  - id: some-rule
    summary: A rule
    citation: "Test citation"
`);
    expect(() => validateRuleFile(data, 'missing-source.yaml')).toThrow(
      'missing required field: source_url'
    );
  });

  it('throws when topic is missing', () => {
    const data = parseAs(`
effective_date: "2024-01-01"
source_url: "https://example.com"
disclaimer: "A disclaimer"
rules:
  - id: some-rule
    summary: A rule
    citation: "Test citation"
`);
    expect(() => validateRuleFile(data, 'missing-topic.yaml')).toThrow(
      'missing required field: topic'
    );
  });

  it('throws when rules array is empty', () => {
    const data = parseAs(`
topic: test-topic
effective_date: "2024-01-01"
source_url: "https://example.com"
disclaimer: "A disclaimer"
rules: []
`);
    expect(() => validateRuleFile(data, 'empty-rules.yaml')).toThrow(
      'must have at least one rule entry'
    );
  });
});
