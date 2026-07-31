import { useState } from 'react';
import { postDsoEmail, type DsoEmailType } from '../api';

const EMAIL_TYPES: { value: DsoEmailType; label: string }[] = [
  { value: 'cpt-request', label: 'CPT Authorization Request' },
  { value: 'opt-question', label: 'OPT Question' },
  { value: 'stem-extension', label: 'STEM OPT Extension Request' },
  { value: 'general-inquiry', label: 'General Inquiry' },
];

export function DsoEmailTab() {
  const [emailType, setEmailType] = useState<DsoEmailType>('cpt-request');
  const [context, setContext] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setEmail(null);
    try {
      const result = await postDsoEmail({
        emailType,
        additionalContext: context.trim() || undefined,
      });
      setEmail(result.email);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!email) return;
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">DSO Email Generator</h2>
        <p className="text-sm text-gray-500">
          Generate a professional email to your Designated School Official using your profile data.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        <strong>Disclaimer:</strong> This email is AI-generated as a starting point only. Review it carefully,
        adjust any details, and ensure all facts are accurate before sending. Do not rely on this as legal advice.
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Type</label>
          <select
            value={emailType}
            onChange={e => setEmailType(e.target.value as DsoEmailType)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {EMAIL_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional Context <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="E.g., employer name, internship start date, specific questions…"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none"
          />
        </div>
      </div>

      <button
        onClick={generate}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate Email'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {email && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Generated Email</span>
            <button
              onClick={copyToClipboard}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 border border-blue-200 rounded"
            >
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
          <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap leading-relaxed text-gray-800 overflow-x-auto">
            {email}
          </pre>
        </div>
      )}
    </div>
  );
}
