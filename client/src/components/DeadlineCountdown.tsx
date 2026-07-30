import { useEffect, useState } from 'react';
import { getDeadlines, type Deadline } from '../api';

const SEVERITY_STYLES: Record<Deadline['severity'], { card: string; counter: string; label: string }> = {
  critical: { card: 'border-red-300 bg-red-50', counter: 'text-red-700', label: 'bg-red-100 text-red-700' },
  warning:  { card: 'border-yellow-300 bg-yellow-50', counter: 'text-yellow-700', label: 'bg-yellow-100 text-yellow-700' },
  info:     { card: 'border-blue-200 bg-blue-50', counter: 'text-blue-700', label: 'bg-blue-100 text-blue-700' },
  past:     { card: 'border-gray-200 bg-gray-50', counter: 'text-gray-400', label: 'bg-gray-100 text-gray-500' },
};

function DeadlineCard({ deadline }: { deadline: Deadline }) {
  const s = SEVERITY_STYLES[deadline.severity];
  const isPast = deadline.daysUntil < 0;

  return (
    <div className={`border rounded-lg p-4 flex flex-col gap-1 ${s.card}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-gray-600 leading-tight">{deadline.title}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 font-medium ${s.label}`}>
          {deadline.severity.toUpperCase()}
        </span>
      </div>
      <div className={`text-3xl font-bold tabular-nums ${s.counter}`}>
        {isPast ? 'Past' : deadline.daysUntil === 0 ? 'Today' : `${deadline.daysUntil}d`}
      </div>
      <div className="text-xs text-gray-500">{deadline.date}</div>
      <p className="text-xs text-gray-600 mt-1">{deadline.description}</p>
      <p className="text-xs text-gray-400 italic mt-0.5">{deadline.citation}</p>
    </div>
  );
}

export function DeadlineCountdown() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);

  useEffect(() => {
    getDeadlines()
      .then(setDeadlines)
      .catch(() => {});
  }, []);

  if (deadlines.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Upcoming Deadlines</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {deadlines.map((d) => (
          <DeadlineCard key={d.id} deadline={d} />
        ))}
      </div>
    </div>
  );
}
