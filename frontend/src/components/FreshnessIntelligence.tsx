/**
 * Scholarship Freshness Intelligence Component
 *
 * Powered by LangChain + Google Gemma 4
 *
 * Identifies outdated scholarship notifications, discovers newer official versions,
 * compares important changes, and enables students to analyze the latest verified
 * scholarship guidelines.
 */
import { useState } from 'react';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock3,
  ExternalLink, FileSearch2, Globe, Info, LinkIcon, LoaderCircle,
  RefreshCw, SearchCheck, Shield, ShieldCheck, Sparkles, X, Zap,
} from 'lucide-react';
import { checkFreshness, compareFreshness, analyzeLatest } from '../lib/api';
import { t, friendlyError } from '../lib/i18n';
import type {
  Analysis, FreshnessCheckResult, FreshnessCompareResult,
  FreshnessStatus, Language, OfficialSource,
} from '../lib/types';

interface Props {
  analysis: Analysis;
  language: Language;
  onAnalysisUpdate: (updated: Partial<Analysis> & Record<string, unknown>) => void;
}

const STATUS_CONFIG: Record<FreshnessStatus, {
  icon: typeof CheckCircle2;
  label: string;
  tone: string;
}> = {
  newer_official_version_found: {
    icon: AlertTriangle,
    label: 'Newer Official Version Found',
    tone: 'freshness-newer',
  },
  uploaded_document_appears_current: {
    icon: CheckCircle2,
    label: 'Uploaded Document Appears Current',
    tone: 'freshness-current',
  },
  no_newer_version_verified: {
    icon: Info,
    label: 'No Newer Version Verified',
    tone: 'freshness-none',
  },
  unable_to_verify_freshness: {
    icon: AlertTriangle,
    label: 'Unable to Verify Freshness',
    tone: 'freshness-unable',
  },
  multiple_candidate_versions_found: {
    icon: FileSearch2,
    label: 'Multiple Candidate Versions Found',
    tone: 'freshness-multiple',
  },
};

function FreshnessBadge({ status }: { status: FreshnessStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={`freshness-badge ${config.tone}`}>
      <Icon size={14} />
      <span>{config.label}</span>
    </span>
  );
}

