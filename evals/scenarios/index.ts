import { OPT_UNEMPLOYMENT_SCENARIOS } from './opt-unemployment';
import { CPT_SCENARIOS } from './cpt';
import { GRACE_PERIOD_SCENARIOS } from './grace-period';
import { OPT_WINDOW_SCENARIOS } from './opt-window';
import { STEM_SCENARIOS } from './stem';
import { MULTI_RULE_SCENARIOS } from './multi-rule';
import type { EvalScenario } from '../types';

export const ALL_SCENARIOS: EvalScenario[] = [
  ...OPT_UNEMPLOYMENT_SCENARIOS,
  ...CPT_SCENARIOS,
  ...GRACE_PERIOD_SCENARIOS,
  ...OPT_WINDOW_SCENARIOS,
  ...STEM_SCENARIOS,
  ...MULTI_RULE_SCENARIOS,
];

export type { EvalScenario };
