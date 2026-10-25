import { BadgeCheck, CircleHelp, ShieldAlert } from 'lucide-react';
import type { Language, Verification } from '../lib/types';
import { t } from '../lib/i18n';

export default function SourceVerificationBadge({ verification, language }: { verification?: Verification | null; language: Language }) {
  const status = verification?.status ?? 'not_available';
  const label = { verified: 'Verified quotation', partial_match: 'Partial match', unverified: 'Unverified quotation', not_available: 'Text verification unavailable' }[status];
  const Icon = status === 'verified' ? BadgeCheck : status === 'unverified' ? ShieldAlert : CircleHelp;
  return <span className={`verification-badge ${status}`} title={language === 'en' ? verification?.reason : t(language, label)}><Icon size={13}/>{t(language, label)}</span>;
}
