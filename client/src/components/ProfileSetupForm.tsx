import { useEffect, useState } from 'react';
import { getProfile, postProfile } from '../api';

const BLANK = {
  fullName: '',
  programEndDate: '',
  degreeLevel: 'masters',
  visaAdmissionType: 'D/S' as 'D/S' | 'fixed-date',
  admissionDate: '',
  isStemEligible: false,
};

export function ProfileSetupForm({ onFirstSave }: { onFirstSave?: () => void }) {
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(true);
  const [isExisting, setIsExisting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    getProfile()
      .then((profile) => {
        if (profile) {
          setForm({
            fullName: profile.fullName,
            programEndDate: profile.programEndDate,
            degreeLevel: profile.degreeLevel,
            visaAdmissionType: profile.visaAdmissionType,
            admissionDate: profile.admissionDate,
            isStemEligible: profile.isStemEligible,
          });
          setIsExisting(true);
        }
      })
      .catch(() => {/* no profile yet — keep blank form */})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    setError('');
    try {
      await postProfile(form);
      setSaveStatus('saved');
      if (!isExisting) {
        // First-time setup — go to dashboard
        onFirstSave?.();
      } else {
        setIsExisting(true);
      }
    } catch (err) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-400 animate-pulse">Loading profile…</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="mb-5">
        <h2 className="text-base font-bold text-gray-900">
          {isExisting ? 'Edit Profile' : 'Profile Setup'}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {isExisting
            ? 'Update your profile details below. Changes take effect immediately on the dashboard.'
            : 'Fill in your F-1 details to start tracking your compliance status.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
          <input
            type="text"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Jane Doe"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Degree level</label>
          <select
            value={form.degreeLevel}
            onChange={(e) => setForm({ ...form, degreeLevel: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="bachelors">Bachelor's</option>
            <option value="masters">Master's</option>
            <option value="doctorate">Doctorate</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">I-20 admission date</label>
            <input
              type="date"
              required
              value={form.admissionDate}
              onChange={(e) => setForm({ ...form, admissionDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program end date</label>
            <input
              type="date"
              required
              value={form.programEndDate}
              onChange={(e) => setForm({ ...form, programEndDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Visa admission type</label>
          <select
            value={form.visaAdmissionType}
            onChange={(e) =>
              setForm({ ...form, visaAdmissionType: e.target.value as 'D/S' | 'fixed-date' })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="D/S">D/S (Duration of Status) — most F-1 students</option>
            <option value="fixed-date">Fixed date — check your visa stamp</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="stem"
            checked={form.isStemEligible}
            onChange={(e) => setForm({ ...form, isStemEligible: e.target.checked })}
            className="rounded border-gray-300"
          />
          <label htmlFor="stem" className="text-sm text-gray-700">
            STEM-designated degree
            <span className="text-gray-400 ml-1">(eligible for 24-month STEM OPT extension)</span>
          </label>
        </div>

        {saveStatus === 'saved' && isExisting && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Profile updated.
          </p>
        )}
        {saveStatus === 'error' && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            Error: {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saveStatus === 'saving'}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saveStatus === 'saving' ? 'Saving…' : isExisting ? 'Update profile' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
