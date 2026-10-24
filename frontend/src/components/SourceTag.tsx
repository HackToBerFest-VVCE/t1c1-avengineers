import { BookOpenText } from 'lucide-react';

export default function SourceTag({ evidence, page }: { evidence: string | null; page: number | null }) {
  if (!evidence && page === null) return <span className="no-evidence">No quoted evidence — verify manually</span>;
  return (
    <div className="source-tag" title="AI-proposed citation; verify against the original document">
      <BookOpenText size={13} aria-hidden="true" />
      <span>{page !== null ? `Page ${page}` : 'Page unconfirmed'}</span>
      {evidence ? <span className="source-quote">“{evidence}”</span> : null}
    </div>
  );
}
