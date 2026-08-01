/**
 * F-1 rule engine adversarial eval suite — CI integration.
 *
 * Each scenario in ALL_SCENARIOS becomes one or more vitest it() assertions.
 * Scenarios marked skip=true are excluded from CI failures (known limitations).
 *
 * Run: npm test (root)
 * Human-readable report: npx tsx evals/runner.ts
 */

import { describe, it, expect } from 'vitest';
import { evaluateAllRules } from '@f1/rule-engine';
import { ALL_SCENARIOS } from '../evals/scenarios/index';

for (const scenario of ALL_SCENARIOS) {
  if (scenario.skip) {
    // Emit a skipped describe block so the scenario is visible in the test tree.
    describe.skip(`[SKIP] ${scenario.id}`, () => {
      it(`known limitation: ${scenario.skipReason ?? 'see scenario definition'}`, () => {});
    });
    continue;
  }

  describe(scenario.id, () => {
    // Evaluate once per scenario; closures capture the const correctly in for-of.
    const results = evaluateAllRules(scenario.student, scenario.context, scenario.today);

    // ── Status assertions ──────────────────────────────────────────────────────
    for (const [ruleId, expectedStatus] of Object.entries(scenario.expect)) {
      it(`${ruleId}.status → ${expectedStatus}`, () => {
        const r = results.find(x => x.rule.id === ruleId);
        expect(r, `rule '${ruleId}' missing from evaluateAllRules output`).toBeDefined();
        expect(r!.status).toBe(expectedStatus);
      });
    }

    // ── Output value assertions ────────────────────────────────────────────────
    if (scenario.expectOutputs) {
      for (const [ruleId, outputChecks] of Object.entries(scenario.expectOutputs)) {
        for (const [outputKey, expectedValue] of Object.entries(outputChecks)) {
          it(`${ruleId}.outputs.${outputKey} → ${JSON.stringify(expectedValue)}`, () => {
            const r = results.find(x => x.rule.id === ruleId);
            expect(r, `rule '${ruleId}' missing from evaluateAllRules output`).toBeDefined();
            expect(r!.outputs[outputKey]).toEqual(expectedValue);
          });
        }
      }
    }
  });
}
