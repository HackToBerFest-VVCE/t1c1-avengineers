export interface Profile {
  education_level: string;
  state: string;
  category: string;
  annual_income: string;
  percentage: string;
  age: string;
  study_mode: string;
}
export type Language = 'en' | 'kn';
export interface Verification { status: 'verified' | 'partial_match' | 'unverified' | 'not_available'; reason: string; matched_text?: string | null }
export interface SourceFact {
  evidence: string | null;
  page: number | null;
  verification?: Verification | null;
}
export interface Criterion extends SourceFact {
  requirement: string;
  requirement_kn?: string | null;
  student_value?: string | number | null;
  rule?: { field: string; operator: string; value_number: number | null; values: string[] } | null;
  status: 'likely_meets' | 'may_not_meet' | 'needs_review';
  explanation_en: string;
  explanation_kn: string;
}
export interface RequiredDocument extends SourceFact { name: string; name_kn?: string | null }
export interface Step extends SourceFact {
  title: string;
  detail_en: string;
  detail_kn: string;
  title_kn?: string | null;
  priority: 'critical' | 'important' | 'optional';
}
export interface RoadmapTask extends Step { id: string; completed: boolean }
export interface ChatAnswer { answer: string; suggestions: string[]; missing_information: string[]; citations: SourceFact[]; disclaimer: string }
export interface Analysis {
  title: string;
  provider: string | null;
  summary_en: string;
  summary_kn: string;
  summary_sources: SourceFact[];
  session_id: string;
  session_expires_in: number;
  roadmap: RoadmapTask[];
  deadline: SourceFact & { date_text: string | null; iso_date: string | null };
  criteria: Criterion[];
  eligibility_overall: "needs_verification" | "possible_mismatch" | "appears_to_meet_extracted";
  documents: RequiredDocument[];
  steps: Step[];
  unknowns: string[];
  warnings: string[];
  unknowns_kn: string[];
  warnings_kn: string[];
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
