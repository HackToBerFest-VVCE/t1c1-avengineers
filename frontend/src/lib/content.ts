import type { Analysis, Language } from './types';
import { t } from './i18n';

export function contentText(language: Language, english?: string | null, kannada?: string | null): string {
  if (language === 'en') return english?.trim() || t(language, 'English translation unavailable');
  if (kannada && /[\u0c80-\u0cff]/.test(kannada)) return kannada;
  return `${t(language, 'Kannada translation unavailable')}${english ? `: ${english}` : ''}`;
}

export function needsContentTranslation(analysis: Analysis): boolean {
  const pairs = [[analysis.summary_en, analysis.summary_kn],
    ...analysis.criteria.map(item => [item.requirement, item.requirement_kn]),
    ...analysis.documents.map(item => [item.name, item.name_kn]),
    ...analysis.steps.flatMap(item => [[item.title, item.title_kn], [item.detail_en, item.detail_kn]]),
    ...analysis.warnings.map((item, i) => [item, analysis.warnings_kn?.[i]]),
    ...analysis.unknowns.map((item, i) => [item, analysis.unknowns_kn?.[i]])];
  return pairs.some(([en, kn]) => (en && (!kn || !/[\u0c80-\u0cff]/.test(kn))) || (kn && (!en || !/[a-z]/i.test(en))));
}
