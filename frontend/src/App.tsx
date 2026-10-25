import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import {
  ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check,
  CheckCircle2, ChevronRight, CircleHelp, ClipboardCheck, Clock3,
  CloudUpload, Download, ExternalLink, FileImage,
  FileSearch2, FileText, FolderOpen, GraduationCap, Info, Languages,
  Layers3, LoaderCircle, LockKeyhole, Menu, RotateCcw, ScanLine,
  ShieldCheck, Sparkles, UploadCloud, WandSparkles, X, AlertTriangle,
} from 'lucide-react';
import { analyzeDocument, deleteSession, healthCheck, loadSampleFile } from './lib/api';
import type { Analysis, Health, Profile, SourceFact } from './lib/types';
import SourceTag, { EvidenceContext } from './components/SourceTag';
import EligibilitySummary from './components/EligibilitySummary';
import ScholarshipChat from './components/ScholarshipChat';
import ApplicationRoadmap from './components/ApplicationRoadmap';
import { friendlyError, t } from './lib/i18n';
const DocumentViewer = lazy(() => import('./components/DocumentViewer'));

type Tab = 'overview' | 'eligibility' | 'documents' | 'roadmap' | 'assistant';
type Language = 'en' | 'kn';

const startProfile: Profile = {
  education_level: 'Not specified', state: 'Not specified', category: 'Not specified',
  annual_income: '', percentage: '', age: '', study_mode: 'Not specified',
};
const maximumSize = 8 * 1024 * 1024;

