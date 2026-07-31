import { useEffect, useState, useCallback } from 'react';
import { getActionPlan, toggleActionStep, type ActionStep } from '../api';

const CATEGORY_ICONS: Record<ActionStep['category'], string> = {
  verify:   '🔍',
  contact:  '📞',
  document: '📄',
  file:     '📋',
  track:    '📅',
  plan:     '🗺️',
};

const PRIORITY_STYLES: Record<ActionStep['priority'], { badge: string; border: string }> = {
  critical: { badge: 'bg-red-100 text-red-700',    border: 'border-l-red-500' },
  high:     { badge: 'bg-orange-100 text-orange-700', border: 'border-l-orange-400' },
  medium:   { badge: 'bg-yellow-100 text-yellow-700', border: 'border-l-yellow-400' },
  low:      { badge: 'bg-gray-100 text-gray-600',   border: 'border-l-gray-300' },
};

function DaysChip({ daysUntil }: { daysUntil: number }) {
  if (daysUntil < 0) return <span className="text-xs text-gray-400 italic">past</span>;
  if (daysUntil === 0) return <span className="text-xs font-bold text-red-600">Today</span>;
  const color = daysUntil <= 30 ? 'text-red-600' : daysUntil <= 90 ? 'text-yellow-700' : 'text-gray-500';
  return <span className={`text-xs font-semibold ${color}`}>{daysUntil}d left</span>;
}

function StepCard({
  step,
  onToggle,
}: {
  step: ActionStep;
  onToggle: (id: string, completed: boolean) => void;
}) {
  const p = PRIORITY_STYLES[step.priority];

  return (
    <div
      className={`border-l-4 ${p.border} bg-white rounded-r-lg shadow-sm p-4 transition-opacity ${
        step.completed ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(step.id, !step.completed)}
          aria-label={step.completed ? 'Mark incomplete' : 'Mark complete'}
          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            step.completed
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-green-400'
          }`}
        >
          {step.completed && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-base">{CATEGORY_ICONS[step.category]}</span>
            <span className={`text-sm font-semibold ${step.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {step.title}
            </span>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${p.badge}`}>
              {step.priority}
            </span>
            {step.deadline && step.daysUntil !== undefined && (
              <DaysChip daysUntil={step.daysUntil} />
            )}
            {step.deadline && (
              <span className="text-xs text-gray-400 ml-auto shrink-0">{step.deadline}</span>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>

          {/* Citation */}
          {step.citation && (
            <p className="text-xs text-gray-400 mt-1 italic">{step.citation}</p>
          )}

          {/* Resources */}
          {step.resources.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {step.resources.map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline border border-blue-200 rounded px-2 py-0.5 bg-blue-50"
                >
                  {r.label} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ActionPlanTab() {
  const [steps, setSteps] = useState<ActionStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getActionPlan()
      .then(setSteps)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id: string, completed: boolean) => {
    // Optimistic update
    setSteps(prev => prev.map(s => s.id === id ? { ...s, completed } : s));
    try {
      await toggleActionStep(id, completed);
    } catch {
      // Revert on failure
      setSteps(prev => prev.map(s => s.id === id ? { ...s, completed: !completed } : s));
    }
  };

  const completedCount = steps.filter(s => s.completed).length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  if (loading) return <p className="text-sm text-gray-500">Loading your action plan…</p>;
  if (error)   return <p className="text-sm text-red-600">{error}</p>;
  if (steps.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-900">D/S Transition Action Plan</h2>
        <p className="text-sm text-gray-500">Set up your profile first to generate a personalized plan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-gray-900">D/S → Fixed-Date Transition Action Plan</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Personalized steps based on your profile. Check off each item as you complete it.
        </p>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{completedCount} of {steps.length} steps completed</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map(step => (
          <StepCard key={step.id} step={step} onToggle={handleToggle} />
        ))}
      </div>

      <p className="text-xs text-gray-400 italic">
        This checklist is for informational purposes only and does not constitute legal advice.
        Consult your DSO or an immigration attorney for guidance specific to your situation.
      </p>
    </div>
  );
}
