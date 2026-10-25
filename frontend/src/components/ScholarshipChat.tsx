import { useRef, useState } from 'react';
import { LoaderCircle, RotateCcw, Send } from 'lucide-react';
import type { ChatAnswer, Language } from '../lib/types';
import { askScholarship, resetChat } from '../lib/api';
import { friendlyError, t } from '../lib/i18n';
import SourceTag from './SourceTag';

interface Message { role: 'user' | 'assistant'; text: string; result?: ChatAnswer; language: Language }
export default function ScholarshipChat({ sessionId, language }: { sessionId: string; language: Language }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<{ question: string; language: Language } | null>(null);
  const busy = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const send = async (text: string, retryLanguage?: Language) => {
    if (!text.trim() || busy.current) return;
    busy.current = true;
    const outputLanguage = retryLanguage ?? language;
    setPending(true); setError('');
    if (!retryLanguage) setMessages(m => [...m, { role: 'user', text, language: outputLanguage }]);
    setQuestion('');
    try {
      const result = await askScholarship(sessionId, text, outputLanguage);
      setMessages(m => [...m, { role: 'assistant', text: result.answer, result, language: outputLanguage }]);
      setRetry(null);
      window.setTimeout(() => end.current?.scrollIntoView?.({ block: 'nearest' }), 50);
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); setRetry({ question: text, language: outputLanguage }); }
    finally { setPending(false); busy.current = false; }
  };
  const reset = async () => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await resetChat(sessionId); setMessages([]); setRetry(null); setQuestion(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
    finally { setPending(false); busy.current = false; }
  };
  return <section className="scholarship-chat" aria-label={t(language, 'Scholarship assistant')}>
    <div className="chat-heading"><h4>{t(language, 'Scholarship assistant')}</h4><button className="icon-btn" title={t(language, 'Reset chat')} aria-label={t(language, 'Reset chat')} disabled={pending} onClick={() => void reset()}><RotateCcw size={17}/></button></div>
    <div className="chat-messages" role="log" aria-live="polite">{messages.map((message, index) => <article key={index} className={`chat-message ${message.role}`} lang={message.language}>
      <strong>{message.role === 'user' ? (message.language === 'kn' ? 'ನೀವು' : 'You') : 'Gemma 4'}</strong><p>{message.text}</p>
      {message.result && <>{message.result.citations.map((citation, i) => <SourceTag key={i} {...citation}/>)}
        {message.result.suggestions.length > 0 && <><b>{t(message.language, 'General suggestions')}</b><ul>{message.result.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
        {message.result.missing_information.length > 0 && <><b>{t(message.language, 'Missing information')}</b><ul>{message.result.missing_information.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
        <small>{message.result.disclaimer}</small></>}
    </article>)}<div ref={end}/></div>
    {!messages.length && <div className="suggested-questions">{['Why do I need verification?', 'What documents should I prepare?', 'What is the age limit?'].map(q => <button key={q} disabled={pending} onClick={() => void send(t(language, q))}>{t(language, q)}</button>)}</div>}
    {pending && <p role="status"><LoaderCircle className="spinning" size={16}/> {t(language, 'Preparing an answer')}</p>}
    {error && <div role="alert" className="inline-notice error">{friendlyError(language, error)}{retry && <button disabled={pending} onClick={() => void send(retry.question, retry.language)}>{t(language, 'Retry')}</button>}</div>}
    <form className="chat-composer" onSubmit={e => { e.preventDefault(); void send(question); }}>
      <label className="sr-only" htmlFor="chat-question">{t(language, 'Ask about this notice')}</label>
      <textarea id="chat-question" value={question} maxLength={2000} rows={2} disabled={pending} onChange={e => setQuestion(e.target.value)} placeholder={t(language, 'Ask about this notice')}/>
      <button type="submit" className="icon-btn" disabled={pending || !question.trim()} title={t(language, 'Send question')} aria-label={t(language, 'Send question')}><Send size={20}/></button>
    </form>
  </section>;
}
