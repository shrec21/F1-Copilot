import { useEffect, useState } from 'react';
import { getAlerts, type Alert } from '../api';

const SEVERITY_STYLES: Record<Alert['severity'], { border: string; bg: string; badge: string; text: string }> = {
  critical: {
    border: 'border-l-red-600',
    bg: 'bg-red-50',
    badge: 'bg-red-100 text-red-800',
    text: 'text-red-900',
  },
  warning: {
    border: 'border-l-yellow-500',
    bg: 'bg-yellow-50',
    badge: 'bg-yellow-100 text-yellow-800',
    text: 'text-yellow-900',
  },
  info: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-800',
    text: 'text-blue-900',
  },
};

export function AlertsBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    getAlerts()
      .then(setAlerts)
      .catch(() => {});
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Proactive Alerts</h2>
      {alerts.map((alert) => {
        const s = SEVERITY_STYLES[alert.severity];
        return (
          <div
            key={alert.id}
            className={`border-l-4 ${s.border} ${s.bg} rounded p-3`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${s.badge}`}>
                {alert.severity.toUpperCase()}
              </span>
              <span className={`text-sm font-medium ${s.text}`}>{alert.title}</span>
              {alert.daysUntil !== undefined && (
                <span className="ml-auto text-xs text-gray-500">
                  {alert.daysUntil >= 0 ? `${alert.daysUntil}d remaining` : 'Overdue'}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700">{alert.description}</p>
            <p className="text-xs text-gray-500 mt-1 italic">Action: {alert.action}</p>
          </div>
        );
      })}
    </div>
  );
}
