import type { Analysis, Health, Profile, ChatAnswer, Language } from './types';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

async function errorMessage(res: Response): Promise<string> {
  try {
    const body: { detail?: unknown } = await res.json();
    return typeof body.detail === 'string' ? body.detail : `Request failed with status ${res.status}.`;
  } catch { return `Request failed with status ${res.status}.`; }
}

export async function healthCheck(): Promise<Health> {
  const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw Error(await errorMessage(res));
  return await res.json() as Health;
}

export async function analyzeDocument(file: File, profile: Profile): Promise<Analysis> {
  const form = new FormData();
  form.append('file', file);
  form.append('profile', JSON.stringify({
    education_level: profile.education_level,
    state: profile.state,
    category: profile.category,
    annual_income: profile.annual_income === '' ? null : Number(profile.annual_income),
    percentage: profile.percentage === '' ? null : Number(profile.percentage),
    age: profile.age === '' ? null : Number(profile.age),
    study_mode: profile.study_mode,
  }));
  // Let the browser set multipart boundaries; never set Content-Type manually.
  const res = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: form });
  if (!res.ok) throw Error(await errorMessage(res));
  return await res.json() as Analysis;
}

async function sessionPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw Error(await errorMessage(res));
  return await res.json() as T;
}
export const askScholarship = (session_id: string, question: string, language: Language) =>
  sessionPost<ChatAnswer>('/api/chat', { session_id, question, language });
export const resetChat = (session_id: string) => sessionPost('/api/chat/reset', { session_id });
export const deleteSession = (session_id: string) => sessionPost('/api/session/delete', { session_id });

export async function loadSampleFile(name: string): Promise<File> {
  const filename = name === 'pdf'
    ? 'DEMO_Riverbend_Scholarship_2026.pdf'
    : 'DEMO_City_Learners_Award.png';
  const response = await fetch(`/samples/${filename}`);
  if (!response.ok) throw Error('Could not load sample file.');
  const blob = await response.blob();
  return new File([blob], filename, {
    type: name === 'pdf' ? 'application/pdf' : 'image/png',
  });
}
