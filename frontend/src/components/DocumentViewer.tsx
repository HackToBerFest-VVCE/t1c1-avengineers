import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X, ZoomIn, ZoomOut, MoveHorizontal } from 'lucide-react';
import type { Language, SourceFact } from '../lib/types';
import { t } from '../lib/i18n';
import SourceVerificationBadge from './SourceVerificationBadge';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export default function DocumentViewer({ url, isPdf, fact, language, close }: {
  url: string; isPdf: boolean; fact: SourceFact | null; language: Language; close: () => void;
}) {
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(450);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => { setPage(1); setCount(1); setZoom(1); setFailed(false); }, [url]);
  useEffect(() => { if (fact?.page) setPage(Math.max(1, fact.page)); }, [fact]);
  useEffect(() => {
    if (!area.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width - 24)));
    observer.observe(area.current);
    return () => observer.disconnect();
  }, [expanded]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.activeElement as HTMLElement | null;
    root.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('keydown', escape); previous?.focus(); };
  }, [expanded]);
  const button = (label: string, click: () => void, icon: ReactNode, disabled = false) =>
    <button type="button" title={t(language, label)} aria-label={t(language, label)} onClick={click} disabled={disabled}>{icon}</button>;
  return <aside ref={root} tabIndex={-1} className={`evidence-viewer${expanded ? ' expanded' : ''}`} aria-label={t(language, 'Original document')}>
    <div className="viewer-heading"><strong>{t(language, 'Original document')}</strong>
      {button('Expand viewer', () => setExpanded(!expanded), expanded ? <Minimize2 size={17}/> : <Maximize2 size={17}/>)}
      {button('Close viewer', close, <X size={17}/>)}</div>
    <div className="viewer-toolbar">
      {isPdf && <>{button('Previous page', () => setPage(p => p - 1), <ChevronLeft size={17}/>, page <= 1)}
        <label>{t(language, 'Page')} <input aria-label={t(language, 'Page')} type="number" min={1} max={count} value={page}
          onChange={e => setPage(Math.min(count, Math.max(1, Number(e.target.value) || 1)))}/> / {count}</label>
        {button('Next page', () => setPage(p => p + 1), <ChevronRight size={17}/>, page >= count)}</>}
      {button('Zoom out', () => setZoom(z => Math.max(.5, z - .25)), <ZoomOut size={17}/>, zoom <= .5)}
      <span>{Math.round(zoom * 100)}%</span>
      {button('Zoom in', () => setZoom(z => Math.min(3, z + .25)), <ZoomIn size={17}/>, zoom >= 3)}
      {button('Fit to width', () => setZoom(1), <MoveHorizontal size={17}/>)}</div>
    {fact && <div className="evidence-quote"><strong>{t(language, 'Supporting quotation')}</strong><span> · {fact.page ? `${t(language, 'Page')} ${fact.page}` : t(language, 'Page unconfirmed')}</span><blockquote>{fact.evidence || t(language, 'No quoted evidence - verify manually')}</blockquote><SourceVerificationBadge verification={fact.verification} language={language}/>
      {fact.verification && <p>{language === 'en' ? fact.verification.reason : fact.verification.status === 'verified' ? 'ಉಲ್ಲೇಖವು ಸೂಚಿಸಿದ ಪುಟದ ಪಠ್ಯದೊಂದಿಗೆ ಹೊಂದಿದೆ.' : 'ಉಲ್ಲೇಖವನ್ನು ಸಂಪೂರ್ಣವಾಗಿ ದೃಢಪಡಿಸಲಾಗಿಲ್ಲ. ಮೂಲ ಪುಟವನ್ನು ಸ್ವತಃ ಪರಿಶೀಲಿಸಿ.'}</p>}
    </div>}
    <div className="document-canvas" ref={area}>
      {isPdf ? <Document file={url} onLoadSuccess={({ numPages }) => { setCount(numPages); setPage(p => Math.min(p, numPages)); }}
        onLoadError={() => setFailed(true)} loading={<p role="status">{language === 'kn' ? 'ದಾಖಲೆ ತೆರೆಯುತ್ತಿದೆ…' : 'Loading document…'}</p>}
        error={<p>{t(language, 'Document could not be displayed. Open the original file.')}</p>}>
        <Page pageNumber={Math.min(page, count)} width={width * zoom} renderAnnotationLayer={false} renderTextLayer/>
      </Document> : <img src={url} alt={t(language, 'Original document')} style={{ width: width * zoom }} onError={() => setFailed(true)}/>}
    </div>
    <a className="viewer-original" href={url} target="_blank" rel="noopener noreferrer">{t(language, 'Open original')}</a>
    {failed && <p role="alert">{t(language, 'Document could not be displayed. Open the original file.')}</p>}
  </aside>;
}
