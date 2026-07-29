import { useEffect, useState } from 'react';
import { getRules } from '../api';

const FALLBACK_DISCLAIMER =
  'This tool provides computed facts and citations for informational purposes only. ' +
  'It does not constitute legal advice. Consult a qualified DSO or immigration attorney ' +
  'for guidance specific to your situation.';

export function DisclaimerBanner() {
  const [disclaimerText, setDisclaimerText] = useState<string>(FALLBACK_DISCLAIMER);

  useEffect(() => {
    getRules('opt-unemployment')
      .then((rule) => {
        if (rule.disclaimer) {
          setDisclaimerText(rule.disclaimer);
        }
      })
      .catch(() => {
        // Keep the fallback if API fails
      });
  }, []);

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-sm text-amber-900">
      <strong>Note:</strong> {disclaimerText}
    </div>
  );
}