export default function FreshnessIntelligence({ analysis, language, onAnalysisUpdate }: Props) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<FreshnessCheckResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<FreshnessCompareResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [compareError, setCompareError] = useState('');
  const [analyzeError, setAnalyzeError] = useState('');

  const handleCheck = async () => {
    setChecking(true);
    setError('');
    setResult(null);
    setComparison(null);
    try {
      const res = await checkFreshness(analysis.session_id);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check for updates.');
    } finally {
      setChecking(false);
    }
  };

  const handleCompare = async (sourceUrl: string) => {
    setComparing(true);
    setCompareError('');
    try {
      const res = await compareFreshness(analysis.session_id, sourceUrl);
      setComparison(res);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Unable to compare versions.');
    } finally {
      setComparing(false);
    }
  };

  const handleAnalyzeLatest = async (sourceUrl: string) => {
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const res = await analyzeLatest(analysis.session_id, sourceUrl);
      onAnalysisUpdate(res);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Unable to analyze updated document.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="freshness-section">
      <div className="freshness-header">
        <div className="freshness-title-row">
          <div className="freshness-icon-wrap">
            <SearchCheck size={20} />
          </div>
          <div>
            <h4>{t(language, 'Scholarship Freshness Intelligence')}</h4>
            <span className="freshness-subtitle">
              <Sparkles size={12} />
              {t(language, 'Powered by LangChain + Google Gemma 4')}
            </span>
          </div>
        </div>
        {!result && !checking && (
          <button className="freshness-check-btn" onClick={() => void handleCheck()} disabled={checking}>
            <Globe size={16} />
            <span>{t(language, 'Check for Latest Guidelines')}</span>
            <ArrowRight size={15} />
          </button>
        )}
        {result && !checking && (
          <button className="freshness-recheck-btn" onClick={() => void handleCheck()} disabled={checking} title="Re-check">
            <RefreshCw size={15} />
          </button>
        )}
      </div>

      {checking && (
        <div className="freshness-loading" role="status">
          <LoaderCircle className="spinning" size={20} />
          <div>
            <strong>{t(language, 'Searching for latest scholarship guidelines…')}</strong>
            <small>{t(language, 'Using LangChain to search official sources and Gemma 4 to identify the scholarship.')}</small>
          </div>
        </div>
      )}

      {error && (
        <div className="freshness-error">
          <AlertTriangle size={16} />
          <span>{friendlyError(language, error)}</span>
          <button onClick={() => void handleCheck()}>{t(language, 'Retry')}</button>
          <button onClick={() => setError('')} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      {result && !checking && (
        <div className="freshness-result">
          {/* Status card */}
          <div className={`freshness-status-card ${STATUS_CONFIG[result.status].tone}`}>
            <div className="freshness-status-header">
              <FreshnessBadge status={result.status} />
              <span className="freshness-timestamp">
                <Clock3 size={12} />
                {new Date(result.checked_at).toLocaleString()}
              </span>
            </div>

            <div className="freshness-details-grid">
              <div className="freshness-detail">
                <label>{t(language, 'Scholarship')}</label>
                <span>{result.scholarship.scholarship_name || analysis.title}</span>
              </div>
              {result.uploaded_year && (
                <div className="freshness-detail">
                  <label>{t(language, 'Uploaded Document Year')}</label>
                  <span>{result.uploaded_year}</span>
                </div>
              )}
              {result.candidate_latest_year && (
                <div className="freshness-detail">
                  <label>{t(language, 'Latest Available Year')}</label>
                  <span className="freshness-year-highlight">{result.candidate_latest_year}</span>
                </div>
              )}
              {result.issuing_authority && (
                <div className="freshness-detail">
                  <label>{t(language, 'Issuing Authority')}</label>
                  <span>{result.issuing_authority}</span>
                </div>
              )}
              {result.search_provider && (
                <div className="freshness-detail">
                  <label>{t(language, 'Search Provider')}</label>
                  <span className="freshness-provider-pill">
                    <Zap size={11} />
                    {result.search_provider}
                  </span>
                </div>
              )}
            </div>

            <p className="freshness-explanation">{result.verification_explanation}</p>

            {result.official_source_url && (
              <a
                href={result.official_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="freshness-source-link"
              >
                <Shield size={14} />
                <span>{t(language, 'View Official Source')}</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>

          {/* Sources list */}
          {result.sources.length > 0 && (
            <div className="freshness-sources">
              <h5>
                <Globe size={15} />
                {t(language, 'Discovered Sources')} ({result.sources.length})
              </h5>
              <div className="freshness-sources-list">
                {result.sources.map((source, i) => (
                  <SourceCard
                    key={i}
                    source={source}
                    language={language}
                    onCompare={
                      (result.status === 'newer_official_version_found' ||
                       result.status === 'multiple_candidate_versions_found') &&
                      !comparison
                        ? () => void handleCompare(source.url)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Comparison loading */}
          {comparing && (
            <div className="freshness-loading" role="status">
              <LoaderCircle className="spinning" size={20} />
              <div>
                <strong>{t(language, 'Comparing scholarship versions…')}</strong>
                <small>{t(language, 'Gemma 4 is analyzing differences between the uploaded and newer document.')}</small>
              </div>
            </div>
          )}
          {compareError && (
            <div className="freshness-error">
              <AlertTriangle size={16} />
              <span>{friendlyError(language, compareError)}</span>
              <button onClick={() => setCompareError('')} aria-label="Dismiss"><X size={14} /></button>
            </div>
          )}

          {/* Comparison result */}
          {comparison && (
            <ComparisonTable
              comparison={comparison}
              language={language}
              onAnalyze={() => void handleAnalyzeLatest(comparison.source_url)}
              analyzing={analyzing}
              analyzeError={analyzeError}
            />
          )}
        </div>
      )}
    </div>
  );
}


function SourceCard({
  source,
  language,
  onCompare,
}: {
  source: OfficialSource;
  language: Language;
  onCompare?: () => void;
}) {
  return (
    <div className={`freshness-source-card${source.is_official ? ' official' : ''}`}>
      <div className="source-card-header">
        {source.is_official && (
          <span className="source-official-badge">
            <ShieldCheck size={12} />
            {t(language, 'Official')}
          </span>
        )}
        <span className="source-domain">{source.domain}</span>
        {source.academic_year && (
          <span className="source-year">{source.academic_year}</span>
        )}
        <span className="source-relevance" title="Relevance score">
          {Math.round(source.relevance_score * 100)}%
        </span>
      </div>
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="source-card-title">
        {source.title || source.url}
        <ExternalLink size={12} />
      </a>
      {source.snippet && (
        <p className="source-card-snippet">{source.snippet.slice(0, 200)}</p>
      )}
      {onCompare && (
        <button className="source-compare-btn" onClick={onCompare}>
          <FileSearch2 size={14} />
          {t(language, 'Compare Versions')}
        </button>
      )}
    </div>
  );
}


function ComparisonTable({
  comparison,
  language,
  onAnalyze,
  analyzing,
  analyzeError,
}: {
  comparison: FreshnessCompareResult;
  language: Language;
  onAnalyze: () => void;
  analyzing: boolean;
  analyzeError: string;
}) {
  const changes = comparison.comparisons.filter(c => c.change_type !== 'unchanged');
  const unchanged = comparison.comparisons.filter(c => c.change_type === 'unchanged');

  return (
    <div className="freshness-comparison">
      <div className="comparison-header">
        <h5>
          <FileSearch2 size={15} />
          {t(language, 'Version Comparison')}
        </h5>
        <div className="comparison-versions">
          <span className="version-tag uploaded">
            {t(language, 'Uploaded')}: {comparison.uploaded_year || '?'}
          </span>
          <ArrowRight size={14} />
          <span className="version-tag newer">
            {t(language, 'Newer')}: {comparison.newer_year || '?'}
          </span>
        </div>
      </div>

      {comparison.summary && (
        <div className="comparison-summary">
          <Info size={15} />
          <p>{comparison.summary}</p>
        </div>
      )}

      {changes.length > 0 && (
        <div className="comparison-table-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>{t(language, 'Field')}</th>
                <th>{t(language, 'Uploaded Version')}</th>
                <th>{t(language, 'Newer Version')}</th>
                <th>{t(language, 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((field, i) => (
                <tr key={i} className={`comparison-row ${field.change_type}`}>
                  <td className="comparison-field-name">{field.field_name}</td>
                  <td>
                    <span>{field.uploaded_value || '—'}</span>
                    {field.evidence_uploaded && (
                      <small className="comparison-evidence" title={field.evidence_uploaded}>
                        <LinkIcon size={10} /> {t(language, 'Evidence')}
                      </small>
                    )}
                  </td>
                  <td>
                    <span>{field.newer_value || '—'}</span>
                    {field.evidence_newer && (
                      <small className="comparison-evidence" title={field.evidence_newer}>
                        <LinkIcon size={10} /> {t(language, 'Evidence')}
                      </small>
                    )}
                  </td>
                  <td>
                    <span className={`change-badge ${field.change_type}`}>
                      {field.change_type === 'changed' ? '⟳ Changed' :
                       field.change_type === 'added' ? '+ Added' :
                       field.change_type === 'removed' ? '− Removed' :
                       '? Uncertain'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unchanged.length > 0 && (
        <details className="comparison-unchanged">
          <summary>{unchanged.length} {t(language, 'unchanged fields')}</summary>
          <ul>
            {unchanged.map((f, i) => (
              <li key={i}><strong>{f.field_name}:</strong> {f.uploaded_value || '—'}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="comparison-disclaimer">
        <ShieldCheck size={14} />
        <span>{comparison.disclaimer}</span>
      </div>

      {/* Analyze Updated Scholarship button */}
      <div className="freshness-analyze-action">
        <button
          className="freshness-analyze-btn"
          onClick={onAnalyze}
          disabled={analyzing}
        >
          {analyzing ? (
            <>
              <LoaderCircle className="spinning" size={17} />
              {t(language, 'Analyzing Updated Scholarship…')}
            </>
          ) : (
            <>
              <Sparkles size={17} />
              {t(language, 'Analyze Updated Scholarship')}
              <ArrowRight size={15} />
            </>
          )}
        </button>
        <small>
          {t(language, 'Process the newer verified document through the FormBridge AI analysis pipeline.')}
        </small>
      </div>

      {analyzeError && (
        <div className="freshness-error">
          <AlertTriangle size={16} />
          <span>{friendlyError(language, analyzeError)}</span>
          <button onClick={() => {}} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
