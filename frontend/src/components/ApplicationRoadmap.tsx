import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type { Language, RoadmapTask } from '../lib/types';
import { t } from '../lib/i18n';
import SourceTag from './SourceTag';

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
      ...tasks.map(task => `[${done.includes(task.id) ? 'x' : ' '}] ${t(language, task.priority)}: ${language === 'kn' ? task.title_kn || task.title : task.title}\n${language === 'kn' ? task.detail_kn : task.detail_en}${task.page ? `\n${t(language, 'Page')} ${task.page}: ${task.evidence ?? ''}` : ''}`)].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'FormBridge-Application-Roadmap.txt'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };
  return <section className="application-roadmap"><div className="documents-header"><h4>{t(language, 'Your next steps')}</h4><div className="roadmap-actions"><button className="export-btn" onClick={download}><Download size={16}/>{t(language, 'Download checklist')}</button><button className="export-btn" onClick={() => window.print()}><Printer size={16}/>{t(language, 'Print checklist')}</button></div></div>
    <p>{t(language, 'Checklist completion does not submit an application.')}</p>
    {tasks.map(task => <div className={`roadmap-task${done.includes(task.id) ? ' completed' : ''}`} key={task.id}>
      <label><input type="checkbox" checked={done.includes(task.id)} onChange={() => setDone(items => items.includes(task.id) ? items.filter(id => id !== task.id) : [...items, task.id])}/><strong>{language === 'kn' ? task.title_kn || task.title : task.title}</strong></label>
      <span className={`priority ${task.priority}`}>{t(language, task.priority)}</span><p>{language === 'kn' ? task.detail_kn : task.detail_en}</p>
      {(task.evidence || task.page) && <SourceTag {...task}/>}</div>)}
  </section>;
}
