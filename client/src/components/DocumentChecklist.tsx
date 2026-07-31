import { useEffect, useState, useRef } from 'react';
import { getDocuments, updateDocument, type DocumentItem, type DocumentStatus } from '../api';

const STATUS_CONFIG: Record<DocumentStatus, { label: string; color: string; dot: string }> = {
  'not-started': { label: 'Not started',  color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  'located':     { label: 'Located',      color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  'scanned':     { label: 'Scanned/saved', color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  'submitted':   { label: 'Submitted',    color: 'bg-green-100 text-green-700',   dot: 'bg-green-500' },
};

const STATUS_ORDER: DocumentStatus[] = ['not-started', 'located', 'scanned', 'submitted'];

const CATEGORY_LABELS: Record<DocumentItem['category'], string> = {
  identity:   'Identity',
  immigration: 'Immigration',
  academic:   'Academic',
  employment: 'Employment',
  financial:  'Financial',
};

function ProgressSummary({ docs }: { docs: DocumentItem[] }) {
  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = docs.filter(d => d.status === s).length;
    return acc;
  }, {} as Record<DocumentStatus, number>);

  const done = counts['submitted'];
  const total = docs.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{done} of {total} documents submitted</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
        <div className="bg-green-500 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex gap-4 flex-wrap">
        {STATUS_ORDER.map(s => (
          <span key={s} className="flex items-center gap-1 text-xs text-gray-600">
            <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s].dot}`} />
            {counts[s]} {STATUS_CONFIG[s].label}
          </span>
        ))}
      </div>
    </div>
  );
}

function DocumentRow({ doc, onUpdate }: { doc: DocumentItem; onUpdate: (id: string, patch: { status?: DocumentStatus; notes?: string }) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(doc.notes ?? '');
  const [saving, setSaving] = useState(false);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const handleStatusChange = async (status: DocumentStatus) => {
    setSaving(true);
    await onUpdate(doc.id, { status }).finally(() => setSaving(false));
  };

  const handleNotesSave = async () => {
    setSaving(true);
    await onUpdate(doc.id, { notes: notesRef.current }).finally(() => setSaving(false));
  };

  const cfg = STATUS_CONFIG[doc.status];

  return (
    <div className={`border rounded-lg overflow-hidden ${doc.status === 'submitted' ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'}`}>
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Status dot */}
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-medium ${doc.status === 'submitted' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {doc.name}
            </span>
            {doc.requiredForDsTransition && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Required</span>
            )}
            {doc.conditional && (
              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Conditional</span>
            )}
          </div>
        </div>

        {/* Status selector */}
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {saving && <span className="text-xs text-gray-400">Saving…</span>}
          <select
            value={doc.status}
            onChange={e => handleStatusChange(e.target.value as DocumentStatus)}
            className={`text-xs border-0 rounded px-2 py-1 font-medium cursor-pointer ${cfg.color}`}
          >
            {STATUS_ORDER.map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
          <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">What it is</p>
              <p className="text-gray-700">{doc.description}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Why you need it</p>
              <p className="text-gray-700">{doc.whyNeeded}</p>
            </div>
          </div>

          {doc.conditional && (
            <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-1">
              Conditional: {doc.conditional}
            </p>
          )}

          {doc.resource && (
            <a
              href={doc.resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-xs text-blue-600 hover:underline border border-blue-200 bg-blue-50 rounded px-2 py-1"
            >
              {doc.resource.label} ↗
            </a>
          )}

          {doc.updatedAt && (
            <p className="text-xs text-gray-400">Last updated: {doc.updatedAt.slice(0, 10)}</p>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Where it's stored, file name, anything useful…"
                className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 resize-none"
              />
              <button
                onClick={handleNotesSave}
                disabled={saving}
                className="text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded px-3 py-1 self-start"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DocumentChecklist() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'required' | 'todo'>('all');

  const load = () => {
    setLoading(true);
    getDocuments()
      .then(setDocs)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUpdate = async (id: string, patch: { status?: DocumentStatus; notes?: string }) => {
    // Optimistic update
    setDocs(prev => prev.map(d =>
      d.id === id
        ? { ...d, ...patch, updatedAt: new Date().toISOString() }
        : d,
    ));
    await updateDocument(id, patch);
  };

  if (loading) return <p className="text-sm text-gray-500">Loading document checklist…</p>;
  if (error)   return <p className="text-sm text-red-600">{error}</p>;

  const filtered = docs.filter(d => {
    if (filter === 'required') return d.requiredForDsTransition;
    if (filter === 'todo')     return d.status !== 'submitted';
    return true;
  });

  // Group by category
  const categories = Array.from(new Set(filtered.map(d => d.category))) as DocumentItem['category'][];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-gray-900">Document Checklist</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Track every document you need for the D/S transition, OPT, and ongoing F-1 compliance.
          Click any row to expand, add notes, or update status.
        </p>
      </div>

      <ProgressSummary docs={docs} />

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-0">
        {(['all', 'required', 'todo'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'all' ? 'All' : f === 'required' ? 'Required for D/S' : 'To-do'}
          </button>
        ))}
      </div>

      {/* Document rows grouped by category */}
      {categories.map(cat => (
        <div key={cat}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {CATEGORY_LABELS[cat]}
          </h3>
          <div className="space-y-2">
            {filtered
              .filter(d => d.category === cat)
              .map(doc => (
                <DocumentRow key={doc.id} doc={doc} onUpdate={handleUpdate} />
              ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-sm text-gray-400 italic text-center py-6">No documents match this filter.</p>
      )}

      <p className="text-xs text-gray-400 italic">
        This checklist is a guide only. Your DSO is the authoritative source on which documents are required for your specific situation.
      </p>
    </div>
  );
}
