import { useEffect, useState } from 'react';
import { getDeadlines, getDeadlinesIcalUrl, type Deadline } from '../api';

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

  const hasActiveDeadlines = deadlines.some(d => d.severity !== 'past');

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Upcoming Deadlines</h2>
        {hasActiveDeadlines && (
          <a
            href={getDeadlinesIcalUrl()}
            download="f1-deadlines.ics"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" />
            </svg>
            Export to Calendar
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {deadlines.map((d) => (
          <DeadlineCard key={d.id} deadline={d} />
        ))}
      </div>
    </div>
  );
}
