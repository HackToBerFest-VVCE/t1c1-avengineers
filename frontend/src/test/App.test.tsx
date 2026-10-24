import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';

const syntheticResult = {
  title: 'Fictional Riverbend Grant', provider: 'Fictional Trust',
  summary_en: 'Example explanation.', summary_kn: 'ಉದಾಹರಣೆ ವಿವರಣೆ.',
  deadline: { date_text: '15 December 2026', iso_date: '2026-12-15', evidence: '15 December 2026', page: 1 },
  criteria: [], documents: [{ name: 'Marksheet', evidence: 'marksheet', page: 1 }],
  steps: [], unknowns: [], warnings: [], confidence: 'medium',
  model_used: 'gemma-4-26b-a4b-it', pages_analyzed: 1,
  processing_seconds: 1.4, request_id: 'abc123', filename: 'DEMO_Riverbend_Scholarship_2026.pdf',
  disclaimer: 'Verify against original notice.',
};

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:local-preview'),
    revokeObjectURL: vi.fn(),
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('FormBridge interface', () => {
  it('shows upload and explains missing API configuration', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 'ok', gemma_configured: false, model: 'gemma-4-26b-a4b-it' }),
    })));
    render(<App />);
    expect(screen.getByRole('heading', { name: /Every opportunity/i })).toBeInTheDocument();
    expect(screen.getByText('Analyze a scholarship notice')).toBeInTheDocument();
    expect(screen.getByText('Your clarity starts here')).toBeInTheDocument();
    expect(await screen.findByText(/Gemma is not configured yet/i)).toBeInTheDocument();
  });

  it('loads a fictional notice, sends it to backend, and displays the response', async () => {
    const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
      const path = String(request);
      if (path.includes('/api/health')) return { ok: true, json: async () => ({ status: 'ok', gemma_configured: true, model: 'gemma-4-26b-a4b-it' }) };
      if (path.includes('/samples/')) return { ok: true, blob: async () => new Blob(['%PDF-1.4 demo'], { type: 'application/pdf' }) };
      if (path.includes('/api/analyze')) return { ok: true, json: async () => syntheticResult };
      throw Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Scholarship PDF/i }));
    await screen.findByText(/DEMO_Riverbend_Scholarship_2026.pdf/);
    fireEvent.click(screen.getByRole('button', { name: /Analyze with Gemma 4/i }));
    await screen.findByText('Fictional Riverbend Grant');
    expect(screen.getByText('Example explanation.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Documents/i }));
    expect(screen.getByText('Marksheet')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/analyze', expect.objectContaining({ method: 'POST' })));
  });
});
