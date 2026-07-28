import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import type { RuleFile } from './types';

const REQUIRED_FIELDS: (keyof RuleFile)[] = [
  'topic', 'effective_date', 'source_url', 'disclaimer', 'rules'
];

export function loadRuleFile(filename: string): RuleFile {
  const raw = readFileSync(join(__dirname, filename), 'utf8');
  const data = parse(raw) as RuleFile;
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      throw new Error(`Rule file "${filename}" missing required field: ${field}`);
    }
  }
  if (!Array.isArray(data.rules) || data.rules.length === 0) {
    throw new Error(`Rule file "${filename}" must have at least one rule entry`);
  }
  return data;
}
