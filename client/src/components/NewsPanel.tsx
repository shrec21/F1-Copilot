import { useState, useEffect } from 'react';
import { getNews, type NewsItem, type NewsFetchResult } from '../api';

function formatDate(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="bg-white border border-amber-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
          {item.source}
        </span>
        {item.pubDate && (
          <span className="text-xs text-gray-400 shrink-0">{formatDate(item.pubDate)}</span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1 leading-snug">
        {item.link ? (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-700 hover:underline"
          >
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </h3>
      {item.summary && (
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{item.summary}</p>
      )}
    </div>
  );
}

export function NewsPanel() {
  const [data, setData] = useState<NewsFetchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setFetchError(null);
    getNews()
      .then(setData)
      .catch((err: unknown) => setFetchError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      {/* Informational-only warning — required by plan */}
      <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex gap-2">
        <span className="text-amber-600 text-lg leading-none mt-0.5">⚠</span>
        <div>
          <p className="text-xs font-semibold text-amber-800">Informational only — not verified compliance guidance</p>
          <p className="text-xs text-amber-700 mt-0.5">
            These are public news headlines from USCIS and DHS. Do not rely on them to make
            compliance decisions. Always verify policy changes at{' '}
            <a href="https://www.uscis.gov" target="_blank" rel="noopener noreferrer" className="underline">
              uscis.gov
            </a>{' '}
            and consult your DSO or an immigration attorney before acting.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Recent Immigration News</h2>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-blue-600 hover:underline disabled:opacity-40"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loading && (
        <div className="text-sm text-gray-500 text-center py-8">Fetching latest news…</div>
      )}

      {!loading && (fetchError || data?.error) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <p className="font-medium">Could not load news</p>
          <p className="text-xs mt-1">{fetchError ?? data?.error}</p>
          <p className="text-xs mt-2 text-red-600">
            Check{' '}
            <a href="https://www.uscis.gov/news" target="_blank" rel="noopener noreferrer" className="underline">
              uscis.gov/news
            </a>{' '}
            directly for the latest updates.
          </p>
        </div>
      )}

      {!loading && !fetchError && data && data.items.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-8">
          No recent news found. Visit{' '}
          <a href="https://www.uscis.gov/news" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            uscis.gov/news
          </a>{' '}
          directly.
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <div className="space-y-3">
          {data.items.map((item, i) => (
            <NewsCard key={i} item={item} />
          ))}
          <p className="text-xs text-gray-400 text-right">
            Fetched at {new Date(data.fetchedAt).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}
