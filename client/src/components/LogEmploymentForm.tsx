import { useEffect, useState } from 'react';
import { postEmployment, getEmployment, putEmployment, deleteEmployment } from '../api';
import type { EmploymentInput, EmploymentRecord } from '../api';

type AuthType = 'CPT' | 'OPT' | 'STEM-OPT';
type CptType = 'full-time' | 'part-time';

const AUTH_BADGE: Record<string, string> = {
  OPT: 'bg-blue-100 text-blue-800',
  CPT: 'bg-purple-100 text-purple-800',
  'STEM-OPT': 'bg-green-100 text-green-800',
};

function blankForm() {
  return { employer: '', authType: 'OPT' as AuthType, cptType: 'part-time' as CptType, hoursPerWeek: '20', startDate: '', endDate: '' };
}

function recordToForm(r: EmploymentRecord) {
  return {
    employer: r.employer,
    authType: r.authorizationType,
    cptType: (r.cptType ?? 'part-time') as CptType,
    hoursPerWeek: String(r.hoursPerWeek),
    startDate: r.period.start,
    endDate: r.period.end ?? '',
  };
}

function EmploymentFields({
  values,
  onChange,
}: {
  values: ReturnType<typeof blankForm>;
  onChange: (v: ReturnType<typeof blankForm>) => void;
}) {
  const set = (patch: Partial<ReturnType<typeof blankForm>>) => onChange({ ...values, ...patch });
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Employer</label>
        <input type="text" required value={values.employer}
          onChange={(e) => set({ employer: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Company name" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Auth type</label>
          <select value={values.authType} onChange={(e) => set({ authType: e.target.value as AuthType })}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="OPT">OPT</option>
            <option value="CPT">CPT</option>
            <option value="STEM-OPT">STEM-OPT</option>
          </select>
        </div>
        {values.authType === 'CPT' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">CPT type</label>
            <select value={values.cptType} onChange={(e) => set({ cptType: e.target.value as CptType })}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="part-time">Part-time</option>
              <option value="full-time">Full-time</option>
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hrs / week</label>
          <input type="number" required min={1} max={168} value={values.hoursPerWeek}
            onChange={(e) => set({ hoursPerWeek: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
          <input type="date" required value={values.startDate}
            onChange={(e) => set({ startDate: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">End date <span className="text-gray-400">(optional)</span></label>
          <input type="date" value={values.endDate}
            onChange={(e) => set({ endDate: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </div>
  );
}

function toPayload(v: ReturnType<typeof blankForm>): EmploymentInput {
  const p: EmploymentInput = { employer: v.employer, authType: v.authType, hoursPerWeek: Number(v.hoursPerWeek), startDate: v.startDate };
  if (v.authType === 'CPT') p.cptType = v.cptType;
  if (v.endDate) p.endDate = v.endDate;
  return p;
}

export function LogEmploymentForm() {
  const [records, setRecords] = useState<EmploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState(blankForm());
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [addValues, setAddValues] = useState(blankForm());
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [addError, setAddError] = useState('');

  const fetchRecords = async () => {
    try { setRecords(await getEmployment()); }
    catch { /* history stays as-is */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRecords(); }, []);

  function startEdit(r: EmploymentRecord) {
    setEditingId(r.id);
    setEditValues(recordToForm(r));
    setEditError('');
  }

  function cancelEdit() { setEditingId(null); setEditError(''); }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditSaving(true);
    setEditError('');
    try {
      await putEmployment(editingId, toPayload(editValues));
      setEditingId(null);
      fetchRecords();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this employment record?')) return;
    try {
      await deleteEmployment(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      if (editingId === id) setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccess('');
    setAddError('');
    try {
      await postEmployment(toPayload(addValues));
      setSuccess('Employment record added.');
      setAddValues(blankForm());
      fetchRecords();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* History */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Employment History</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-gray-500">No employment records yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {records.map((r) =>
              editingId === r.id ? (
                <li key={r.id} className="py-4">
                  <form onSubmit={saveEdit} className="space-y-3">
                    <EmploymentFields values={editValues} onChange={setEditValues} />
                    {editError && <p className="text-xs text-red-700">{editError}</p>}
                    <div className="flex gap-2">
                      <button type="submit" disabled={editSaving}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50">
                        {editSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={cancelEdit}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200">
                        Cancel
                      </button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={r.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{r.employer}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AUTH_BADGE[r.authorizationType]}`}>
                        {r.authorizationType}{r.cptType ? ` (${r.cptType})` : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.period.start} → {r.period.end ?? 'present'} · {r.hoursPerWeek} hrs/wk
                    </p>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => startEdit(r)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                    <button onClick={() => handleDelete(r.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium">Remove</button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </div>

      {/* Add form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Add Employment</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <EmploymentFields values={addValues} onChange={setAddValues} />
          {success && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">{success}</p>}
          {addError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">Error: {addError}</p>}
          <button type="submit" disabled={submitting}
            className="w-full bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Saving…' : 'Add employment'}
          </button>
        </form>
      </div>
    </div>
  );
}
