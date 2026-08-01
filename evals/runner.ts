/**
 * Standalone eval runner — human-readable pass/fail report.
 *
 * Usage:
 *   npx tsx evals/runner.ts
 *   npx tsx evals/runner.ts > evals-report.txt
 *
 * Exit code 0 = all active scenarios passed.
 * Exit code 1 = one or more failures (for CI use).
 */

import { evaluateAllRules } from '@f1/rule-engine';
import { ALL_SCENARIOS } from './scenarios/index';
import type { EvalScenario } from './types';

// ── Formatting helpers ─────────────────────────────────────────────────────────

const WIDTH = 80;
const DIVIDER = '─'.repeat(WIDTH);

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

// ── Check one scenario ─────────────────────────────────────────────────────────

interface CheckResult {
  scenario: EvalScenario;
  checks: Array<{
    label: string;
    expected: unknown;
    actual: unknown;
    passed: boolean;
  }>;
  skipped: boolean;
}

function checkScenario(scenario: EvalScenario): CheckResult {
  if (scenario.skip) {
    return { scenario, checks: [], skipped: true };
  }

  const results = evaluateAllRules(scenario.student, scenario.context, scenario.today);
  const checks: CheckResult['checks'] = [];

  // Status assertions
  for (const [ruleId, expectedStatus] of Object.entries(scenario.expect)) {
    const r = results.find(x => x.rule.id === ruleId);
    const actual = r?.status ?? '(rule not found)';
    checks.push({
      label: `${ruleId}.status`,
      expected: expectedStatus,
      actual,
      passed: actual === expectedStatus,
    });
  }

  // Output value assertions
  if (scenario.expectOutputs) {
    for (const [ruleId, outputChecks] of Object.entries(scenario.expectOutputs)) {
      const r = results.find(x => x.rule.id === ruleId);
      for (const [key, expectedValue] of Object.entries(outputChecks)) {
        const actual = r?.outputs[key] ?? '(rule not found)';
        checks.push({
          label: `${ruleId}.outputs.${key}`,
          expected: expectedValue,
          actual,
          passed: JSON.stringify(actual) === JSON.stringify(expectedValue),
        });
      }
    }
  }

  return { scenario, checks, skipped: false };
}

// ── Main ───────────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);

console.log('');
console.log(`F-1 Rule Engine — Adversarial Eval Suite`);
console.log(`Run date : ${today}`);
console.log(`Scenarios: ${ALL_SCENARIOS.length}`);
console.log(DIVIDER);

let totalChecks = 0;
let failedChecks = 0;
let skippedCount = 0;

for (const scenario of ALL_SCENARIOS) {
  const { checks, skipped } = checkScenario(scenario);

  if (skipped) {
    skippedCount++;
    console.log(`  SKIP  ${scenario.id}`);
    console.log(`        ${scenario.skipReason ?? '(no reason given)'}`);
    console.log('');
    continue;
  }

  const scenarioPassed = checks.every(c => c.passed);
  const icon = scenarioPassed ? '✓' : '✗';
  const label = scenarioPassed ? 'PASS' : 'FAIL';

  console.log(`  ${label}  ${icon}  ${scenario.id}`);

  for (const check of checks) {
    totalChecks++;
    if (!check.passed) {
      failedChecks++;
      console.log(`        ✗ ${check.label}`);
      console.log(`          expected : ${JSON.stringify(check.expected)}`);
      console.log(`          actual   : ${JSON.stringify(check.actual)}`);
    }
  }

  if (!scenarioPassed) {
    // Show description to make debugging easier
    console.log(`        ↳ ${scenario.description}`);
    console.log('');
  }
}

console.log(DIVIDER);

const passed = totalChecks - failedChecks;
if (failedChecks === 0) {
  console.log(`Result : ${passed}/${totalChecks} checks passed ✓`);
} else {
  console.log(`Result : ${passed}/${totalChecks} checks passed — ${failedChecks} FAILED ✗`);
}
if (skippedCount > 0) {
  console.log(`Skipped: ${skippedCount} scenario(s) (known limitations — see scenario skipReason)`);
}
console.log('');

process.exit(failedChecks > 0 ? 1 : 0);
