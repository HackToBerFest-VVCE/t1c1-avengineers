import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DocumentViewer from '../components/DocumentViewer';
import SourceTag, { EvidenceContext } from '../components/SourceTag';
import EligibilitySummary from '../components/EligibilitySummary';
import ScholarshipChat from '../components/ScholarshipChat';
import ApplicationRoadmap from '../components/ApplicationRoadmap';
import type { Criterion, RoadmapTask } from '../lib/types';

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ children, onLoadSuccess }: { children: ReactNode; onLoadSuccess: (p: { numPages: number }) => void }) => {
    useEffect(() => { void Promise.resolve().then(() => onLoadSuccess({ numPages: 3 })); }, []);
    return <div>{children}</div>;
  },
  Page: ({ pageNumber }: { pageNumber: number }) => <div data-testid="pdf-page">Rendered page {pageNumber}</div>,
}));

describe('Evidence and eligibility', () => {
  it('opens the evidence callback and does not imply verification without a result', () => {
    const open = vi.fn();
    render(<EvidenceContext.Provider value={{ language: 'en', open }}><SourceTag evidence="Exact source quotation" page={2}/></EvidenceContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: /Page 2/ }));
    expect(open).toHaveBeenCalledWith({ evidence: 'Exact source quotation', page: 2 });
    expect(screen.getByText('Text verification unavailable')).toBeInTheDocument();
  });
  it('navigates PDF pages, citations and zoom', async () => {
    const view = render(<DocumentViewer url="blob:test" isPdf language="en" fact={{ page: 2, evidence: 'Example quotation' }} close={() => {}}/>);
    await waitFor(() => expect(screen.getByLabelText('Page')).toHaveValue(2));
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('Rendered page 3');
    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('Rendered page 2');
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(screen.getByText('125%')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Fit to width'));
    expect(screen.getByText('100%')).toBeInTheDocument();
    view.rerender(<DocumentViewer url="blob:test" isPdf language="en" fact={{ page: 1, evidence: 'A new quote' }} close={() => {}}/>);
    expect(screen.getByLabelText('Page')).toHaveValue(1);
  });
  it('counts each conservative outcome', () => {
    const criteria = ['likely_meets', 'may_not_meet', 'needs_review', 'needs_review'].map(status => ({ status } as Criterion));
    render(<EligibilitySummary criteria={criteria} language="en"/>);
    expect(screen.getByText('Needs verification').previousSibling).toHaveTextContent('2');
    expect(screen.getByText('Satisfied').previousSibling).toHaveTextContent('1');
  });
});

it('sends a Kannada question, shows citations, and resets the server conversation', async () => {
  const fetchMock = vi.fn(async (_request: RequestInfo | URL, _init?: RequestInit) => ({ ok: true, json: async () => ({ answer: 'ದಾಖಲೆ ಪರಿಶೀಲಿಸಿ.', suggestions: [], missing_information: [], citations: [{ page: 1, evidence: 'Income certificate', verification: { status: 'verified' } }], disclaimer: 'Confirm with provider.' }) }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ScholarshipChat sessionId={'a'.repeat(43)} language="kn"/>);
  fireEvent.change(screen.getByLabelText('ಈ ಪ್ರಕಟಣೆಯ ಬಗ್ಗೆ ಕೇಳಿ'), { target: { value: 'ಏಕೆ?' } });
  fireEvent.click(screen.getByLabelText('ಪ್ರಶ್ನೆ ಕಳುಹಿಸಿ'));
  expect(await screen.findByText('ದಾಖಲೆ ಪರಿಶೀಲಿಸಿ.')).toBeInTheDocument();
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toMatchObject({ language: 'kn', question: 'ಏಕೆ?' });
  fireEvent.click(screen.getByLabelText('ಸಂಭಾಷಣೆ ಮರುಹೊಂದಿಸಿ'));
  await waitFor(() => expect(screen.queryByText('ದಾಖಲೆ ಪರಿಶೀಲಿಸಿ.')).not.toBeInTheDocument());
});

it('recovers from a chat failure without duplicating the question', async () => {
  let calls = 0;
  vi.stubGlobal('fetch', vi.fn(async () => ++calls === 1
    ? { ok: false, status: 502, json: async () => ({ detail: 'Gemma temporary failure' }) }
    : { ok: true, json: async () => ({ answer: 'Recovered', suggestions: [], missing_information: [], citations: [], disclaimer: 'Verify' }) }));
  render(<ScholarshipChat sessionId={'a'.repeat(43)} language="en"/>);
  fireEvent.change(screen.getByLabelText('Ask about this notice'), { target: { value: 'Why?' } });
  fireEvent.click(screen.getByLabelText('Send question'));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Recovered')).toBeInTheDocument();
  expect(screen.getAllByText('Why?')).toHaveLength(1);
});

it('persists roadmap completion locally across tab remounts', () => {
  sessionStorage.clear();
  const tasks: RoadmapTask[] = [{ id: 'verify', title: 'Verify eligibility', title_kn: 'ಪರಿಶೀಲಿಸಿ', detail_en: 'Confirm with provider', detail_kn: 'ದೃಢಪಡಿಸಿ', priority: 'critical', completed: false, page: null, evidence: null }];
  const first = render(<ApplicationRoadmap tasks={tasks} sessionId="test-progress" language="en"/>);
  fireEvent.click(screen.getByLabelText('Verify eligibility'));
  expect(screen.getByLabelText('Verify eligibility')).toBeChecked();
  first.unmount();
  render(<ApplicationRoadmap tasks={tasks} sessionId="test-progress" language="en"/>);
  expect(screen.getByLabelText('Verify eligibility')).toBeChecked();
});
