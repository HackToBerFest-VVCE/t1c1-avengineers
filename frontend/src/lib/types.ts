export interface Profile {
  education_level: string;
  state: string;
  category: string;
  annual_income: string;
  percentage: string;
}
export interface SourceFact {
  evidence: string | null;
  page: number | null;
}
export interface Criterion extends SourceFact {
  requirement: string;
  status: 'likely_meets' | 'may_not_meet' | 'needs_review';
  explanation_en: string;
  explanation_kn: string;
}
export interface RequiredDocument extends SourceFact { name: string }
export interface Step {
  title: string;
  detail_en: string;
  detail_kn: string;
}
export interface Analysis {
  title: string;
  provider: string | null;
  summary_en: string;
  summary_kn: string;
  deadline: SourceFact & { date_text: string | null; iso_date: string | null };
  criteria: Criterion[];
  documents: RequiredDocument[];
  steps: Step[];
  unknowns: string[];
  warnings: string[];
  confidence: 'high' | 'medium' | 'low';
  model_used: string;
  pages_analyzed: number;
  processing_seconds: number;
  request_id: string;
  filename: string;
  disclaimer: string;
}
export interface Health {
  status: string;
  gemma_configured: boolean;
  model: string;
}
