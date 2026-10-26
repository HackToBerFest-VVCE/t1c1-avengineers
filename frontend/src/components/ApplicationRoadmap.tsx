import { useEffect, useState } from 'react';
import { Check, Download, ListChecks, Printer } from 'lucide-react';
import type { Language, RoadmapTask } from '../lib/types';
import { t } from '../lib/i18n';
import SourceTag from './SourceTag';
import { contentText } from '../lib/content';

export default function ApplicationRoadmap({ tasks, language, sessionId }: { tasks: RoadmapTask[]; language: Language; sessionId: string }) {
  const key = `formbridge-roadmap:${sessionId}`;
  const [done, setDone] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    } catch { return []; }
  });
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(done)); } catch { /* Browser storage can be disabled. */ } }, [key, done]);
  const download = () => {
    const text = [t(language, 'Your next steps'), t(language, 'Checklist completion does not submit an application.'), '',
      ...tasks.map(task => `[${done.includes(task.id) ? 'x' : ' '}] ${t(language, task.priority)}: ${contentText(language, task.title, task.title_kn)}\n${contentText(language, task.detail_en, task.detail_kn)}${task.page ? `\n${t(language, 'Page')} ${task.page}: ${task.evidence ?? ''}` : ''}`)].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'FormBridge-Application-Roadmap.txt'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };
  return <section className="application-roadmap"><div className="documents-header"><div className="result-card-heading"><ListChecks size={19}/><h4>{t(language, 'Your next steps')}</h4></div><div className="roadmap-actions"><button className="export-btn" onClick={download}><Download size={16}/>{t(language, 'Download checklist')}</button><button className="export-btn" onClick={() => window.print()}><Printer size={16}/>{t(language, 'Print checklist')}</button></div></div>
    <p>{t(language, 'Checklist completion does not submit an application.')}</p>
    <div className="roadmap-completion"><span>{tasks.filter(task => done.includes(task.id)).length} / {tasks.length} {t(language, 'complete')}</span><progress aria-label={t(language, 'Roadmap progress')} max={Math.max(1, tasks.length)} value={tasks.filter(task => done.includes(task.id)).length}/></div>
    <div className="roadmap-timeline">{tasks.map((task, index) => <div className={`roadmap-task${done.includes(task.id) ? ' completed' : ''}`} key={task.id}>
      <span className="timeline-marker" aria-hidden="true">{done.includes(task.id) ? <Check size={15}/> : String(index + 1).padStart(2, '0')}</span><div className="timeline-content">
      <label><input type="checkbox" checked={done.includes(task.id)} onChange={() => setDone(items => items.includes(task.id) ? items.filter(id => id !== task.id) : [...items, task.id])}/><strong>{contentText(language, task.title, task.title_kn)}</strong></label>
      <span className={`priority ${task.priority}`}>{t(language, task.priority)}</span><p>{contentText(language, task.detail_en, task.detail_kn)}</p>
      {(task.evidence || task.page) && <SourceTag {...task}/>}</div></div>)}</div>
  </section>;
}
