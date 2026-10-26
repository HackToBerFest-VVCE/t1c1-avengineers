import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import type { SourceFact } from '../lib/types';

vi.mock('../components/DocumentViewer', () => ({ default: ({ fact }: { fact: SourceFact | null }) => <aside data-testid="source-page">{fact?.page ?? 1}</aside> }));

const result = {
  title: 'Academic Test Scholarship', provider: 'Fictional Test Foundation',
  summary_en: 'This grant requires at least 75% marks.', summary_kn: 'ಈ ವಿದ್ಯಾರ್ಥಿವೇತನಕ್ಕೆ ಕನಿಷ್ಠ 75% ಅಂಕಗಳು ಅಗತ್ಯ.',
  summary_sources: [{ page: 2, evidence: 'Applicants must secure at least 75 percent.', verification: { status: 'verified', reason: 'Exact match' } }],
  criteria: [{ requirement: 'Academic marks requirement', requirement_kn: 'ಅಂಕಗಳ ಅರ್ಹತಾ ನಿಯಮ', evidence: 'Applicants must secure at least 75 percent.', page: 2,
    rule: { field: 'percentage', operator: 'gte', value_number: 75, values: [] }, student_value: 65, status: 'may_not_meet',
    explanation_en: 'Possible mismatch: 65 is below 75.', explanation_kn: 'ಸಂಭಾವ್ಯ ಅಸಾಮ್ಯ: 65 ಅಂಕಗಳು 75 ಕ್ಕಿಂತ ಕಡಿಮೆ.', verification: { status: 'verified', reason: 'Exact match' } }],
  documents: [{ name: 'Examination marksheet', name_kn: 'ಪರೀಕ್ಷೆಯ ಅಂಕಪಟ್ಟಿ', page: 2, evidence: 'An examination marksheet is required.' }],
  steps: [{ title: 'Prepare marksheet', title_kn: 'ಅಂಕಪಟ್ಟಿ ಸಿದ್ಧಪಡಿಸಿ', detail_en: 'Prepare the marksheet.', detail_kn: 'ಅಂಕಪಟ್ಟಿಯನ್ನು ಸಿದ್ಧಪಡಿಸಿ.' }],
  roadmap: [{ id: 'verify', title: 'Verify eligibility', title_kn: 'ಅರ್ಹತೆಯನ್ನು ಪರಿಶೀಲಿಸಿ', detail_en: 'Confirm the requirements.', detail_kn: 'ನಿಯಮಗಳನ್ನು ದೃಢಪಡಿಸಿ.', priority: 'critical', completed: false, page: null, evidence: null }],
  deadline: { date_text: null, iso_date: null, evidence: null, page: null }, warnings: ['Confirm with provider.'], warnings_kn: ['ಅಧಿಕೃತ ಸಂಸ್ಥೆಯೊಂದಿಗೆ ದೃಢಪಡಿಸಿ.'],
  unknowns: ['Deadline not specified.'], unknowns_kn: ['ಗಡುವನ್ನು ತಿಳಿಸಿಲ್ಲ.'], eligibility_overall: 'possible_mismatch',
  model_used: 'gemma-4-26b-a4b-it', confidence: 'medium', pages_analyzed: 2, processing_seconds: 1.5,
  session_id: 'same-document-session-identifier-123456789', request_id: 'same-request', filename: 'notice.pdf', disclaimer: 'Preliminary only.',
};

beforeEach(() => vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() })));
afterEach(() => vi.unstubAllGlobals());

function fetchFor(data: typeof result) {
  return vi.fn(async (request: RequestInfo | URL) => {
    const path = String(request);
    if (path.includes('/health')) return { ok: true, json: async () => ({ gemma_configured: true, model: 'gemma-4-26b-a4b-it' }) };
    if (path.endsWith('/api/analyze')) return { ok: true, json: async () => data };
    if (path.endsWith('/api/analysis/translate')) return { ok: true, json: async () => result };
    if (path.endsWith('/api/chat')) return { ok: true, json: async () => ({ answer: 'Keep this conversation.', suggestions: [], citations: [], missing_information: [], disclaimer: 'Verify.' }) };
    throw Error(`Unexpected request ${path}`);
  });
}

