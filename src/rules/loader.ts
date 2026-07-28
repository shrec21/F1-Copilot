import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import type { RuleFile } from './types';

const REQUIRED_FIELDS: (keyof RuleFile)[] = [
  'topic', 'effective_date', 'source_url', 'disclaimer', 'rules'
];

/**
 * Validates a parsed RuleFile object for required fields and a non-empty rules array.
 * Exported so tests can exercise validation logic without file I/O.
 */
export function validateRuleFile(data: RuleFile, filename: string): void {
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      throw new Error(`Rule file "${filename}" missing required field: ${field}`);
    }
  }
  if (!Array.isArray(data.rules) || data.rules.length === 0) {
    throw new Error(`Rule file "${filename}" must have at least one rule entry`);
  }
}

export function loadRuleFile(filename: string): RuleFile {
  // __dirname is CJS-only. If this project moves to ESM, replace with
  // import.meta.dirname (Node 21.2+) or fileURLToPath(new URL('.', import.meta.url)).
  const raw = readFileSync(join(__dirname, filename), 'utf8');
  const data = parse(raw) as RuleFile;
  validateRuleFile(data, filename);
  return data;
}
