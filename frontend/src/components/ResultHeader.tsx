import { CheckCircle2, CircleHelp, Clock3, Cpu, FileText, Layers3, TriangleAlert } from 'lucide-react';
import type { Analysis, Language } from '../lib/types';
import { t } from '../lib/i18n';

export default function ResultHeader({ analysis, language }: { analysis: Analysis; language: Language }) {
  const outcome = analysis.eligibility_overall;
  const label = outcome === 'appears_to_meet_extracted' ? 'Appears to meet extracted rules' : outcome === 'possible_mismatch' ? 'Possible eligibility mismatch' : 'Needs verification';
  const Icon = outcome === 'appears_to_meet_extracted' ? CheckCircle2 : outcome === 'possible_mismatch' ? TriangleAlert : CircleHelp;
  return <header className="result-banner">
    <div className="result-identity"><div className="result-eyebrow"><CheckCircle2 size={15}/>{t(language, 'Analysis complete')}</div>
      <h3>{t(language, analysis.title)}</h3><p>{analysis.provider || t(language, 'Not specified in the notice')}</p></div>
    <div className={`result-outcome ${outcome}`}><Icon size={17}/><strong>{t(language, label)}</strong><small>{t(language, 'Preliminary assessment')}</small></div>
    <div className="result-metadata"><span title={analysis.filename}><FileText size={14}/><span>{analysis.filename}</span></span><span><Layers3 size={14}/>{t(language, 'Page count')}: {analysis.pages_analyzed}</span>
      {Number.isFinite(analysis.processing_seconds) && <span><Clock3 size={14}/>{analysis.processing_seconds.toFixed(1)}s</span>}
      <span><Cpu size={14}/>{analysis.model_used}</span><span>{t(language, 'Model-estimated confidence')}: {analysis.confidence}</span></div>
  </header>;
}
