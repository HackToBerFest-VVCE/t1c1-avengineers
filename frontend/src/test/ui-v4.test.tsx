import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';

vi.mock('../components/DocumentViewer', () => ({ default: () => <aside>Document viewer</aside> }));
const analysis = {
  title: 'Test Scholarship', provider: 'Test provider', summary_en: 'Grounded summary', summary_kn: 'ಸಾರಾಂಶ',
  deadline: { date_text: null, iso_date: null, evidence: null, page: null }, criteria: [],
  documents: [], steps: [], roadmap: [], summary_sources: [], unknowns: [], warnings: [],
  confidence: 'medium', session_id: 'test-session-identifier-long-enough-for-validation',
  filename: 'notice.png', model_used: 'gemma-4-26b-a4b-it', pages_analyzed: 1, processing_seconds: 1.2,
  request_id: 'request-test', disclaimer: 'Preliminary guidance.',
};

describe('V4 workspace interactions', () => {
  it('keeps every student field mapped to the original API properties', async () => {
    let submitted: Record<string, unknown> = {};
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }));
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      if (String(request).includes('/health')) return { ok: true, json: async () => ({ gemma_configured: true }) };
      submitted = JSON.parse((init?.body as FormData).get('profile') as string);
      return { ok: true, json: async () => analysis };
    }));
    render(<App/>);
    fireEvent.change(screen.getByLabelText('Choose a scholarship notice'), { target: { files: [new File(['png'], 'notice.png', { type: 'image/png' })] } });
    for (const [label, value] of [['Education level', 'Postgraduate'], ['State of residence', 'Karnataka'], ['Annual family income (₹)', '250000'], ['Previous marks (%)', '82.5'], ['Category', 'OBC'], ['Age', '22'], ['Study mode', 'Full-time']]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Analyze with Gemma 4' }));
    await screen.findByText('Test Scholarship');
    expect(submitted).toEqual({ education_level: 'Postgraduate', state: 'Karnataka', annual_income: 250000, percentage: 82.5, category: 'OBC', age: 22, study_mode: 'Full-time' });
    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Eligibility' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Eligibility' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Scholarship assistant' }));
    expect(screen.getByRole('tab', { name: 'Assistant' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('link', { name: 'Application roadmap' }));
    expect(screen.getByRole('tab', { name: 'Action plan' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens and closes the mobile drawer with Escape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ gemma_configured: false }) })));
    render(<App/>);
    const open = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(open);
    expect(open).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Workspace navigation' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(open).toHaveAttribute('aria-expanded', 'false'));
  });

  it('offers a replacement action without losing the selected file', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ gemma_configured: true }) })));
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }));
    render(<App/>);
    fireEvent.change(screen.getByLabelText('Choose a scholarship notice'), { target: { files: [new File(['png'], 'notice.png', { type: 'image/png' })] } });
    expect(screen.getByRole('button', { name: 'Replace document' })).toBeEnabled();
    expect(screen.getByAltText('Selected scholarship notice')).toHaveAttribute('src', 'blob:preview');
  });
});
