import type { Criterion, Language } from '../lib/types';
import { t } from '../lib/i18n';

export default function EligibilitySummary({ criteria, language }: { criteria: Criterion[]; language: Language }) {
  return <div className="eligibility-counts" aria-label={language === 'kn' ? 'ಅರ್ಹತೆಯ ಸಾರಾಂಶ' : 'Eligibility summary'}>
    {([['likely_meets', 'Satisfied'], ['may_not_meet', 'Possible mismatches'], ['needs_review', 'Needs verification']] as const).map(([status, label]) =>
      <div key={status} className={status}><strong>{criteria.filter(item => item.status === status).length}</strong><span>{t(language, label)}</span></div>)}
  </div>;
}
