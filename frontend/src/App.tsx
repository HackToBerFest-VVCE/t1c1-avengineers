import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import {
  ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, CheckCheck,
  CheckCircle2, ChevronRight, CircleHelp, ClipboardCheck, Clock3,
  CloudUpload, Download, ExternalLink, FileImage,
  FileSearch2, FileText, FolderOpen, GraduationCap, Info, Languages,
  Layers3, LoaderCircle, LockKeyhole, Menu, RotateCcw, ScanLine,
  ShieldCheck, Sparkles, UploadCloud, WandSparkles, X, AlertTriangle,
} from 'lucide-react';
import { analyzeDocument, healthCheck, loadSampleFile } from './lib/api';
import type { Analysis, Health, Profile } from './lib/types';
import SourceTag from './components/SourceTag';

type Tab = 'overview' | 'eligibility' | 'documents' | 'roadmap';
type Language = 'en' | 'kn';

const startProfile: Profile = {
  education_level: 'Undergraduate', state: 'Karnataka', category: 'Not specified',
  annual_income: '', percentage: '',
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
    if (!selected) return;
    if (selected.size > maximumSize) { setError('This file exceeds the 8 MB limit.'); return; }
    const supported = ['application/pdf', 'image/jpeg', 'image/png'].includes(selected.type)
      || /\.(pdf|jpe?g|png)$/i.test(selected.name);
    if (!supported) { setError('Please choose a PDF, JPG, or PNG file.'); return; }
    setFile(selected);
    setAnalysis(null);
    setDoneDocuments([]);
    setError('');
    setTab('overview');
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
    setProfile(p => ({ ...p, [field]: value }));
  const submit = async () => {
    if (!file) { setError('Upload a notice or choose a sample first.'); return; }
    if (profile.percentage !== '' && !(Number(profile.percentage) >= 0 && Number(profile.percentage) <= 100)) {
      setError('Marks percentage must be between 0 and 100.'); return;
    }
    if (profile.annual_income !== '' && Number(profile.annual_income) < 0) {
      setError('Annual income cannot be negative.'); return;
    }
    setError(''); setLoading(true); setAnalysis(null);
    try {
      const result = await analyzeDocument(file, profile);
      setAnalysis(result);
      setDoneDocuments([]);
      setTab('overview');
      setHealth(h => h ? { ...h, gemma_configured: true } : h);
      window.setTimeout(() => resultsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze this document.');
    } finally { setLoading(false); }
  };
  const reset = () => {
    setFile(null); setError(''); setAnalysis(null);
    setDoneDocuments([]); setTab('overview');
    if (fileInput.current) fileInput.current.value = '';
  };
  const toggleDone = (name: string) => setDoneDocuments(existing =>
    existing.includes(name) ? existing.filter(x => x !== name) : [...existing, name]);

  return (
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
          <div className="sidebar-footer"><ShieldCheck size={15} /> Privacy-first processing <span className="footer-version">v1.0</span></div>
        </div>
      </aside>

      <div className="main-column" id="home">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-btn" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <span className="breadcrumb">Workspace</span><ChevronRight size={15} className="breadcrumb-arrow" /><span className="breadcrumb-current">Dashboard</span>
          </div>
          <div className="topbar-right">
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
              <div><span className="section-kicker">01 / DOCUMENT WORKSPACE</span><h2>Analyze a scholarship notice</h2><p>Upload a notice and add optional information to personalize the guidance.</p></div>
              <Pill tone="quiet"><LockKeyhole size={13} /> No upload history</Pill>
            </div>
            <div className="form-grid">
              <div className="card upload-card">
                <div className="card-heading"><div className="card-number">01</div><div><h3>Your document</h3><p>Upload the original scholarship notice.</p></div></div>
                <input ref={fileInput} className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e: ChangeEvent<HTMLInputElement>) => chooseFile(e.target.files?.[0])} aria-label="Choose a scholarship notice" />
                {!file ? (
                  <div className={`dropzone${isDragging ? ' dragging' : ''}`} role="button" tabIndex={0}
                    onClick={() => fileInput.current?.click()}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current?.click(); } }}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)} onDrop={onDrop}>
                    <div className="upload-image"><CloudUpload size={30} strokeWidth={1.6} /></div>
                    <strong>Drag & drop your file here</strong>
                    <span>or <u>browse from your device</u></span>
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
                    <button className="sample-choice" onClick={() => void loadExample('pdf')}><FileText size={17}/><span>Scholarship PDF</span><ArrowUpRight size={13}/></button>
                    <button className="sample-choice" onClick={() => void loadExample('image')}><FileImage size={17}/><span>Notice image</span><ArrowUpRight size={13}/></button>
                  </div>
                  <small>Samples are fictional. Analysis still uses the live Gemma API.</small>
                </div>
              </div>
              <div className="card details-card">
                <div className="card-heading"><div className="card-number">02</div><div><h3>Student profile <span className="optional-tag">OPTIONAL</span></h3><p>Helps compare eligibility requirements.</p></div></div>
                <div className="form-fields">
                  <div className="field-row">
                    <Field label="Education level" id="education"><select id="education" value={profile.education_level} onChange={e => setField('education_level', e.target.value)}><option>Not specified</option><option>PUC / Class 12</option><option>Undergraduate</option><option>Postgraduate</option><option>Diploma</option><option>Other</option></select></Field>
                    <Field label="State of residence" id="state"><select id="state" value={profile.state} onChange={e => setField('state', e.target.value)}><option>Not specified</option><option>Karnataka</option><option>Maharashtra</option><option>Tamil Nadu</option><option>Kerala</option><option>Andhra Pradesh</option><option>Telangana</option><option>Other</option></select></Field>
                  </div>
                  <div className="field-row">
                    <Field label="Annual family income (₹)" id="income"><input id="income" type="number" min="0" step="1" placeholder="e.g. 250000" value={profile.annual_income} onChange={e => setField('annual_income', e.target.value)}/></Field>
                    <Field label="Previous marks (%)" id="marks"><input id="marks" type="number" min="0" max="100" step="0.01" placeholder="e.g. 85" value={profile.percentage} onChange={e => setField('percentage', e.target.value)}/></Field>
                  </div>
                  <Field label="Category" id="category"><select id="category" value={profile.category} onChange={e => setField('category', e.target.value)}><option>Not specified</option><option>General</option><option>OBC</option><option>SC</option><option>ST</option><option>EWS</option><option>Prefer not to say</option></select></Field>
                </div>
                <div className="profile-footnote"><Info size={15}/><span>Only enter details you're comfortable sharing. The document and any supplied details are sent to Google's hosted model API, but not saved by this app.</span></div>
              </div>
            </div>
            <div className="action-card">
              <div className="action-text"><div className="magic-icon"><WandSparkles size={22}/></div><span><strong>Ready to see the bigger picture?</strong><small>Gemma 4 will read the notice and build actionable guidance.</small></span></div>
              <button className="analyze-btn" onClick={() => void submit()} disabled={loading}>
                {loading ? <><LoaderCircle className="spinning" size={19}/> Analyzing…</> : <><Sparkles size={19}/> Analyze with Gemma 4 <ArrowRight size={17}/></>}
              </button>
            </div>
            {healthError && <div className="inline-notice warning"><AlertTriangle size={18}/><span>Backend is unreachable. Start FastAPI on port 8000 and refresh.</span></div>}
            {health && !health.gemma_configured && <div className="inline-notice warning"><Info size={18}/><span>Gemma is not configured yet. Add your API key to <code>backend/.env</code>. Upload and preview work without it; analysis requires a key.</span></div>}
            {error && <div role="alert" className="inline-notice error"><AlertTriangle size={18}/><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
            {loading && <div className="loading-card" role="status"><div className="loading-visual"><ScanLine size={28}/></div><div><strong>Gemma 4 is reading your notice</strong><p>Analyzing uploaded pages, translating instructions, and comparing requirements. Processing time depends on document length and API availability.</p></div><LoaderCircle className="spinning" size={24}/></div>}
          </section>

          <section className="results-section" id="results" ref={resultsRef}>
            <div className="section-heading results-heading"><div><span className="section-kicker">02 / YOUR INSIGHTS</span><h2>Analysis results</h2><p>Clear takeaways, cited details, and actionable next steps.</p></div>
              {analysis && <button className="reset-btn" onClick={reset}><RotateCcw size={15}/> New analysis</button>}
            </div>
            {!analysis ? (
              <div className="results-empty card"><div className="empty-graphic"><FolderOpen size={39}/><span className="empty-star">✦</span></div><strong>Your clarity starts here</strong><p>Upload a scholarship notice above to see requirements, deadlines, eligibility guidance, and a document checklist.</p><a href="#analyzer">Analyze your first document <ArrowRight size={16}/></a></div>
            ) : (
              <div className="result-wrapper">
                <div className="result-banner"><div><div className="result-eyebrow"><CheckCircle2 size={15}/> ANALYSIS COMPLETE <span>· {analysis.pages_analyzed} page{analysis.pages_analyzed !== 1 ? 's' : ''} scanned</span></div><h3>{analysis.title}</h3><p>{analysis.provider || 'Provider not clearly identified'}</p></div><div className="result-banner-right"><span>MODEL USED</span><strong>{analysis.model_used}</strong><small>{analysis.processing_seconds.toFixed(1)}s processing · {analysis.confidence} model-estimated confidence</small></div></div>
                <div className="result-tabs" role="tablist" aria-label="Analysis sections">
                  {([['overview', 'Overview'], ['eligibility', 'Eligibility'], ['documents', `Documents (${analysis.documents.length})`], ['roadmap', 'Action plan']] as const).map(([key, label]) =>
                    <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
                  )}
                  <span className="language-switch" aria-label="Output language"><Languages size={16}/><button className={language === 'en' ? 'current' : ''} onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button><button className={language === 'kn' ? 'current' : ''} onClick={() => setLanguage('kn')} aria-pressed={language === 'kn'}>ಕನ್ನಡ</button></span>
                </div>
                {tab === 'overview' && <div className="overview-grid"><div className="card result-summary"><div className="result-card-heading"><BookOpen size={18}/><h4>What this means</h4></div><p className={language === 'kn' ? 'kannada-text' : ''}>{language === 'kn' ? analysis.summary_kn : analysis.summary_en}</p><div className="summary-meta"><span><FileText size={14}/> {analysis.filename}</span><span><ShieldCheck size={14}/> Verify against source</span></div></div><div className="card deadline-card"><div className="result-card-heading"><CalendarDays size={18}/><h4>Application deadline</h4></div><strong>{analysis.deadline.date_text ?? 'Not found in notice'}</strong><SourceTag evidence={analysis.deadline.evidence} page={analysis.deadline.page}/></div></div>}
                {tab === 'eligibility' && <div className="card detail-list"><div className="result-card-heading"><GraduationCap size={18}/><h4>Eligibility requirements</h4></div><div className="eligibility-overall" role="status"><strong>{analysis.eligibility_overall === 'appears_to_meet_extracted' ? (language === 'kn' ? 'ಪಡೆಯಲಾದ ನಿಯಮಗಳನ್ನು ಪೂರೈಸಿದಂತೆ ಕಾಣುತ್ತದೆ' : 'Appears to meet extracted rules') : analysis.eligibility_overall === 'possible_mismatch' ? (language === 'kn' ? 'ಸಂಭಾವ್ಯ ಹೊಂದಾಣಿಕೆ ಇಲ್ಲ' : 'Possible eligibility mismatch') : (language === 'kn' ? 'ಹೆಚ್ಚಿನ ಪರಿಶೀಲನೆ ಅಗತ್ಯ' : 'Needs verification')}</strong><p>{language === 'kn' ? 'ಇದು ಅಧಿಕೃತ ಅರ್ಹತಾ ನಿರ್ಣಯವಲ್ಲ. ಮೂಲ ಪ್ರಕಟಣೆ ಮತ್ತು ಅಧಿಕೃತ ವೆಬ್‌ಸೈಟ್ ಪರಿಶೀಲಿಸಿ.' : 'Preliminary only. Gemma-extracted rules may be incomplete; verify quotations in the original notice and confirm with the official provider.'}</p></div><p className="detail-intro">These are tentative comparisons based on the information you supplied, not an official eligibility decision.</p>{analysis.criteria.length ? analysis.criteria.map((item, index) => <div className="criterion" key={index}><div className={`criterion-icon ${item.status}`}><StatusIcon status={item.status}/></div><div><strong>{item.requirement}</strong><span className={`assessment ${item.status}`}>{item.status === 'likely_meets' ? (language === 'kn' ? 'ಪೂರೈಸಿದಂತೆ ಕಾಣುತ್ತದೆ' : 'Appears to meet') : item.status === 'may_not_meet' ? (language === 'kn' ? 'ಹೊಂದಿಕೆಯಾಗದಿರಬಹುದು' : 'Possible mismatch') : (language === 'kn' ? 'ಪರಿಶೀಲನೆ ಅಗತ್ಯ' : 'Needs verification')}</span><p className={language === 'kn' ? 'kannada-text' : ''}>{language === 'kn' ? item.explanation_kn : item.explanation_en}</p><SourceTag evidence={item.evidence} page={item.page}/></div></div>) : <p className="detail-intro">No eligibility criteria could be confidently extracted. Check the official notice.</p>}</div>}
                {tab === 'documents' && <div className="card detail-list"><div className="documents-header"><div className="result-card-heading"><ClipboardCheck size={18}/><h4>Required documents</h4></div><button className="export-btn" onClick={() => exportChecklist(analysis)}><Download size={16}/> Download checklist</button></div><p className="detail-intro">Tick off documents as you prepare them. This checklist is stored only in the current browser session.</p>{analysis.documents.length ? <><div className="document-progress"><div style={{ width: `${doneDocuments.length / analysis.documents.length * 100}%` }}/></div><div className="document-count">{doneDocuments.length} of {analysis.documents.length} completed</div>{analysis.documents.map((doc, index) => <label className={`document-row${doneDocuments.includes(`${index}`) ? ' completed' : ''}`} key={index}><input type="checkbox" checked={doneDocuments.includes(`${index}`)} onChange={() => toggleDone(`${index}`)}/><span className="custom-checkbox"><Check size={14}/></span><span className="document-name"><strong>{doc.name}</strong><SourceTag evidence={doc.evidence} page={doc.page}/></span></label>)}</> : <p className="detail-intro">No document requirements were clearly extracted. Review the notice manually.</p>}</div>}
                {tab === 'roadmap' && <div className="card detail-list"><div className="result-card-heading"><CheckCheck size={18}/><h4>Your next steps</h4></div>{analysis.steps.length ? <div className="roadmap">{analysis.steps.map((step, index) => <div className="roadmap-step" key={index}><span className="roadmap-number">{String(index + 1).padStart(2, '0')}</span><div><strong>{step.title}</strong><p className={language === 'kn' ? 'kannada-text' : ''}>{language === 'kn' ? step.detail_kn : step.detail_en}</p></div></div>)}</div> : <p className="detail-intro">No specific application steps were identified.</p>}</div>}
                {(analysis.unknowns.length > 0 || analysis.warnings.length > 0) && <div className="review-warning"><AlertTriangle size={19}/><div><strong>Before you apply, double-check these details</strong><ul>{[...analysis.unknowns, ...analysis.warnings].map((warning, index) => <li key={index}>{warning}</li>)}</ul></div></div>}
                <div className="result-disclaimer"><ShieldCheck size={17}/>{analysis.disclaimer} <span>Request ID: {analysis.request_id}</span></div>
              </div>
            )}
          </section>

          <section className="how-section" id="how-it-works"><span className="section-kicker">BUILT FOR CLARITY</span><h2>From paperwork to possibilities.</h2><div className="how-grid"><div><div className="how-icon"><UploadCloud size={22}/></div><b>01 · Upload</b><p>Add a PDF, screenshot, or photo of a scholarship notice.</p></div><div><div className="how-icon"><Sparkles size={22}/></div><b>02 · Understand</b><p>Gemma 4 interprets the document and organizes key details.</p></div><div><div className="how-icon"><CheckCircle2 size={22}/></div><b>03 · Take action</b><p>Review eligibility, check documents, and follow a clear plan.</p></div></div></section>
        </main>
        <footer className="page-footer"><span><BrandIcon small/> FormBridge AI <span>·</span> An Avengineers project</span><span><Clock3 size={13}/> Built for Hacktoberfest 2026 <span>·</span> Powered by Gemma 4</span></footer>
      </div>
      <div className="floating-status"><StatusCard health={health}/></div>
    </div>
  );
}
