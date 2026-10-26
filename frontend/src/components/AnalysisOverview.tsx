import { ArrowUpRight, BookOpen, CalendarDays, ClipboardList, FileCheck2, ListChecks, TriangleAlert } from 'lucide-react';
import type { Analysis, Language } from '../lib/types';
import { t } from '../lib/i18n';
import SourceTag from './SourceTag';
import { contentText } from '../lib/content';

export default function AnalysisOverview({ analysis, language, navigate }: { analysis: Analysis; language: Language; navigate: (tab: 'eligibility' | 'documents' | 'roadmap') => void }) {
  const unknowns = analysis.unknowns.map((item, index) => contentText(language, item, analysis.unknowns_kn?.[index]));
  return <div className="overview-grid">
    <section className="result-summary"><div className="result-card-heading"><BookOpen size={18}/><h4>{t(language, 'What this means')}</h4></div>
      <p lang={language}>{contentText(language, analysis.summary_en, analysis.summary_kn)}</p>
      {(analysis.summary_sources ?? []).map((source, i) => <SourceTag key={i} {...source}/>)}</section>
    <section className="deadline-card"><div className="result-card-heading"><CalendarDays size={18}/><h4>{t(language, 'Application deadline')}</h4></div>
      <strong>{analysis.deadline.date_text ?? t(language, 'Deadline not found in the uploaded document. Verify it through the official scholarship provider.')}</strong><SourceTag {...analysis.deadline}/></section>
    <div className="overview-findings">
      <section><div className="finding-heading"><FileCheck2 size={17}/><h4>{t(language, 'Eligibility review')}</h4><button className="icon-btn" title={t(language, 'Eligibility')} aria-label={t(language, 'Review eligibility')} onClick={() => navigate('eligibility')}><ArrowUpRight size={17}/></button></div>
        <p>{t(language, 'Extracted requirements')}: {analysis.criteria.length}</p><small>{t(language, 'Preliminary only. Confirm every condition with the provider.')}</small></section>
      <section><div className="finding-heading"><ClipboardList size={17}/><h4>{t(language, 'Required documents')}</h4><button className="icon-btn" title={t(language, 'Documents')} aria-label={t(language, 'Review documents')} onClick={() => navigate('documents')}><ArrowUpRight size={17}/></button></div>
        {analysis.documents.length ? <ul>{analysis.documents.slice(0, 3).map((doc, i) => <li key={i}>{contentText(language, doc.name, doc.name_kn)}</li>)}</ul> : <p>{t(language, 'No document requirements were clearly extracted. Review the notice manually.')}</p>}</section>
      <section><div className="finding-heading"><TriangleAlert size={17}/><h4>{t(language, 'Missing information')}</h4></div>
        {unknowns.length ? <ul>{unknowns.slice(0, 3).map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>{t(language, 'No missing details were reported in this analysis. Verify completeness against the notice.')}</p>}</section>
      <section><div className="finding-heading"><ListChecks size={17}/><h4>{t(language, 'Recommended next actions')}</h4><button className="icon-btn" title={t(language, 'Action plan')} aria-label={t(language, 'Review roadmap')} onClick={() => navigate('roadmap')}><ArrowUpRight size={17}/></button></div>
        {(analysis.roadmap?.length || analysis.steps.length) ? <ul>{(analysis.roadmap?.length ? analysis.roadmap : analysis.steps).slice(0, 2).map((step, i) => <li key={i}>{contentText(language, step.title, step.title_kn)}</li>)}</ul> : <p>{t(language, 'Needs verification')}</p>}</section>
    </div>
  </div>;
}
