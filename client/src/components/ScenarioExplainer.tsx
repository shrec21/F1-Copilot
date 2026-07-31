import { useEffect, useState } from 'react';
import { getScenarios, type Scenario, type ScenarioId, type OutcomeSeverity } from '../api';

const SEVERITY_STYLE: Record<OutcomeSeverity, { banner: string; badge: string; icon: string }> = {
  safe:             { banner: 'bg-green-50 border-green-300',  badge: 'bg-green-100 text-green-800',  icon: '✅' },
  'action-required':{ banner: 'bg-yellow-50 border-yellow-300',badge: 'bg-yellow-100 text-yellow-800',icon: '⚠️' },
  critical:         { banner: 'bg-red-50 border-red-300',      badge: 'bg-red-100 text-red-800',      icon: '🚨' },
  info:             { banner: 'bg-blue-50 border-blue-200',    badge: 'bg-blue-100 text-blue-800',    icon: 'ℹ️' },
};

// Travel sub-calculator — client-side only, no API needed
type TravelTiming = 'before' | 'after' | null;

function TravelCalculator({ programEndDate }: { programEndDate?: string }) {
  const [timing, setTiming] = useState<TravelTiming>(null);

  const afterResult = programEndDate
    ? { graceEnd: addDaysToIso(programEndDate, 60) }
    : null;

  return (
    <div className="border border-dashed border-blue-300 rounded-lg p-4 bg-blue-50/40 space-y-3">
      <p className="text-sm font-semibold text-blue-800">What if I travel internationally?</p>
      <p className="text-xs text-gray-600">
        Pick your re-entry date relative to September 15, 2026 to see the outcome.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setTiming(t => t === 'before' ? null : 'before')}
          className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
            timing === 'before'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
          }`}
        >
          Return before Sept 15
        </button>
        <button
          onClick={() => setTiming(t => t === 'after' ? null : 'after')}
          className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
            timing === 'after'
              ? 'bg-orange-600 text-white border-orange-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'
          }`}
        >
          Return after Sept 15
        </button>
      </div>

      {timing === 'before' && (
        <div className="bg-green-50 border border-green-200 rounded p-3 space-y-1">
          <p className="text-sm font-semibold text-green-800">✅ You will receive a D/S admission</p>
          <p className="text-sm text-green-700">CBP will stamp D/S — no change to your current status.</p>
          <ul className="text-xs text-green-700 list-disc list-inside space-y-0.5 mt-1">
            <li>Ensure your I-20 is valid and DSO-signed within the last 12 months.</li>
            <li>Book return travel with buffer — a delay past Sept 15 changes the outcome.</li>
            <li>Carry full document set at the port of entry.</li>
          </ul>
        </div>
      )}

      {timing === 'after' && (
        <div className="bg-orange-50 border border-orange-200 rounded p-3 space-y-1">
          <p className="text-sm font-semibold text-orange-800">⚠️ You will receive a fixed-date I-94</p>
          <p className="text-sm text-orange-700">
            CBP will issue an I-94 expiring on your program end date + 60 days.
            {afterResult && ` Based on your profile, your I-94 would expire around ${afterResult.graceEnd}.`}
          </p>
          <ul className="text-xs text-orange-700 list-disc list-inside space-y-0.5 mt-1">
            <li>This is expected and correct — not a violation.</li>
            <li>Print your new I-94 after re-entry and verify the expiration date.</li>
            <li>Track this hard deadline — overstaying puts you out of status.</li>
            <li>Apply for OPT 90 days before program end date if you plan to work.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function addDaysToIso(iso: string, days: number): string {
  const parts = iso.split('-');
  const d = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function ScenarioCard({
  scenario,
  highlighted,
  defaultOpen,
}: {
  scenario: Scenario;
  highlighted: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const s = SEVERITY_STYLE[scenario.outcomeSeverity];

  return (
    <div
      className={`rounded-lg border-2 transition-shadow ${
        highlighted ? 'border-blue-500 shadow-md' : 'border-gray-200'
      }`}
    >
      {/* Card header */}
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-lg mt-0.5">{s.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            {highlighted && (
              <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded">YOUR SCENARIO</span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.badge}`}>
              {scenario.outcomeSeverity.replace('-', ' ')}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{scenario.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{scenario.subtitle}</p>
        </div>
        <span className="text-gray-400 text-xs shrink-0 mt-1">{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded body */}
      {open && (
        <div className={`border-t px-4 py-4 space-y-4 rounded-b-lg ${s.banner}`}>

          {/* Applies when */}
          <div className="text-xs text-gray-500 italic border-l-2 border-gray-300 pl-2">
            Applies when: {scenario.appliesWhen}
          </div>

          {/* Outcome */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Outcome</p>
            <p className="text-sm text-gray-800">{scenario.outcome}</p>
          </div>

          {/* Key facts */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Key Facts</p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              {scenario.keyFacts.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>

          {/* Risks */}
          {scenario.risks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Risks to Watch</p>
              <div className="space-y-2">
                {scenario.risks.map((r, i) => (
                  <div key={i} className="bg-white/70 border border-gray-200 rounded p-2">
                    <p className="text-xs font-semibold text-red-700">{r.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{r.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What to Do</p>
            <ol className="space-y-2">
              {scenario.actions.map(a => (
                <li key={a.order} className="flex gap-2 text-sm text-gray-700">
                  <span className="font-bold text-gray-400 shrink-0">{a.order}.</span>
                  <span>
                    {a.text}
                    {a.deadline && (
                      <span className="ml-1 text-xs font-semibold text-orange-700">
                        (by {a.deadline})
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Citations */}
          <div className="text-xs text-gray-400 space-y-0.5">
            {scenario.citations.map((c, i) => <p key={i}>{c}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}

export function ScenarioExplainer() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [detectedId, setDetectedId] = useState<ScenarioId | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    getScenarios()
      .then(res => {
        setScenarios(res.scenarios);
        setDetectedId(res.detectedId);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading scenarios…</p>;
  if (error)   return <p className="text-sm text-red-600">{error}</p>;

  const detected = scenarios.find(s => s.id === detectedId) ?? null;
  const others   = scenarios.filter(s => s.id !== detectedId);

  // For travel calculator, extract program end date from the detected scenario
  // (we don't have profile here, but we surface it via the action text)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-gray-900">D/S Transition Scenario Explainer</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Six distinct situations created by the September 15, 2026 rule change — with outcomes,
          risks, and step-by-step actions for each.
        </p>
      </div>

      {/* Detected scenario — always open and highlighted */}
      {detected ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
            Based on your profile
          </p>
          <ScenarioCard scenario={detected} highlighted defaultOpen />

          {/* Travel sub-calculator — only relevant for D/S students */}
          {(detectedId === 'ds-staying') && (
            <TravelCalculator />
          )}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Set up your profile to see which scenario applies to you.
        </div>
      )}

      {/* Reference matrix — all other scenarios */}
      <div>
        <button
          onClick={() => setShowAll(v => !v)}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {showAll ? '▲ Hide' : '▼ Show'} full scenario matrix ({others.length} other scenarios)
        </button>

        {showAll && (
          <div className="space-y-3 mt-3">
            <p className="text-xs text-gray-400 italic">
              These scenarios may not apply to you, but are useful for understanding the full picture
              or helping a classmate.
            </p>
            {others.map(s => (
              <ScenarioCard key={s.id} scenario={s} highlighted={false} defaultOpen={false} />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 italic">
        Scenarios are based on DHS Final Rule 90 FR 5854. Individual situations vary —
        consult your DSO or an immigration attorney before taking action.
      </p>
    </div>
  );
}
