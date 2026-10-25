import { createContext, useContext } from 'react';
import { BookOpenText } from 'lucide-react';
import type { Language, SourceFact } from '../lib/types';
import { t } from '../lib/i18n';
import SourceVerificationBadge from './SourceVerificationBadge';

export const EvidenceContext = createContext<{ language: Language; open: (fact: SourceFact) => void }>({ language: 'en', open: () => {} });

export default function SourceTag(fact: SourceFact) {
  const { language, open } = useContext(EvidenceContext);
  if (!fact.evidence && fact.page === null) return <span className="no-evidence">{t(language, 'No quoted evidence - verify manually')}</span>;
  return <div className="source-fact">
    <button type="button" className="source-tag" onClick={() => open(fact)} title={t(language, 'View evidence')}>
      <BookOpenText size={13} aria-hidden="true" />
      <span>{fact.page !== null ? `${t(language, 'Page')} ${fact.page}` : t(language, 'Page unconfirmed')}</span>
      {fact.evidence && <span className="source-quote">“{fact.evidence}”</span>}
    </button>
    <SourceVerificationBadge verification={fact.verification} language={language}/>
  </div>;
}
