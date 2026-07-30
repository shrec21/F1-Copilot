import { useState } from 'react';
import { getStatus, postSimulate, type StatusResponse, type SimulateInput } from '../api';

interface HypotheticalRole {
  employer: string;
  authType: 'CPT' | 'OPT' | 'STEM-OPT';
  cptType?: 'full-time' | 'part-time';
  hoursPerWeek: number;
  startDate: string;
  endDate?: string;
}

function emptyRole(): HypotheticalRole {
  return { employer: '', authType: 'OPT', hoursPerWeek: 40, startDate: '' };
}

function StatusSection({ label, status }: { label: string; status: StatusResponse }) {
  const { unemployment, cptImpact, conflicts, dsStatus } = status;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-700 text-sm border-b pb-1">{label}</h3>

      {unemployment ? (
        <div className="text-sm">
          <div className="font-medium text-gray-600 mb-1">OPT Unemployment</div>
          <div className={`text-xs px-2 py-1 rounded font-semibold inline-block ${
            unemployment.status === 'exceeded' ? 'bg-red-100 text-red-700' :
            unemployment.status === 'warning'  ? 'bg-yellow-100 text-yellow-700' :
                                                 'bg-green-100 text-green-700'
          }`}>
            {unemployment.status.toUpperCase()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {unemployment.usedDays} used / {unemployment.remainingDays} remaining
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-400">No OPT window on record</div>
      )}

      <div className="text-sm">
        <div className="font-medium text-gray-600 mb-1">CPT Impact</div>
        <div className={`text-xs px-2 py-1 rounded font-semibold inline-block ${
          cptImpact.optEligibilityAtRisk ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          OPT at risk: {cptImpact.optEligibilityAtRisk ? 'YES' : 'NO'}
        </div>
        <div className="text-xs text-gray-500 mt-1">{cptImpact.totalFullTimeMonths} full-time CPT months</div>
      </div>

      <div className="text-sm">
        <div className="font-medium text-gray-600 mb-1">Conflicts</div>
        {conflicts.length === 0 ? (
          <span className="text-xs text-green-700">None detected</span>
        ) : (
          <ul className="text-xs text-red-700 space-y-1">
            {conflicts.map((c, i) => (
              <li key={i}>{c.description}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-sm">
        <div className="font-medium text-gray-600 mb-1">D/S Regime</div>
        <span className="text-xs text-gray-700">{dsStatus.regime}</span>
        {dsStatus.transitionDeadline && (
          <div className="text-xs text-gray-500">Deadline: {dsStatus.transitionDeadline}</div>
        )}
      </div>
    </div>
  );
}

export function SimulatorTab() {
  const [roles, setRoles] = useState<HypotheticalRole[]>([emptyRole()]);
  const [current, setCurrent] = useState<StatusResponse | null>(null);
  const [simulated, setSimulated] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRole(idx: number, patch: Partial<HypotheticalRole>) {
    setRoles(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  function addRole() {
    setRoles(prev => [...prev, emptyRole()]);
  }

  function removeRole(idx: number) {
    setRoles(prev => prev.filter((_, i) => i !== idx));
  }

  async function runSimulation() {
    setLoading(true);
    setError(null);
    try {
      const [currentStatus, simulatedStatus] = await Promise.all([
        getStatus(),
        postSimulate({ roles } as SimulateInput),
      ]);
      setCurrent(currentStatus);
      setSimulated(simulatedStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">What-If Simulator</h2>
        <p className="text-sm text-gray-500">
          Add hypothetical employment periods below and click Run to see how they would affect your compliance status.
          No data is saved.
        </p>
      </div>

      <div className="space-y-3">
        {roles.map((role, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Hypothetical Role {idx + 1}</span>
              {roles.length > 1 && (
                <button
                  onClick={() => removeRole(idx)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Employer</label>
                <input
                  type="text"
                  value={role.employer}
                  onChange={e => updateRole(idx, { employer: e.target.value })}
                  placeholder="Company name"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Authorization Type</label>
                <select
                  value={role.authType}
                  onChange={e => updateRole(idx, { authType: e.target.value as HypotheticalRole['authType'] })}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="OPT">OPT</option>
                  <option value="CPT">CPT</option>
                  <option value="STEM-OPT">STEM-OPT</option>
                </select>
              </div>
              {role.authType === 'CPT' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">CPT Type</label>
                  <select
                    value={role.cptType ?? 'part-time'}
                    onChange={e => updateRole(idx, { cptType: e.target.value as 'full-time' | 'part-time' })}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="part-time">Part-time</option>
                    <option value="full-time">Full-time</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Hours / Week</label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={role.hoursPerWeek}
                  onChange={e => updateRole(idx, { hoursPerWeek: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={role.startDate}
                  onChange={e => updateRole(idx, { startDate: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">End Date (optional)</label>
                <input
                  type="date"
                  value={role.endDate ?? ''}
                  onChange={e => updateRole(idx, { endDate: e.target.value || undefined })}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addRole}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          + Add another role
        </button>
      </div>

      <button
        onClick={runSimulation}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Running…' : 'Run Simulation'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {current && simulated && (
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <StatusSection label="Current Status" status={current} />
          </div>
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/30">
            <StatusSection label="Simulated Status" status={simulated} />
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 italic">
        Simulation does not modify your data. Results are for planning purposes only — consult your DSO.
      </p>
    </div>
  );
}
