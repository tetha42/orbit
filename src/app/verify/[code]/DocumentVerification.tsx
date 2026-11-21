import Link from 'next/link';
import { ArrowLeft, FileCheck2, Lock, PenLine, XCircle } from 'lucide-react';
import { getDecisionByNumber } from '@/db';
import { documentSummary } from '@/server/documentDigest';
import { documentCount } from '@/lib/documents';
import { translate, type Language } from '@/lib/i18n';
import { fill } from '@/lib/text';
import { DEFAULT_LOCALE, getLocaleDefinition } from '@/locales/registry';
import styles from './verify.module.css';

const DOCUMENT_TYPE_KEYS: Record<string, string> = {
	resolution: 'verifyDocResolution',
	hall_allocation: 'verifyDocHall',
	event_permission: 'verifyDocEvent',
	material_request: 'verifyDocMaterial',
	cover_letter: 'verifyDocCover',
};

/**
 * Public verification ledger for an official Orbit document (`ORBIT-DOC-<no>` or `BEU-EVRAK-<no>`).
 */
export async function DocumentVerification({
	code,
	no,
	lang = DEFAULT_LOCALE,
}: {
	code: string;
	no: number;
	lang?: Language;
}) {
	const t = (key: string) => translate(lang, key);
	const document = await getDecisionByNumber(no);

	if (!document) {
		const [nfPrefix, nfSuffix] = fill(t('verifyDocNotFoundDesc'), { code: '__CODE__' }).split('__CODE__');
		return (
			<main className={styles.viewport}>
				<div className={styles.panel}>
					<header className={styles.header}>
						<span>ORBIT // TETHA42</span>
						<span style={{ color: 'var(--danger)' }}>{t('verifyDocUnverified')}</span>
					</header>
					<div className={styles.body}>
						<div className={styles.badgeRow}>
							<span className={`${styles.badge} ${styles.badgeInvalid}`}>
								<XCircle size={13} />
								{t('verifyDocNotFoundBadge')}
							</span>
						</div>
						<h1 className={styles.title}>{t('verifyDocNotFoundTitle')}</h1>
						<p className={styles.subtitle}>
							{nfPrefix}
							<strong>{code}</strong>
							{nfSuffix}
						</p>
						<div className={styles.footer}>
							<Link href="/verify" className={styles.backLink}>
								<ArrowLeft size={14} />
								<span>{t('verifyAnotherCode')}</span>
							</Link>
							<Link href="/" className={styles.backLink}>
								<span>{t('verifyReturnConsole')}</span>
							</Link>
						</div>
					</div>
				</div>
			</main>
		);
	}

	const signed = Number(document.isLocked) === 1;
	const summary = documentSummary(document);
	const typeKey = DOCUMENT_TYPE_KEYS[document.documentType ?? 'resolution'] ?? 'verifyDocDefault';
	const docTypeLabel = t(typeKey);
	const dateLocale = getLocaleDefinition(lang).dateLocale;

	return (
		<main className={styles.viewport}>
			<div className={styles.panel}>
				<header className={styles.header}>
					<span>ORBIT // TETHA42</span>
					<span style={{ color: signed ? 'var(--success)' : 'var(--warning)' }}>
						{signed ? t('verifyDocSignedTag') : t('verifyDocDraftTag')}
					</span>
				</header>

				<div className={styles.body}>
					<div className={styles.badgeRow}>
						<span className={`${styles.badge} ${signed ? styles.badgeValid : styles.badgeWarning}`}>
							{signed ? <Lock size={12} /> : <PenLine size={12} />}
							{signed ? t('verifyDocLockedBadge') : t('verifyDocPendingBadge')}
						</span>
						<span className={styles.badge}>
							<FileCheck2 size={12} />
							{docTypeLabel}
						</span>
					</div>

					<h1 className={styles.title}>{docTypeLabel}</h1>
					<p className={styles.subtitle}>{signed ? t('verifyDocLockedDesc') : t('verifyDocPendingDesc')}</p>

					<div className={styles.ledger}>
						<div className={styles.ledgerRow} style={{ borderTop: 'none', paddingTop: 0 }}>
							<div className={styles.ledgerField}>
								<span className={styles.ledgerLabel}>{t('verifyDocRefLabel')}</span>
								<span className={styles.ledgerMono}>
									{documentCount(Number(document.referenceNumber))} · {code}
								</span>
							</div>
							<div className={styles.ledgerField} style={{ textAlign: 'right' }}>
								<span className={styles.ledgerLabel}>{t('verifyIssueDate')}</span>
								<span className={styles.ledgerValue}>
									{new Date(Number(document.date)).toLocaleDateString(dateLocale, {
										day: 'numeric',
										month: 'short',
										year: 'numeric',
									})}
								</span>
							</div>
						</div>

						{Number(document.isPublic) === 1 ? (
							<div className={styles.ledgerField} style={{ paddingTop: '12px', borderTop: '1px solid #18181b' }}>
								<span className={styles.ledgerLabel}>{t('verifyDocSubjectLabel')}</span>
								<span className={styles.ledgerValue}>{document.title}</span>
							</div>
						) : (
							<div style={{ paddingTop: '12px', borderTop: '1px solid #18181b', fontSize: '12.5px', color: '#a1a1aa' }}>
								{t('verifyDocRestrictedNotice')}
							</div>
						)}

						<div className={styles.ledgerField} style={{ paddingTop: '12px', borderTop: '1px solid #18181b' }}>
							<span className={styles.ledgerLabel}>{t('verifyDocDigestLabel')}</span>
							<span className={styles.ledgerMono}>{summary}</span>
							<span style={{ fontSize: '11.5px', color: '#71717a', marginTop: '4px' }}>{t('verifyDocDigestHint')}</span>
						</div>
					</div>

					<div className={styles.footer}>
						<Link href="/verify" className={styles.backLink}>
							<ArrowLeft size={14} />
							<span>{t('verifyAnotherCode')}</span>
						</Link>
						<Link href="/" className={styles.backLink}>
							<span>{t('verifyReturnConsole')}</span>
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
