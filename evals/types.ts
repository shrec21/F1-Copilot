/**
 * Types for the F-1 rule engine adversarial eval suite.
 *
 * Each EvalScenario encodes a fully-specified student situation and the
 * expected rule outputs, expressed as deterministic assertions (not LLM output).
 *
 * The expect and expectOutputs fields are partial: only the rules listed are
 * asserted. Rules absent from the map are silently ignored so scenarios stay
 * focused on the edge case under test.
 */

import type { Student, RuleContext, RuleStatus } from '@f1/rule-engine';

export interface EvalScenario {
  /** Short kebab-case identifier. Used as the test description. */
  id: string;
  /** One-sentence description of what edge case this tests. */
  description: string;
  /**
   * If true, this scenario is excluded from CI failures.
   * Use for known engine limitations that have not yet been fixed.
   */
  skip?: boolean;
  /** Human-readable explanation of why this scenario is skipped. */
  skipReason?: string;
  /** The "today" date passed to evaluateAllRules. */
  today: string;
  student: Student;
  context: RuleContext;
  /**
   * Status assertions: { ruleId → expected RuleStatus }
   * Only listed rules are checked; others are ignored.
   */
  expect: Partial<Record<string, RuleStatus>>;
  /**
   * Optional output-value assertions: { ruleId → { outputKey → expected value } }
   * Lets us pin the exact numeric/string output, not just the status bucket.
   */
  expectOutputs?: Partial<Record<string, Record<string, unknown>>>;
}
