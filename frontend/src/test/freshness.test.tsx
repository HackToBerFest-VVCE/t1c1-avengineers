/**
 * Scholarship Freshness Intelligence — Frontend Tests
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FreshnessIntelligence from '../components/FreshnessIntelligence';
import type { Analysis, Language } from '../lib/types';

// Mock the api module
vi.mock('../lib/api', () => ({
  API_BASE: '',
  checkFreshness: vi.fn(),
  compareFreshness: vi.fn(),
  analyzeLatest: vi.fn(),
}));

const mockAnalysis: Analysis = {
  title: 'Ishan Uday Scholarship',
  provider: 'UGC',
  summary_en: 'Scholarship for NER students',
  summary_kn: 'NER ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ವಿದ್ಯಾರ್ಥಿವೇತನ',
  summary_sources: [],
  session_id: 'a'.repeat(32),
  session_expires_in: 1200,
  roadmap: [],
  deadline: { date_text: null, iso_date: null, evidence: null, page: null },
  criteria: [],
  eligibility_overall: 'needs_verification',
  documents: [],
  steps: [],
  unknowns: [],
  warnings: [],
  unknowns_kn: [],
  warnings_kn: [],
  confidence: 'medium',
  model_used: 'gemma-4-26b-a4b-it',
  pages_analyzed: 1,
  processing_seconds: 5.0,
  request_id: 'test-123',
  filename: 'ishan-uday.pdf',
  disclaimer: 'AI guidance only.',
};

describe('FreshnessIntelligence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the check button initially', () => {
    render(
      <FreshnessIntelligence
        analysis={mockAnalysis}
        language={'en' as Language}
        onAnalysisUpdate={() => {}}
      />
    );
    expect(screen.getByText('Check for Latest Guidelines')).toBeTruthy();
  });

  it('shows the freshness intelligence header', () => {
    render(
      <FreshnessIntelligence
        analysis={mockAnalysis}
        language={'en' as Language}
        onAnalysisUpdate={() => {}}
      />
    );
    expect(screen.getByText('Scholarship Freshness Intelligence')).toBeTruthy();
  });

  it('shows LangChain + Gemma subtitle', () => {
    render(
      <FreshnessIntelligence
        analysis={mockAnalysis}
        language={'en' as Language}
        onAnalysisUpdate={() => {}}
      />
    );
    expect(screen.getByText('Powered by LangChain + Google Gemma 4')).toBeTruthy();
  });

  it('shows loading state when checking', async () => {
    const { checkFreshness } = await import('../lib/api');
    (checkFreshness as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // Never resolves — stays loading
    );

    render(
      <FreshnessIntelligence
        analysis={mockAnalysis}
        language={'en' as Language}
        onAnalysisUpdate={() => {}}
      />
    );

    const button = screen.getByText('Check for Latest Guidelines');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Searching for latest scholarship guidelines…')).toBeTruthy();
    });
  });

  it('shows error when check fails', async () => {
    const { checkFreshness } = await import('../lib/api');
    (checkFreshness as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Tavily API key not configured.')
    );

    render(
      <FreshnessIntelligence
        analysis={mockAnalysis}
        language={'en' as Language}
        onAnalysisUpdate={() => {}}
      />
    );

    fireEvent.click(screen.getByText('Check for Latest Guidelines'));

    await waitFor(() => {
      expect(screen.getByText('Tavily API key not configured.')).toBeTruthy();
    });
  });

  it('renders in Kannada mode', () => {
    render(
      <FreshnessIntelligence
        analysis={mockAnalysis}
        language={'kn' as Language}
        onAnalysisUpdate={() => {}}
      />
    );
    expect(screen.getByText('ವಿದ್ಯಾರ್ಥಿವೇತನ ತಾಜಾತನ ಬುದ್ಧಿಮತ್ತೆ')).toBeTruthy();
    expect(screen.getByText('ಇತ್ತೀಚಿನ ಮಾರ್ಗಸೂಚಿಗಳನ್ನು ಪರಿಶೀಲಿಸಿ')).toBeTruthy();
  });

  it('shows results when check succeeds', async () => {
    const { checkFreshness } = await import('../lib/api');
    (checkFreshness as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'newer_official_version_found',
      scholarship: { scholarship_name: 'Ishan Uday', confidence: 'high', keywords: [] },
      sources: [{
        url: 'https://ugc.gov.in/ishan-uday',
        title: 'Ishan Uday 2025-26',
        snippet: 'Latest guidelines',
        domain: 'ugc.gov.in',
        is_official: true,
        authority_match: '.gov.in',
        academic_year: '2025-26',
        relevance_score: 0.85,
        retrieval_status: 'available',
        content_preview: 'Latest guidelines for Ishan Uday',
      }],
      uploaded_year: '2023-24',
      candidate_latest_year: '2025-26',
      issuing_authority: 'UGC',
      official_source_url: 'https://ugc.gov.in/ishan-uday',
      verification_explanation: 'A newer version was found.',
      checked_at: new Date().toISOString(),
      search_provider: 'tavily',
      search_query_used: 'Ishan Uday scholarship',
      error: null,
    });

    render(
      <FreshnessIntelligence
        analysis={mockAnalysis}
        language={'en' as Language}
        onAnalysisUpdate={() => {}}
      />
    );

    fireEvent.click(screen.getByText('Check for Latest Guidelines'));

    await waitFor(() => {
      expect(screen.getByText('Newer Official Version Found')).toBeTruthy();
    });

    // Verify year and source link are shown
    expect(screen.getByText('View Official Source')).toBeTruthy();
    expect(screen.getByText('Compare Versions')).toBeTruthy();
  });
});
