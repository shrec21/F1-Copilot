import { createHash } from 'crypto';

const FETCH_TIMEOUT_MS = 15_000;
const EXCERPT_MAX_CHARS = 4_000;

/**
 * Strips HTML tags from a string and collapses whitespace, returning the
 * visible text a user would see in a browser. Removes <style> and <script>
 * blocks entirely before stripping tags so their contents don't pollute the
 * visible text hash.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** SHA-256 hex digest of a string. */
export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export interface FetchResult {
  text: string;
  hash: string;
  excerpt: string;
}

/**
 * Fetches a URL, extracts visible text by stripping HTML, and returns:
 *   - `text`: the full stripped content
 *   - `hash`: SHA-256 of the full text (used for change detection)
 *   - `excerpt`: first 4 KB of text (stored in DB for human-readable diffs)
 *
 * Throws on network errors or non-2xx responses so the caller can log and skip.
 */
export async function fetchAndExtractText(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Identify ourselves; many government sites block default node fetch UA
        'User-Agent': 'F1ComplianceCopilot/2.0 regulation-watcher (research; contact via GitHub)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
    }

    const html = await res.text();
    const text = stripHtml(html);
    return {
      text,
      hash: sha256(text),
      excerpt: text.slice(0, EXCERPT_MAX_CHARS),
    };
  } finally {
    clearTimeout(timer);
  }
}
