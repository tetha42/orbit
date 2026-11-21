import Link from 'next/link';
import { headers } from 'next/headers';
import { getCommunityProfile, getCertificateByCode } from '@/db';
import { ShieldCheck, ArrowLeft, XCircle } from 'lucide-react';
import { DocumentVerification } from './DocumentVerification';
import { CERTIFICATE_THEMES, inferCertificateCategory } from '@/lib/certificates';
import { translate } from '@/lib/i18n';
import { fill } from '@/lib/text';
import { DEFAULT_LOCALE, getLocaleDefinition, normalizeLocale } from '@/locales/registry';
import { initWasmEngine, verifyCertificateFormatWasm } from '@/lib/wasm/securityEngine';
import styles from './verify.module.css';

export default async function VerifyDetailPage({
	params,
}: {
	params: Promise<{ code: string }>;
}) {
	const { code: raw } = await params;
	const code = decodeURIComponent(raw);
	const hdrs = await headers();
	const reqLang = normalizeLocale(hdrs.get('accept-language')?.split(',')[0], DEFAULT_LOCALE);

	// Validate format with WASM engine
	await initWasmEngine();
	const format = verifyCertificateFormatWasm(code);

	// Official documents carry their own code on the printout's QR.
	if (format.valid && format.kind === 'official_doc') {
		const document = /^(?:BEU-EVRAK|BEU-DOC|ORBIT-DOC)-(\d{5,9})$/.exec(code.trim().toUpperCase());
		if (document) return <DocumentVerification code={code} no={Number(document[1])} lang={reqLang} />;
	}

	const [cert, club] = format.valid
		? await Promise.all([getCertificateByCode(code), getCommunityProfile()])
		: [null, null];

	const catId = cert ? inferCertificateCategory(cert.title, cert.category) : 'achievement';
	const theme = CERTIFICATE_THEMES[catId];
	const lang = normalizeLocale(cert?.language, reqLang);
	const dateLocale = getLocaleDefinition(lang).dateLocale;
	const t = (key: string) => translate(lang, key);
	const [invalidPrefix, invalidSuffix] = fill(t('verifyInvalidDesc'), { code: '__CODE__' }).split('__CODE__');

	return (
		<main className={styles.viewport}>
			<div className={styles.panel}>
				<header className={styles.header}>
					<span>ORBIT // TETHA42</span>
					<span style={{ color: cert ? 'var(--success)' : 'var(--danger)' }}>
						{cert ? t('verifyStatusValid') : t('verifyStatusInvalid')}
					</span>
				</header>

				<div className={styles.body}>
					{cert ? (
						<>
							<div className={styles.badgeRow}>
								<span className={`${styles.badge} ${styles.badgeValid}`}>
									<ShieldCheck size={13} />
									{translate(lang, 'verifyBadgeAuthentic')}
								</span>
								<span className={styles.badge}>
									{theme.label[lang]}
								</span>
							</div>

							<h1 className={styles.title}>{translate(lang, 'verifyTitle')}</h1>

							<p className={styles.subtitle}>
								{fill(translate(lang, 'verifySubtitle'), {
									university: club.university,
									clubName: club.clubName,
								})}
							</p>

							<div className={styles.ledger}>
								<div className={styles.ledgerField}>
									<span className={styles.ledgerLabel}>{translate(lang, 'verifyRecipient')}</span>
									<span className={styles.ledgerValue} style={{ fontSize: '16px' }}>
										{cert.userName}
									</span>
								</div>

								<div className={styles.ledgerField} style={{ paddingTop: '12px', borderTop: '1px solid #18181b' }}>
									<span className={styles.ledgerLabel}>{translate(lang, 'verifyProgram')}</span>
									<span className={styles.ledgerValue}>
										{cert.title}
									</span>
								</div>

								<div className={styles.ledgerField} style={{ paddingTop: '12px', borderTop: '1px solid #18181b' }}>
									<span className={styles.ledgerLabel}>{translate(lang, 'verifyCitation')}</span>
									<span style={{ fontSize: '13px', color: '#a1a1aa', lineHeight: 1.5 }}>
										{cert.description ? cert.description : theme.completion[lang]}
									</span>
								</div>

								<div className={styles.ledgerRow}>
									<div className={styles.ledgerField}>
										<span className={styles.ledgerLabel}>{translate(lang, 'certsCode')}</span>
										<span className={styles.ledgerMono}>
											{cert.verificationCode}
										</span>
									</div>

									<div className={styles.ledgerField} style={{ textAlign: 'right' }}>
										<span className={styles.ledgerLabel}>{translate(lang, 'verifyIssueDate')}</span>
										<span className={styles.ledgerValue}>
											{new Date(cert.issuanceDate).toLocaleDateString(dateLocale)}
										</span>
									</div>
								</div>
							</div>
						</>
					) : (
						<>
							<div className={styles.badgeRow}>
								<span className={`${styles.badge} ${styles.badgeInvalid}`}>
									<XCircle size={13} />
									{t('verifyUnrecognizedBadge')}
								</span>
							</div>

							<h1 className={styles.title}>{t('verifyInvalidTitle')}</h1>

							<p className={styles.subtitle}>
								{invalidPrefix}
								<strong>&ldquo;{code}&rdquo;</strong>
								{invalidSuffix}
							</p>
						</>
					)}

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
