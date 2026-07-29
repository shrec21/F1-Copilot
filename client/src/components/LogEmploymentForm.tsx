import { useState } from 'react';
import { postEmployment } from '../api';
import type { EmploymentInput } from '../api';

type AuthType = 'CPT' | 'OPT' | 'STEM-OPT';
type CptType = 'full-time' | 'part-time';

export function LogEmploymentForm() {
  const [employer, setEmployer] = useState('');
  const [authType, setAuthType] = useState<AuthType>('OPT');
  const [cptType, setCptType] = useState<CptType>('part-time');
  const [hoursPerWeek, setHoursPerWeek] = useState<string>('20');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(null);
    setError(null);

    const payload: EmploymentInput = {
      employer,
      authType,
      hoursPerWeek: Number(hoursPerWeek),
      startDate,
    };
    if (authType === 'CPT') {
      payload.cptType = cptType;
    }
    if (endDate) {
      payload.endDate = endDate;
    }

    try {
      await postEmployment(payload);
      setSuccess('Employment record logged successfully.');
      setEmployer('');
      setStartDate('');
      setEndDate('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm max-w-lg">
      <h2 className="text-base font-semibold text-gray-800 mb-4">Log Employment</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="employer">
            Employer
          </label>
          <input
            id="employer"
            type="text"
            required
            value={employer}
            onChange={(e) => setEmployer(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Company name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="authType">
            Authorization Type
          </label>
          <select
            id="authType"
            value={authType}
            onChange={(e) => setAuthType(e.target.value as AuthType)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="OPT">OPT</option>
            <option value="CPT">CPT</option>
            <option value="STEM-OPT">STEM-OPT</option>
          </select>
        </div>

        {authType === 'CPT' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="cptType">
              CPT Type
            </label>
            <select
              id="cptType"
              value={cptType}
              onChange={(e) => setCptType(e.target.value as CptType)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="part-time">Part-time</option>
              <option value="full-time">Full-time</option>
            </select>
          </div>
        )}

        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="hoursPerWeek"
          >
            Hours per Week
          </label>
          <input
            id="hoursPerWeek"
            type="number"
            required
            min={1}
            max={168}
            value={hoursPerWeek}
            onChange={(e) => setHoursPerWeek(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="startDate">
            Start Date
          </label>
          <input
            id="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="endDate">
            End Date <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {success && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            {success}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            Error: {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Saving…' : 'Log Employment'}
        </button>
      </form>
    </div>
  );
}
