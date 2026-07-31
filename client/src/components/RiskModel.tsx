import { useEffect, useState } from 'react';
import { getRiskModel, type RiskEntry, type ConsequenceTier, type ConsequenceSeverity } from '../api';

const SEV: Record<ConsequenceSeverity, { bg: string; border: string; dot: string; text: string; label: string }> = {
  caution:  { bg: 'bg-yellow-50',  border: 'border-yellow-300', dot: 'bg-yellow-400',  text: 'text-yellow-900', label: 'Caution'  },
  serious:  { bg: 'bg-orange-50',  border: 'border-orange-300', dot: 'bg-orange-500',  text: 'text-orange-900', label: 'Serious'  },
  severe:   { bg: 'bg-red-50',     border: 'border-red-300',    dot: 'bg-red-600',     text: 'text-red-900',    label: 'Severe'   },
  critical: { bg: 'bg-red-100',    border: 'border-red-500',    dot: 'bg-red-700',     text: 'text-red-950',    label: 'Critical' },
};

const WORST: Record<ConsequenceSeverity, number> = { caution: 0, serious: 1, severe: 2, critical: 3 };

function worstSeverity(tiers: ConsequenceTier[]): ConsequenceSeverity {
  return tiers.reduce<ConsequenceSeverity>((worst, t) =>
    WORST[t.severity] > WORST[worst] ? t.severity : worst, 'caution');
}

function DaysChip({ days, missed }: { days: number; missed: boolean }) {
  if (missed) {
    return (
      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
        ⚠ Deadline passed {Math.abs(days)}d ago
      </span>
    );
  }
  const color = days <= 30 ? 'bg-red-100 text-red-700' : days <= 90 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {days}d until deadline
    </span>
  );
}

function ConsequenceCascade({ tiers }: { tiers: ConsequenceTier[] }) {
  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />

      <div className="space-y-3">
        {tiers.map((tier, i) => {
          const s = SEV[tier.severity];
          return (
            <div key={i} className="relative">
              {/* Dot on the timeline */}
              <div className={`absolute -left-4 top-2 w-3 h-3 rounded-full border-2 border-white ${s.dot} shadow`} />

              <div className={`border rounded-lg p-3 ${s.bg} ${s.border} ${tier.alreadyActive ? 'ring-2 ring-red-400 ring-offset-1' : ''}`}>
                {/* Tier header */}
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-500 bg-white/60 px-1.5 py-0.5 rounded border border-gray-200">
                    {tier.trigger}
                  </span>
                  <span className="text-xs font-semibold text-gray-600">{tier.date}</span>
                  <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded ${s.bg} ${s.text} border ${s.border}`}>
                    {s.label}
                  </span>
                  {tier.alreadyActive && (
                    <span className="text-xs font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-300">
                      ACTIVE NOW
                    </span>
                  )}
                </div>

                <p className={`text-sm font-semibold ${s.text}`}>{tier.title}</p>
                <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{tier.detail}</p>

                {tier.daysFromNow >= 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {tier.daysFromNow === 0 ? 'Today' : `In ${tier.daysFromNow} days`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiskCard({ entry }: { entry: RiskEntry }) {
  const [open, setOpen] = useState(entry.deadlineMissed);
  const worst = worstSeverity(entry.consequences);
  const ws = SEV[worst];
  const activeCount = entry.consequences.filter(t => t.alreadyActive).length;

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${entry.deadlineMissed ? 'border-red-400' : 'border-gray-200'}`}>
      {/* Card header */}
      <button
        className="w-full text-left bg-white px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {/* Worst-severity dot */}
        <span className={`w-3 h-3 rounded-full shrink-0 mt-1.5 ${ws.dot}`} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">{entry.deadlineTitle}</span>
            {activeCount > 0 && (
              <span className="text-xs font-bold bg-red-700 text-white px-2 py-0.5 rounded-full">
                {activeCount} ACTIVE
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <DaysChip days={entry.daysUntilDeadline} missed={entry.deadlineMissed} />
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${ws.bg} ${ws.text} ${ws.border}`}>
              Max risk: {ws.label}
            </span>
          </div>
        </div>

        <span className="text-gray-400 text-xs shrink-0 mt-1">{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/40">
          <p className="text-sm text-gray-700 leading-relaxed">{entry.summary}</p>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Consequence Cascade — what happens and when
            </p>
            <ConsequenceCascade tiers={entry.consequences} />
          </div>

          {/* Citations */}
          <div className="space-y-0.5">
            {entry.citations.map((c, i) => (
              <p key={i} className="text-xs text-gray-400 italic">{c}</p>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
            <strong>Disclaimer:</strong> {entry.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
}

function RiskSummaryBanner({ risks }: { risks: RiskEntry[] }) {
  const missed  = risks.filter(r => r.deadlineMissed).length;
  const active  = risks.flatMap(r => r.consequences).filter(c => c.alreadyActive).length;
  const urgent  = risks.filter(r => !r.deadlineMissed && r.daysUntilDeadline <= 30).length;

  if (missed === 0 && active === 0 && urgent === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 font-medium">
        ✅ No deadlines missed and no active consequences. Stay on top of upcoming windows.
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 space-y-1">
      {active > 0 && (
        <p className="text-sm font-bold text-red-800">
          🚨 {active} consequence{active > 1 ? 's are' : ' is'} active right now — review below immediately.
        </p>
      )}
      {missed > 0 && (
        <p className="text-sm text-red-700">
          {missed} deadline{missed > 1 ? 's have' : ' has'} passed. Consult your DSO and an immigration attorney.
        </p>
      )}
      {urgent > 0 && (
        <p className="text-sm text-orange-700">
          {urgent} deadline{urgent > 1 ? 's expire' : ' expires'} within 30 days.
        </p>
      )}
    </div>
  );
}

export function RiskModel() {
  const [risks, setRisks] = useState<RiskEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    getRiskModel()
      .then(setRisks)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Computing risk model…</p>;
  if (error)   return <p className="text-sm text-red-600">{error}</p>;
  if (risks.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-900">Risk Model</h2>
        <p className="text-sm text-gray-500">Set up your profile to compute your personalized risk model.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-gray-900">Risk Model — What Happens If You Miss It</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Concrete consequences with exact dates — computed from your profile. Missed-deadline
          cards open automatically. Active consequences are highlighted in red.
        </p>
      </div>

      <RiskSummaryBanner risks={risks} />

      <div className="space-y-3">
        {risks.map(r => <RiskCard key={r.id} entry={r} />)}
      </div>

      <p className="text-xs text-gray-400 italic">
        All dates are computed from your stored profile. Unlawful presence rules are subject to
        policy change. This tool does not provide legal advice — consult your DSO or an immigration
        attorney before taking action.
      </p>
    </div>
  );
}
