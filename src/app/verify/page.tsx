import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { translate } from '@/lib/i18n';
import { DEFAULT_LOCALE, normalizeLocale } from '@/locales/registry';
import styles from './[code]/verify.module.css';

/**
 * Certificate and official document verification lookup page (`/verify`).
 */
export default async function VerifyIndexPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | undefined>>;
}) {
	const params = await searchParams;
	const targetCode = (params.code || '').trim();

	if (targetCode) {
		redirect(`/verify/${encodeURIComponent(targetCode)}`);
	}

	const hdrs = await headers();
	const lang = normalizeLocale(params.lang ?? hdrs.get('accept-language')?.split(',')[0], DEFAULT_LOCALE);
	const t = (key: string) => translate(lang, key);

	return (
		<main className={styles.viewport}>
			<div className={styles.panel}>
				<header className={styles.header}>
					<span>ORBIT // TETHA42</span>
					<span style={{ color: '#fafafa' }}>{t('verifyHeaderTag')}</span>
				</header>

				<div className={styles.body}>
					<div className={styles.badgeRow}>
						<span className={styles.badge}>
							<ShieldCheck size={13} />
							{t('verifyPublicBadge')}
						</span>
					</div>

					<h1 className={styles.title}>{t('verifyLookupTitle')}</h1>
					<p className={styles.subtitle}>{t('verifyLookupDesc')}</p>

					<form method="GET" action="/verify" className={styles.form}>
						<input
							type="text"
							name="code"
							required
							autoFocus
							placeholder={t('verifyLookupPh')}
							aria-label={t('verifyLookupAria')}
							className={styles.input}
						/>
						<button type="submit" className={styles.submitBtn}>
							{t('verifyLookupSubmit')}
						</button>
					</form>

					<div className={styles.footer}>
						<Link href="/" className={styles.backLink}>
							<ArrowLeft size={14} />
							<span>{t('ciReturn')}</span>
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
