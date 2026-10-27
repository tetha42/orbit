import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import styles from './[kod]/verify.module.css';

/**
 * Certificate & official document verification lookup page (`/verify` and `/dogrula`).
 */
export default async function VerifyIndexPage({
	searchParams,
}: {
	searchParams: Promise<{ kod?: string; code?: string }>;
}) {
	const params = await searchParams;
	const targetCode = (params.code || params.kod || '').trim();

	if (targetCode) {
		redirect(`/verify/${encodeURIComponent(targetCode)}`);
	}

	return (
		<main className={styles.viewport}>
			<div className={styles.panel}>
				<header className={styles.header}>
					<span>ORBIT // TETHA42</span>
					<span style={{ color: '#fafafa' }}>CREDENTIAL LEDGER</span>
				</header>

				<div className={styles.body}>
					<div className={styles.badgeRow}>
						<span className={styles.badge}>
							<ShieldCheck size={13} />
							PUBLIC VERIFICATION
						</span>
					</div>

					<h1 className={styles.title}>Verify Credential or Document</h1>
					<p className={styles.subtitle}>
						Enter the verification code printed on an Orbit digital certificate or official board resolution to validate its cryptographic authenticity.
					</p>

					<form method="GET" action="/verify" className={styles.form}>
						<input
							type="text"
							name="kod"
							required
							autoFocus
							placeholder="e.g. ORBIT-2026-CTF-8941 or ORBIT-DOC-2026001"
							aria-label="Verification code"
							className={styles.input}
						/>
						<button type="submit" className={styles.submitBtn}>
							Verify Record
						</button>
					</form>

					<div className={styles.footer}>
						<Link href="/" className={styles.backLink}>
							<ArrowLeft size={14} />
							<span>Return to Orbit Workspace</span>
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