async function analyze() {
  render(<App/>);
  fireEvent.change(screen.getByLabelText('Choose a scholarship notice'), { target: { files: [new File(['PDF'], 'notice.pdf', { type: 'application/pdf' })] } });
  fireEvent.change(screen.getByLabelText('Previous marks (%)'), { target: { value: '65' } });
  fireEvent.click(screen.getByRole('button', { name: 'Analyze with Gemma 4' }));
  await screen.findByText(result.summary_en);
}

it('switches actual EN/KN summary, criteria and documents without reanalysis or loss of session', async () => {
  const fetchMock = fetchFor(result);
  vi.stubGlobal('fetch', fetchMock);
  await analyze();
  fireEvent.click(screen.getByRole('button', { name: /Page 2.*Applicants/ }));
  expect(screen.getByTestId('source-page')).toHaveTextContent('2');
  fireEvent.click(screen.getByRole('tab', { name: 'Assistant' }));
  fireEvent.change(screen.getByLabelText('Ask about this notice'), { target: { value: 'Why?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await screen.findByText('Keep this conversation.');
  fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
  fireEvent.click(screen.getByRole('button', { name: 'ಕನ್ನಡ' }));
  expect(screen.getByText(result.summary_kn)).toBeInTheDocument();
  expect(screen.getByTestId('source-page')).toHaveTextContent('2');
  fireEvent.click(screen.getByRole('tab', { name: 'ಅರ್ಹತೆ' }));
  expect(screen.getByText(result.criteria[0].requirement_kn)).toBeInTheDocument();
  expect(screen.getByText(result.criteria[0].explanation_kn)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'ದಾಖಲೆಗಳು' }));
  expect(screen.getByText(result.documents[0].name_kn)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'EN' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
  expect(screen.getByText(result.summary_en)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Assistant' }));
  expect(screen.getByText('Keep this conversation.')).toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([request]) => String(request).endsWith('/api/analyze'))).toHaveLength(1);
  expect(fetchMock.mock.calls.some(([request]) => String(request).includes('/delete'))).toBe(false);
});

it('offers targeted recovery for missing Kannada without changing the file, counts or chat', async () => {
  const incomplete = { ...result, summary_kn: '' };
  const fetchMock = fetchFor(incomplete);
  vi.stubGlobal('fetch', fetchMock);
  await analyze();
  fireEvent.click(screen.getByRole('tab', { name: 'Assistant' }));
  fireEvent.change(screen.getByLabelText('Ask about this notice'), { target: { value: 'Why?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await screen.findByText('Keep this conversation.');
  fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
  fireEvent.click(screen.getByRole('button', { name: 'ಕನ್ನಡ' }));
  expect(screen.getByText(/ಕನ್ನಡ ಅನುವಾದ ಲಭ್ಯವಿಲ್ಲ; ಮೂಲ ಭಾಷೆಯ ಪಠ್ಯ/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'ಅನುವಾದವನ್ನು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' }));
  expect(await screen.findByText(result.summary_kn)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'EN' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Assistant' }));
  expect(screen.getByText('Keep this conversation.')).toBeInTheDocument();
  expect(screen.getByLabelText('Previous marks (%)')).toHaveValue(65);
  expect(screen.getByText('notice.pdf', { selector: '.file-selected-info strong' })).toBeInTheDocument();
  await waitFor(() => expect(fetchMock.mock.calls.filter(([request]) => String(request).endsWith('/api/analyze'))).toHaveLength(1));
  expect(fetchMock.mock.calls.filter(([request]) => String(request).includes('/api/analysis/translate'))).toHaveLength(1);
});
