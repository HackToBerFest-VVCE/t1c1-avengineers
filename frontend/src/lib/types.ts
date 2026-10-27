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
  requires_manual_review?: boolean;
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

// ── Scholarship Freshness Intelligence types ────────────────────────────

export type FreshnessStatus =
  | 'newer_official_version_found'
  | 'uploaded_document_appears_current'
  | 'no_newer_version_verified'
  | 'unable_to_verify_freshness'
  | 'multiple_candidate_versions_found';

export interface ScholarshipIdentity {
  scholarship_name: string;
  issuing_organization: string | null;
  government_department: string | null;
  notification_date: string | null;
  academic_year: string | null;
  scheme_id: string | null;
  keywords: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface OfficialSource {
  url: string;
  title: string;
  snippet: string;
  domain: string;
  is_official: boolean;
  authority_match: string | null;
  publication_date: string | null;
  academic_year: string | null;
  relevance_score: number;
  retrieval_status: string;
  content_preview: string;
}

export interface FreshnessCheckResult {
  status: FreshnessStatus;
  scholarship: ScholarshipIdentity;
  sources: OfficialSource[];
  uploaded_year: string | null;
  candidate_latest_year: string | null;
  issuing_authority: string | null;
  official_source_url: string | null;
  verification_explanation: string;
  checked_at: string;
  search_provider: string;
  search_query_used: string;
  error: string | null;
}

export interface ComparisonField {
  field_name: string;
  uploaded_value: string;
  newer_value: string;
  change_type: 'changed' | 'added' | 'removed' | 'unchanged' | 'uncertain';
  evidence_uploaded: string;
  evidence_newer: string;
}

export interface FreshnessCompareResult {
  scholarship_name: string;
  uploaded_year: string | null;
  newer_year: string | null;
  source_url: string;
  source_title: string;
  comparisons: ComparisonField[];
  summary: string;
  disclaimer: string;
}

export interface FreshnessAnalyzeResult extends Analysis {
  source_url: string;
  source_document_version: string;
  analysis_source: 'updated_official_document';
}
