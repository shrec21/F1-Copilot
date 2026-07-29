export interface NewsItem {
  title: string;
  summary: string;
  link: string;
  pubDate: string;
  source: string;
}

export interface NewsFetchResult {
  items: NewsItem[];
  fetchedAt: string;
  error?: string;
}

// Known immigration-related RSS feeds (public, no key required)
const RSS_SOURCES = [
  { url: 'https://www.uscis.gov/news/rss-feed/59144', source: 'USCIS' },
];

// Keywords that signal F-1 / international student relevance
const F1_KEYWORDS = [
  'f-1', 'f1', 'student', 'opt', 'cpt', 'stem', 'international',
  'visa', 'sevp', 'sevis', 'dso', 'immigration', 'admission period',
];

function extractCdata(tag: string, xml: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const plainRe  = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  return (cdataRe.exec(xml)?.[1] ?? plainRe.exec(xml)?.[1] ?? '').trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssItems(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const title   = stripHtml(extractCdata('title', block));
    const summary = stripHtml(extractCdata('description', block));
    const link    = extractCdata('link', block) || (/<link[^/]\/?>([^<]+)/i.exec(block)?.[1] ?? '');
    const pubDate = extractCdata('pubDate', block);

    if (title) {
      items.push({ title, summary: summary.slice(0, 300), link: link.trim(), pubDate, source });
    }
  }

  return items;
}

function isRelevant(item: NewsItem): boolean {
  const haystack = `${item.title} ${item.summary}`.toLowerCase();
  return F1_KEYWORDS.some((kw) => haystack.includes(kw));
}

export async function fetchImmigrationNews(maxItems = 10): Promise<NewsFetchResult> {
  const allItems: NewsItem[] = [];
  const errors: string[] = [];

  for (const src of RSS_SOURCES) {
    try {
      const res = await fetch(src.url, {
        signal: AbortSignal.timeout(8_000),
        headers: { 'User-Agent': 'F1-Compliance-Copilot/1.0 (informational news reader)' },
      });
      if (!res.ok) {
        errors.push(`${src.source}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      allItems.push(...parseRssItems(xml, src.source));
    } catch (err) {
      errors.push(`${src.source}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Prefer F-1-relevant items; fall back to all items if none match
  const relevant = allItems.filter(isRelevant);
  const result   = relevant.length > 0 ? relevant : allItems;

  return {
    items: result.slice(0, maxItems),
    fetchedAt: new Date().toISOString(),
    ...(result.length === 0 && errors.length > 0
      ? { error: `Could not fetch news: ${errors.join('; ')}` }
      : {}),
  };
}
