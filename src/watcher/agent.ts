/**
 * Regulation-watcher AI summarizer.
 *
 * ══ STRUCTURAL BOUNDARY — READ BEFORE MODIFYING ══════════════════════════════
 *
 * This module's single exported function makes a TEXT-ONLY Claude API call:
 * no `tools` array, no function calling, no side effects. It accepts two
 * strings (old/new page excerpts) and returns one string (the summary).
 *
 * Why this matters: the watcher is allowed to DETECT changes and CREATE review
 * tickets, but it must NEVER modify a rule automatically. Enforcing this with
 * a comment or convention is fragile. Enforcing it structurally means:
 *
 *   1. This file imports nothing from src/data/queries.ts — it cannot write
 *      to any table.
 *   2. This file imports nothing from packages/rule-engine — it has no
 *      reference to ComplianceRule objects or rule files.
 *   3. The Claude call has no `tools` parameter — the model cannot invoke
 *      any function even if prompted to try.
 *   4. The return type is `Promise<string>` — a passive summary, not an action.
 *
 * The caller (checker.ts) decides what to do with the returned string. Only
 * the caller writes to the DB, and it writes only to rule_review_queue —
 * never to any rule-engine table or file.
 * ═════════════════════════════════════════════════════════════════════════════
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-5';

/**
 * Asks Claude to summarize what changed between two versions of a regulatory
 * source page excerpt. Returns a plain-language string suitable for storing
 * in rule_review_queue.diff_summary.
 *
 * Intentionally has no `tools` parameter in the API call — this function
 * cannot take any action beyond returning text.
 */
export async function summarizeChange(
  sourceId: string,
  oldExcerpt: string,
  newExcerpt: string,
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    // ── NO `tools` PARAMETER ──────────────────────────────────────────────────
    // This is intentional and load-bearing. Adding tools here would allow the
    // model to take actions. Do not add tools to this call without a deliberate
    // architectural review and sign-off on the "propose-not-apply" boundary.
    // ─────────────────────────────────────────────────────────────────────────
    system:
      'You are a regulatory change analyst for an F-1 student visa compliance system. '
      + 'Your role is to summarize changes to regulatory source pages in plain language '
      + 'so that a human compliance engineer can decide whether to update the rule engine. '
      + 'Be factual and concise. Never speculate about legal consequences. '
      + 'Never suggest specific code changes — that is for the human reviewer to decide.',
    messages: [
      {
        role: 'user',
        content:
          `Source ID: ${sourceId}\n\n`
          + `PREVIOUS VERSION (excerpt up to 4 KB):\n${oldExcerpt}\n\n`
          + `CURRENT VERSION (excerpt up to 4 KB):\n${newExcerpt}\n\n`
          + 'Please provide:\n'
          + '1. A 1–3 sentence plain-language summary of what changed.\n'
          + '2. Whether the change appears to be (a) a meaningful regulatory update, '
          + '(b) a minor editorial/formatting change, or (c) a navigation/layout change '
          + 'with no substantive content change.\n'
          + '3. Which compliance areas might be affected '
          + '(e.g. OPT unemployment caps, CPT authorization, STEM E-Verify, I-983 reporting, grace period).\n'
          + 'If the excerpts look identical or the change is clearly cosmetic, say so explicitly.',
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== 'text') return 'Unable to generate summary — unexpected response type.';
  return block.text;
}
