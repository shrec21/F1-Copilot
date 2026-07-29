import { useState } from 'react';
import { getRules } from '../api';
import type { RuleResponse } from '../api';

const TOPICS = [
  { key: 'opt-unemployment', label: 'OPT Unemployment' },
  { key: 'cpt', label: 'CPT Rules' },
  { key: 'stem-opt', label: 'STEM OPT Extension' },
];

export function RulesTab() {
  const [selected, setSelected] = useState<string | null>(null);
  const [rule, setRule] = useState<RuleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTopic(topic: string) {
    if (selected === topic) return;
    setSelected(topic);
    setRule(null);
    setError(null);
    setLoading(true);
    try {
      const data = await getRules(topic);
      setRule(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load rule');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {TOPICS.map((t) => (
          <button
            key={t.key}
            onClick={() => loadTopic(t.key)}
            className={`px-4 py-2 text-sm rounded font-medium transition-colors ${
              selected === t.key
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-sm text-gray-500 animate-pulse px-1">Loading rule…</div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          Error: {error}
        </div>
      )}

      {rule && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-3">
          <h2 className="text-base font-semibold text-gray-800 capitalize">
            {rule.topic.replace(/-/g, ' ')}
          </h2>
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {rule.text}
          </div>
          {rule.disclaimer && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <strong>Disclaimer:</strong> {rule.disclaimer}
            </div>
          )}
        </div>
      )}

      {!selected && (
        <p className="text-sm text-gray-400">Select a topic above to view the rule.</p>
      )}
    </div>
  );
}