function BrandIcon({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand-icon${small ? ' small' : ''}`} aria-hidden="true">
      <span className="brand-page brand-page-one" />
      <span className="brand-page brand-page-two" />
      <span className="brand-bolt">✦</span>
    </div>
  );
}

function Pill({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'likely_meets') return <CheckCircle2 size={18} />;
  if (status === 'may_not_meet') return <AlertTriangle size={18} />;
  return <CircleHelp size={18} />;
}

function StatusCard({ health }: { health: Health | null }) {
  return (
    <div className="connection-card">
      <span className={`connection-dot ${health?.gemma_configured ? 'online' : 'offline'}`} />
      <div>
        <strong>{!health ? 'Checking backend' : health.gemma_configured ? 'Gemma 4 ready' : 'API key required'}</strong>
        <span>{health?.model ?? 'gemma-4-26b-a4b-it'}</span>
      </div>
    </div>
  );
}

function Field({ label, id, children, hint }: { label: string; id: string; children: ReactNode; hint?: string }) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

function prettySize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function exportChecklist(analysis: Analysis) {
  const lines = [
    `FORMBRIDGE AI — ${analysis.title}`,
    `Source: ${analysis.filename}`,
    'AI guidance only. Verify details with the original notice.', '',
    'DOCUMENT CHECKLIST',
    ...analysis.documents.map((doc, index) => `[ ] ${index + 1}. ${doc.name}${doc.page ? ` (page ${doc.page})` : ''}`),
    '', 'NEXT STEPS',
    ...analysis.steps.map((step, index) => `${index + 1}. ${step.title}: ${step.detail_en}`),
    '', 'QUESTIONS TO VERIFY', ...analysis.unknowns.map(x => `- ${x}`),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'FormBridge-Checklist.txt';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [profile, setProfile] = useState<Profile>(startProfile);
  const [language, setLanguage] = useState<Language>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [doneDocuments, setDoneDocuments] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [evidence, setEvidence] = useState<SourceFact | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    healthCheck().then(setHealth).catch(() => setHealthError(true));
  }, []);
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const chooseFile = (selected: File | undefined) => {
    if (loading) return;
    if (!selected) return;
    if (selected.size > maximumSize) { setError('This file exceeds the 8 MB limit.'); return; }
    const supported = ['application/pdf', 'image/jpeg', 'image/png'].includes(selected.type)
      || /\.(pdf|jpe?g|png)$/i.test(selected.name);
    if (!supported) { setError('Please choose a PDF, JPG, or PNG file.'); return; }
    setFile(selected);
    if (analysis?.session_id) void deleteSession(analysis.session_id).catch(() => {});
    setAnalysis(null);
    setDoneDocuments([]);
    setError('');
    setTab('overview');
    setViewerOpen(false); setEvidence(null);
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setIsDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  };
  const loadExample = async (kind: 'pdf' | 'image') => {
    setError('');
    try { chooseFile(await loadSampleFile(kind)); }
    catch { setError('The sample could not be loaded. Check that the development server is running.'); }
  };
  const setField = (field: keyof Profile, value: string) =>
    !loading && setProfile(p => ({ ...p, [field]: value }));
  const submit = async () => {
    if (!file) { setError('Upload a notice or choose a sample first.'); return; }
    if (profile.percentage !== '' && !(Number(profile.percentage) >= 0 && Number(profile.percentage) <= 100)) {
      setError('Marks percentage must be between 0 and 100.'); return;
    }
    if (profile.annual_income !== '' && Number(profile.annual_income) < 0) {
      setError('Annual income cannot be negative.'); return;
    }
    if (profile.age !== '' && (!Number.isInteger(Number(profile.age)) || Number(profile.age) < 0 || Number(profile.age) > 120)) {
      setError('Age must be a whole number between 0 and 120.'); return;
    }
    if (analysis?.session_id) void deleteSession(analysis.session_id).catch(() => {});
    setError(''); setLoading(true); setAnalysis(null); setEvidence(null);
    try {
      const result = await analyzeDocument(file, profile);
      setAnalysis(result);
      setViewerOpen(true);
      setDoneDocuments([]);
      setTab('overview');
      setHealth(h => h ? { ...h, gemma_configured: true } : h);
      window.setTimeout(() => resultsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze this document.');
    } finally { setLoading(false); }
  };
  const reset = () => {
    if (loading) return;
    if (analysis?.session_id) void deleteSession(analysis.session_id).catch(() => {});
    setFile(null); setError(''); setAnalysis(null);
    setViewerOpen(false); setEvidence(null);
    setDoneDocuments([]); setTab('overview');
    if (fileInput.current) fileInput.current.value = '';
  };
  const toggleDone = (name: string) => setDoneDocuments(existing =>
    existing.includes(name) ? existing.filter(x => x !== name) : [...existing, name]);

  return (
    <EvidenceContext.Provider value={{ language, open: fact => { setEvidence({ ...fact }); setViewerOpen(true); } }}>
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? ' visible' : ''}`}>
        <div className="sidebar-top">
          <a className="brand-row" href="#home" onClick={() => setSidebarOpen(false)}>
            <BrandIcon />
            <span className="brand-name">formbridge<span className="brand-dot">.</span><small>AI</small></span>
          </a>
          <div className="sidebar-overline">YOUR WORKSPACE</div>
          <nav className="side-nav" aria-label="Main navigation">
            <a className="side-link selected" href="#workspace" onClick={() => setSidebarOpen(false)}><Layers3 size={18} /> Dashboard <span className="side-selected-dot" /></a>
            <a className="side-link" href="#analyzer" onClick={() => setSidebarOpen(false)}><ScanLine size={18} /> Document analyzer</a>
            <a className="side-link" href="#results" onClick={() => setSidebarOpen(false)}><ClipboardCheck size={18} /> Your results</a>
          </nav>
          <div className="sidebar-overline tools-label">EXPLORE</div>
          <nav className="side-nav" aria-label="Information navigation">
            <a className="side-link" href="#how-it-works" onClick={() => setSidebarOpen(false)}><BookOpen size={18} /> How it works</a>
            <a className="side-link" href="https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api" target="_blank" rel="noopener noreferrer"><ExternalLink size={17} /> Gemma documentation</a>
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="hackathon-card">
            <div className="challenge-icon"><Sparkles size={20} /></div>
            <span className="hack-overline">HACKTOBERFEST 2026</span>
            <strong>Built for better access.</strong>
            <p>Track 1 · Best Use of Gemma 4</p>
            <div className="hack-by">Crafted by <b>Avengineers</b></div>
          </div>
          <div className="sidebar-footer"><ShieldCheck size={15} /> Temporary processing <span className="footer-version">v3.0</span></div>
        </div>
      </aside>

      <div className="main-column" id="home">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-btn" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <span className="breadcrumb">Workspace</span><ChevronRight size={15} className="breadcrumb-arrow" /><span className="breadcrumb-current">Dashboard</span>
          </div>
          <div className="topbar-right">
            <span className="language-switch" aria-label={t(language, 'Output language')}><button aria-pressed={language === 'en'} className={language === 'en' ? 'current' : ''} onClick={() => setLanguage('en')}>EN</button><button aria-pressed={language === 'kn'} className={language === 'kn' ? 'current' : ''} onClick={() => setLanguage('kn')}>ಕನ್ನಡ</button></span>
            <span className="model-chip"><span className="cyan-point" /> Powered by <b>Gemma 4</b></span>
            <span className="top-avatar" title="Avengineers">A</span>
          </div>
        </header>

        <main className="page-content" id="workspace">
          <section className="hero" aria-label="Introduction">
            <div className="hero-content">
              <span className="eyebrow"><Sparkles size={14} /> AI-POWERED SCHOLARSHIP INTELLIGENCE</span>
              <h1>Every opportunity,<br /><em>understood.</em></h1>
              <p>From complex scholarship notices to clear next steps. Upload a document and let Gemma 4 make sense of the details — in your language.</p>
              <a href="#analyzer" className="hero-cta">Start analyzing <ArrowUpRight size={17} /></a>
            </div>
            <div className="hero-art" aria-hidden="true">
              <span className="hero-orbit orbit-a" /><span className="hero-orbit orbit-b" />
              <div className="floating-paper paper-back"><div /><div /><div /></div>
              <div className="floating-paper paper-front">
                <div className="paper-icon"><FileSearch2 size={26} /></div>
                <div className="paper-line long" /><div className="paper-line medium" />
                <div className="paper-line short" />
                <div className="paper-check"><Check size={17} /></div>
              </div>
              <span className="art-glow" />
              <span className="art-star star-a">✦</span><span className="art-star star-b">✧</span>
            </div>
          </section>

          <div className="stats-strip" aria-label="Core abilities">
            <div><div className="stat-icon turquoise"><FileSearch2 size={19} /></div><span><strong>Document intelligence</strong><small>Image + PDF understanding</small></span></div>
            <div><div className="stat-icon blue"><Languages size={19} /></div><span><strong>Multilingual by design</strong><small>English & Kannada</small></span></div>
            <div><div className="stat-icon gold"><ShieldCheck size={19} /></div><span><strong>Evidence-aware results</strong><small>Source excerpts & warnings</small></span></div>
          </div>

          <section id="analyzer" className="analyzer-section">
            <div className="section-heading">
              <div><span className="section-kicker">01 / DOCUMENT WORKSPACE</span><h2>{t(language, 'Analyze a scholarship notice')}</h2><p>{language === 'kn' ? 'ಪ್ರಕಟಣೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ; ವೈಯಕ್ತಿಕ ಮಾರ್ಗದರ್ಶನಕ್ಕಾಗಿ ಐಚ್ಛಿಕ ಮಾಹಿತಿ ನೀಡಿ.' : 'Upload a notice and add optional information to personalize the guidance.'}</p></div>
              <Pill tone="quiet"><LockKeyhole size={13} /> {t(language, 'No upload history')}</Pill>
            </div>
            <div className="form-grid">
              <div className="card upload-card">
                <div className="card-heading"><div className="card-number">01</div><div><h3>{t(language, 'Your document')}</h3><p>{t(language, 'Upload the original scholarship notice.')}</p></div></div>
                <input ref={fileInput} className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e: ChangeEvent<HTMLInputElement>) => chooseFile(e.target.files?.[0])} aria-label="Choose a scholarship notice" />
                {!file ? (
                  <div className={`dropzone${isDragging ? ' dragging' : ''}`} role="button" tabIndex={0}
                    onClick={() => fileInput.current?.click()}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current?.click(); } }}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)} onDrop={onDrop}>
                    <div className="upload-image"><CloudUpload size={30} strokeWidth={1.6} /></div>
                    <strong>{t(language, 'Drag & drop your file here')}</strong>
                    <span>{language === 'kn' ? 'ಅಥವಾ' : 'or'} <u>{t(language, 'browse from your device')}</u></span>
                    <div className="upload-formats"><span>PDF</span><span>JPG</span><span>PNG</span><span>MAX 8 MB</span></div>
                  </div>
                ) : (
                  <div className="file-selected">
                    <div className="file-selected-icon">{file.type.includes('pdf') ? <FileText size={26} /> : <FileImage size={26} />}</div>
                    <div className="file-selected-info"><strong title={file.name}>{file.name}</strong><span>{prettySize(file.size)} · Ready for analysis</span>
                      {previewUrl && <a href={previewUrl} target="_blank" rel="noopener noreferrer">Open original <ArrowUpRight size={13}/></a>}
                    </div>
                    <button className="file-remove" title="Remove file" aria-label="Remove file" onClick={reset}><X size={17}/></button>
                  </div>
                )}
                <div className="sample-area"><span className="sample-title">OR TRY A SAMPLE</span>
                  <div className="sample-row">
                    <button className="sample-choice" onClick={() => void loadExample('pdf')}><FileText size={17}/><span>{t(language, 'Scholarship PDF')}</span><ArrowUpRight size={13}/></button>
                    <button className="sample-choice" onClick={() => void loadExample('image')}><FileImage size={17}/><span>{t(language, 'Notice image')}</span><ArrowUpRight size={13}/></button>
                  </div>
                  <small>Samples are fictional. Analysis still uses the live Gemma API.</small>
                </div>
              </div>
              <div className="card details-card">
                <div className="card-heading"><div className="card-number">02</div><div><h3>{t(language, 'Student profile')} <span className="optional-tag">{language === 'kn' ? 'ಐಚ್ಛಿಕ' : 'OPTIONAL'}</span></h3><p>{t(language, 'Helps compare eligibility requirements.')}</p></div></div>
                <div className="form-fields">
                  <div className="field-row">
                    <Field label={t(language, 'Education level')} id="education"><select id="education" value={profile.education_level} onChange={e => setField('education_level', e.target.value)}><option>Not specified</option><option>PUC / Class 12</option><option>Undergraduate</option><option>Postgraduate</option><option>Diploma</option><option>Other</option></select></Field>
                    <Field label={t(language, 'State of residence')} id="state"><select id="state" value={profile.state} onChange={e => setField('state', e.target.value)}><option>Not specified</option><option>Karnataka</option><option>Maharashtra</option><option>Tamil Nadu</option><option>Kerala</option><option>Andhra Pradesh</option><option>Telangana</option><option>Other</option></select></Field>
                  </div>
                  <div className="field-row">
                    <Field label={t(language, 'Annual family income (₹)')} id="income"><input id="income" type="number" min="0" step="1" placeholder="e.g. 250000" value={profile.annual_income} onChange={e => setField('annual_income', e.target.value)}/></Field>
                    <Field label={t(language, 'Previous marks (%)')} id="marks"><input id="marks" type="number" min="0" max="100" step="0.01" placeholder="e.g. 85" value={profile.percentage} onChange={e => setField('percentage', e.target.value)}/></Field>
                  </div>
                  <Field label={t(language, 'Category')} id="category"><select id="category" value={profile.category} onChange={e => setField('category', e.target.value)}><option>Not specified</option><option>General</option><option>OBC</option><option>SC</option><option>ST</option><option>EWS</option><option>Prefer not to say</option></select></Field>
                  <div className="field-row"><Field label={t(language, 'Age')} id="age"><input id="age" type="number" min="0" max="120" step="1" value={profile.age} onChange={e => setField('age', e.target.value)}/></Field><Field label={t(language, 'Study mode')} id="study-mode"><select id="study-mode" value={profile.study_mode} onChange={e => setField('study_mode', e.target.value)}><option>Not specified</option><option>Full-time</option><option>Part-time</option><option>Distance</option></select></Field></div>
                </div>
                <div className="profile-footnote"><Info size={15}/><span>{language === 'kn' ? 'ನೀವು ನೀಡಿದ ದಾಖಲೆ ಮತ್ತು ಮಾಹಿತಿ Google API ಗೆ ಹೋಗುತ್ತದೆ. ಸಹಾಯಕಕ್ಕಾಗಿ ಸರ್ವರ್ ಮೆಮೊರಿಯಲ್ಲಿ 20 ನಿಮಿಷಗಳವರೆಗೆ ಇರುತ್ತದೆ.' : 'The notice and supplied details go to Google’s model API. Document context is kept in server memory for up to 20 minutes for chat; reset removes it early.'}</span></div>
              </div>
            </div>
            <div className="action-card">
              <div className="action-text"><div className="magic-icon"><WandSparkles size={22}/></div><span><strong>Ready to see the bigger picture?</strong><small>Gemma 4 will read the notice and build actionable guidance.</small></span></div>
              <button className="analyze-btn" onClick={() => void submit()} disabled={loading}>
                {loading ? <><LoaderCircle className="spinning" size={19}/> {t(language, 'Analyzing…')}</> : <><Sparkles size={19}/> {t(language, 'Analyze with Gemma 4')} <ArrowRight size={17}/></>}
              </button>
            </div>
            {healthError && <div className="inline-notice warning"><AlertTriangle size={18}/><span>Backend is unreachable. Start FastAPI on port 8000 and refresh.</span></div>}
            {health && !health.gemma_configured && <div className="inline-notice warning"><Info size={18}/><span>Gemma is not configured yet. Add your API key to <code>backend/.env</code>. Upload and preview work without it; analysis requires a key.</span></div>}
            {error && <div role="alert" className="inline-notice error"><AlertTriangle size={18}/><span>{friendlyError(language, error)}</span><button disabled={loading} onClick={() => void submit()}>{t(language, 'Retry')}</button><button onClick={() => setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
            {loading && <div className="loading-card" role="status"><div className="loading-visual"><ScanLine size={28}/></div><div><strong>Gemma 4 is reading your notice</strong><p>Analyzing uploaded pages, translating instructions, and comparing requirements. Processing time depends on document length and API availability.</p></div><LoaderCircle className="spinning" size={24}/></div>}
          </section>

          <section className="results-section" id="results" ref={resultsRef}>
            <div className="section-heading results-heading"><div><span className="section-kicker">02 / YOUR INSIGHTS</span><h2>{t(language, 'Analysis results')}</h2><p>{language === 'kn' ? 'ಸ್ಪಷ್ಟ ವಿವರಗಳು, ಮೂಲ ಉಲ್ಲೇಖಗಳು ಮತ್ತು ಮುಂದಿನ ಕ್ರಮಗಳು.' : 'Clear takeaways, cited details, and actionable next steps.'}</p></div>
              {analysis && <button className="reset-btn" onClick={reset}><RotateCcw size={15}/> {t(language, 'New analysis')}</button>}
            </div>
            {!analysis ? (
              <div className="results-empty card"><div className="empty-graphic"><FolderOpen size={39}/><span className="empty-star">✦</span></div><strong>Your clarity starts here</strong><p>Upload a scholarship notice above to see requirements, deadlines, eligibility guidance, and a document checklist.</p><a href="#analyzer">Analyze your first document <ArrowRight size={16}/></a></div>
            ) : (
              <div className={`evidence-workspace${viewerOpen ? ' with-viewer' : ''}`}>
              {viewerOpen && previewUrl && <Suspense fallback={<p role="status">Loading viewer…</p>}><DocumentViewer url={previewUrl} isPdf={file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name ?? '')} fact={evidence} language={language} close={() => setViewerOpen(false)}/></Suspense>}
              <div className="result-wrapper analysis-panel">
                <div className="result-banner"><div><div className="result-eyebrow"><CheckCircle2 size={15}/> ANALYSIS COMPLETE <span>· {analysis.pages_analyzed} page{analysis.pages_analyzed !== 1 ? 's' : ''} scanned</span></div><h3>{analysis.title}</h3><p>{analysis.provider || 'Provider not clearly identified'}</p></div><div className="result-banner-right"><span>MODEL USED</span><strong>{analysis.model_used}</strong><small>{analysis.processing_seconds.toFixed(1)}s processing · {analysis.confidence} model-estimated confidence</small></div></div>
                <div className="result-tabs" role="tablist" aria-label="Analysis sections">
                  {([['overview', 'Overview'], ['eligibility', 'Eligibility'], ['documents', 'Documents'], ['roadmap', 'Action plan'], ['assistant', 'Assistant']] as const).map(([key, label]) =>
                    <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{t(language, label)}</button>
                  )}
                  {!viewerOpen && <button title={t(language, 'View evidence')} aria-label={t(language, 'View evidence')} onClick={() => setViewerOpen(true)}><BookOpen size={16}/></button>}
                </div>
                <EligibilitySummary criteria={analysis.criteria} language={language}/>
                {tab === 'overview' && <div className="overview-grid">
                  <div className="result-summary"><div className="result-card-heading"><BookOpen size={18}/><h4>{t(language, 'What this means')}</h4></div><p className={language === 'kn' ? 'kannada-text' : ''}>{language === 'kn' ? analysis.summary_kn : analysis.summary_en}</p>
                    {(analysis.summary_sources ?? []).map((source, i) => <SourceTag key={i} {...source}/>)}
                    <div className="summary-meta"><span><FileText size={14}/> {analysis.filename}</span></div></div>
                  <div className="deadline-card"><div className="result-card-heading"><CalendarDays size={18}/><h4>{t(language, 'Application deadline')}</h4></div><strong>{analysis.deadline.date_text ?? t(language, 'Deadline not found in the uploaded document. Verify it through the official scholarship provider.')}</strong><SourceTag {...analysis.deadline}/></div>
                </div>}
                {tab === 'eligibility' && <div className="detail-list"><div className="result-card-heading"><GraduationCap size={18}/><h4>{t(language, 'Eligibility requirements')}</h4></div>
                  <div className="eligibility-overall" role="status"><strong>{analysis.eligibility_overall === 'appears_to_meet_extracted' ? (language === 'kn' ? 'ಪಡೆಯಲಾದ ನಿಯಮಗಳನ್ನು ಪೂರೈಸಿದಂತೆ ಕಾಣುತ್ತದೆ' : 'Appears to meet extracted rules') : analysis.eligibility_overall === 'possible_mismatch' ? (language === 'kn' ? 'ಸಂಭಾವ್ಯ ಹೊಂದಾಣಿಕೆ ಇಲ್ಲ' : 'Possible eligibility mismatch') : t(language, 'Needs verification')}</strong><p>{language === 'kn' ? 'ಇದು ಅಧಿಕೃತ ಅರ್ಹತಾ ನಿರ್ಣಯವಲ್ಲ. ಮೂಲ ಪ್ರಕಟಣೆ ಮತ್ತು ಅಧಿಕೃತ ಸಂಸ್ಥೆಯೊಂದಿಗೆ ಪರಿಶೀಲಿಸಿ.' : 'Preliminary only. Extracted rules may be incomplete; confirm with the official provider.'}</p></div>
                  {analysis.criteria.length ? analysis.criteria.map((item, index) => <div className="criterion" key={index}><div className={`criterion-icon ${item.status}`}><StatusIcon status={item.status}/></div><div><strong>{language === 'kn' ? item.requirement_kn || item.requirement : item.requirement}</strong>
                    <span className={`assessment ${item.status}`}>{t(language, item.status === 'likely_meets' ? 'Satisfied' : item.status === 'may_not_meet' ? 'Possible mismatches' : 'Needs verification')}</span>
                    <p>{t(language, 'Extracted condition')}: {item.rule ? `${({ lt: '<', lte: '≤', gt: '>', gte: '≥', eq: '=', one_of: '∈' } as Record<string, string>)[item.rule.operator] ?? '?'} ${item.rule.value_number ?? item.rule.values.join(', ')}` : item.evidence || t(language, 'Needs verification')}</p>
                    <p>{t(language, 'Student value')}: {item.student_value === null || item.student_value === undefined || item.student_value === 'Not specified' ? t(language, 'Not supplied') : String(item.student_value)}</p>
                    <p className={language === 'kn' ? 'kannada-text' : ''}>{language === 'kn' ? item.explanation_kn : item.explanation_en}</p><SourceTag {...item}/></div></div>) : <p>{t(language, 'No eligibility criteria could be confidently extracted. Check the official notice.')}</p>}
                </div>}
                {tab === 'documents' && <div className="detail-list"><div className="documents-header"><div className="result-card-heading"><ClipboardCheck size={18}/><h4>{t(language, 'Required documents')}</h4></div><button className="export-btn" onClick={() => exportChecklist(analysis)}><Download size={16}/>{t(language, 'Download checklist')}</button></div>
                  <p>{t(language, 'Checklist completion does not submit an application.')}</p>
                  {analysis.documents.length ? <><div className="document-progress"><div style={{ width: `${doneDocuments.length / analysis.documents.length * 100}%` }}/></div>{analysis.documents.map((doc, index) => <div className={`document-item${doneDocuments.includes(`${index}`) ? ' completed' : ''}`} key={index}>
                    <label><input type="checkbox" checked={doneDocuments.includes(`${index}`)} onChange={() => toggleDone(`${index}`)}/><strong>{language === 'kn' ? doc.name_kn || doc.name : doc.name}</strong></label><SourceTag {...doc}/></div>)}</> : <p>{t(language, 'No document requirements were clearly extracted. Review the notice manually.')}</p>}
                </div>}
                {tab === 'roadmap' && <ApplicationRoadmap key={analysis.request_id} sessionId={analysis.request_id} tasks={analysis.roadmap ?? []} language={language}/>}
                <div hidden={tab !== 'assistant'}><ScholarshipChat key={analysis.session_id} sessionId={analysis.session_id} language={language}/></div>
                {(analysis.unknowns.length > 0 || analysis.warnings.length > 0) && <div className="review-warning"><AlertTriangle size={19}/><div><strong>{t(language, 'Before you apply, double-check these details')}</strong><ul>{(language === 'kn' ? [...(analysis.unknowns_kn?.length ? analysis.unknowns_kn : analysis.unknowns), ...(analysis.warnings_kn?.length ? analysis.warnings_kn : analysis.warnings)] : [...analysis.unknowns, ...analysis.warnings]).map((warning, index) => <li key={index}>{warning}</li>)}</ul></div></div>}
                <div className="result-disclaimer"><ShieldCheck size={17}/>{language === 'kn' ? 'AI ಮಾರ್ಗದರ್ಶನ ಮಾತ್ರ. ಮೂಲ ಪ್ರಕಟಣೆ ಮತ್ತು ಅಧಿಕೃತ ಸಂಸ್ಥೆಯೊಂದಿಗೆ ಪರಿಶೀಲಿಸಿ.' : analysis.disclaimer} <span>Request ID: {analysis.request_id}</span></div>
              </div>
              </div>
            )}
          </section>

          <section className="how-section" id="how-it-works"><span className="section-kicker">BUILT FOR CLARITY</span><h2>From paperwork to possibilities.</h2><div className="how-grid"><div><div className="how-icon"><UploadCloud size={22}/></div><b>01 · Upload</b><p>Add a PDF, screenshot, or photo of a scholarship notice.</p></div><div><div className="how-icon"><Sparkles size={22}/></div><b>02 · Understand</b><p>Gemma 4 interprets the document and organizes key details.</p></div><div><div className="how-icon"><CheckCircle2 size={22}/></div><b>03 · Take action</b><p>Review eligibility, check documents, and follow a clear plan.</p></div></div></section>
        </main>
        <footer className="page-footer"><span><BrandIcon small/> FormBridge AI <span>·</span> An Avengineers project</span><span><Clock3 size={13}/> Built for Hacktoberfest 2026 <span>·</span> Powered by Gemma 4</span></footer>
      </div>
      <div className="floating-status"><StatusCard health={health}/></div>
    </div>
    </EvidenceContext.Provider>
  );
}
