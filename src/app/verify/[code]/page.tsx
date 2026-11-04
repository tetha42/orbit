import Link from 'next/link';
import { getCommunityProfile, getCertificateByCode } from '@/db';
import { ShieldCheck, ArrowLeft, XCircle } from 'lucide-react';
import { DocumentVerification } from './DocumentVerification';
import { CERTIFICATE_THEMES, inferCertificateCategory } from '@/lib/certificates';
import styles from './verify.module.css';

export default async function VerifyDetailPage({
	params,
}: {
	params: Promise<{ code: string }>;
}) {
	const { code: raw } = await params;
	const code = decodeURIComponent(raw);

	// Official documents carry their own code on the printout's QR.
	const document = /^(?:BEU-EVRAK|ORBIT-DOC)-(\d{5,9})$/.exec(code);
	if (document) return <DocumentVerification code={code} no={Number(document[1])} />;

	const [cert, club] = await Promise.all([getCertificateByCode(code), getCommunityProfile()]);

	const catId = cert ? inferCertificateCategory(cert.title, cert.category) : 'achievement';
	const theme = CERTIFICATE_THEMES[catId];
	const lang = (cert?.language ?? '').startsWith('tr') ? 'tr' : 'en';

	return (
		<main className={styles.viewport}>
			<div className={styles.panel}>
				<header className={styles.header}>
					<span>ORBIT // TETHA42</span>
					<span style={{ color: cert ? '#10b981' : '#ef4444' }}>
						{cert ? 'VERIFIED CREDENTIAL' : 'INVALID CODE'}
					</span>
				</header>

				<div className={styles.body}>
					{cert ? (
						<>
							<div className={styles.badgeRow}>
								<span className={`${styles.badge} ${styles.badgeValid}`}>
									<ShieldCheck size={13} />
									{lang === 'tr' ? 'Resmi ve Geçerli Belge' : 'Authentic Credential'}
								</span>
								<span className={styles.badge}>
									{theme.label[lang]}
								</span>
							</div>

							<h1 className={styles.title}>
								{lang === 'tr' ? 'Dijital Certificate Doğrulandı' : 'Digital Certificate Verified'}
							</h1>

							<p className={styles.subtitle}>
								{lang === 'tr'
									? `Bu sertifika, ${club.university} ${club.clubName} tarafından üretilmiş olup veritabanımızda doğrulanmıştır.`
									: `This credential was issued by ${club.university} ${club.clubName} and is cryptographically verified in our ledger.`}
							</p>

							<div className={styles.ledger}>
								<div className={styles.ledgerField}>
									<span className={styles.ledgerLabel}>
										{lang === 'tr' ? 'Certificate Sahibi' : 'Credential Recipient'}
									</span>
									<span className={styles.ledgerValue} style={{ fontSize: '16px' }}>
										{cert.userNameSurname}
									</span>
								</div>

								<div className={styles.ledgerField} style={{ paddingTop: '12px', borderTop: '1px solid #18181b' }}>
									<span className={styles.ledgerLabel}>
										{lang === 'tr' ? 'Program / Başlık' : 'Title & Program'}
									</span>
									<span className={styles.ledgerValue}>
										{cert.title}
									</span>
								</div>

								<div className={styles.ledgerField} style={{ paddingTop: '12px', borderTop: '1px solid #18181b' }}>
									<span className={styles.ledgerLabel}>
										{lang === 'tr' ? 'Başarı / Takdir Metni' : 'Achievement Citation'}
									</span>
									<span style={{ fontSize: '13px', color: '#a1a1aa', lineHeight: 1.5 }}>
										{cert.description ? cert.description : theme.completion[lang]}
									</span>
								</div>

								<div className={styles.ledgerRow}>
									<div className={styles.ledgerField}>
										<span className={styles.ledgerLabel}>
											{lang === 'tr' ? 'Doğrulama Kodu' : 'Verification Code'}
										</span>
										<span className={styles.ledgerMono}>
											{cert.verificationCode}
										</span>
									</div>

									<div className={styles.ledgerField} style={{ textAlign: 'right' }}>
										<span className={styles.ledgerLabel}>
											{lang === 'tr' ? 'Veriliş Tarihi' : 'Date of Issue'}
										</span>
										<span className={styles.ledgerValue}>
											{new Date(cert.issuanceDate).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US')}
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
									UNRECOGNIZED RECORD
								</span>
							</div>

							<h1 className={styles.title}>Invalid Verification Code</h1>

							<p className={styles.subtitle}>
								The verification code <strong>&ldquo;{code}&rdquo;</strong> does not match any active credential in the Orbit registry or has been revoked.
							</p>
						</>
					)}

					<div className={styles.footer}>
						<Link href="/verify" className={styles.backLink}>
							<ArrowLeft size={14} />
							<span>Verify Another Code</span>
						</Link>
						<Link href="/" className={styles.backLink}>
							<span>Return to Console</span>
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
