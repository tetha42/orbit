import Link from 'next/link';
import { ArrowLeft, FileCheck2, Lock, PenLine, XCircle } from 'lucide-react';
import { getDecisionByNumber } from '@/db';
import { belgeOzeti } from '@/lib/server/documentDigest';
import { evrakSayisi } from '@/lib/documents';
import styles from './verify.module.css';

const DOCUMENT_TYPES: Record<string, string> = {
	karar: 'Board Resolution',
	salon_tahsisi: 'Venue Allocation Request',
	etkinlik_izni: 'Event Authorization Petition',
	malzeme_talep: 'Equipment Requisition',
	ust_yazi: 'Official Cover Letter',
};

/**
 * Public verification ledger for an official Orbit document (`ORBIT-DOC-<no>` or `BEU-EVRAK-<no>`).
 */
export async function DocumentVerification({ kod, no }: { kod: string; no: number }) {
	const belge = await getDecisionByNumber(no);

	if (!belge) {
		return (
			<main className={styles.viewport}>
				<div className={styles.panel}>
					<header className={styles.header}>
						<span>ORBIT // TETHA42</span>
						<span style={{ color: '#ef4444' }}>UNVERIFIED</span>
					</header>
					<div className={styles.body}>
						<div className={styles.badgeRow}>
							<span className={`${styles.badge} ${styles.badgeInvalid}`}>
								<XCircle size={13} />
								RECORD NOT FOUND
							</span>
						</div>
						<h1 className={styles.title}>Document Not Found</h1>
						<p className={styles.subtitle}>
							No official community document matching reference <strong>{kod}</strong> exists in the ledger.
						</p>
						<div className={styles.footer}>
							<Link href="/verify" className={styles.backLink}>
								<ArrowLeft size={14} />
								<span>Verify Another Code</span>
							</Link>
							<Link href="/" className={styles.backLink}>
								<span>Orbit Workspace</span>
							</Link>
						</div>
					</div>
				</div>
			</main>
		);
	}

	const signed = Number(belge.kilitliMi) === 1;
	const ozet = belgeOzeti(belge);

	return (
		<main className={styles.viewport}>
			<div className={styles.panel}>
				<header className={styles.header}>
					<span>ORBIT // TETHA42</span>
					<span style={{ color: signed ? '#10b981' : '#f59e0b' }}>
						{signed ? 'SIGNED & LOCKED' : 'DRAFT RECORD'}
					</span>
				</header>

				<div className={styles.body}>
					<div className={styles.badgeRow}>
						<span className={`${styles.badge} ${signed ? styles.badgeValid : styles.badgeWarning}`}>
							{signed ? <Lock size={12} /> : <PenLine size={12} />}
							{signed ? 'Cryptographically Locked Document' : 'Registered — Pending Lock'}
						</span>
						<span className={styles.badge}>
							<FileCheck2 size={12} />
							{DOCUMENT_TYPES[belge.belgeTuru ?? 'karar'] ?? 'Official Document'}
						</span>
					</div>

					<h1 className={styles.title}>
						{DOCUMENT_TYPES[belge.belgeTuru ?? 'karar'] ?? 'Official Community Document'}
					</h1>
					<p className={styles.subtitle}>
						{signed
							? 'This document is registered in the Orbit ledger and is permanently sealed against modification.'
							: 'This document is registered in the Orbit ledger but has not yet been permanently sealed.'}
					</p>

					<div className={styles.ledger}>
						<div className={styles.ledgerRow} style={{ borderTop: 'none', paddingTop: 0 }}>
							<div className={styles.ledgerField}>
								<span className={styles.ledgerLabel}>Document Reference</span>
								<span className={styles.ledgerMono}>
									{evrakSayisi(Number(belge.kararNo))} · {kod}
								</span>
							</div>
							<div className={styles.ledgerField} style={{ textAlign: 'right' }}>
								<span className={styles.ledgerLabel}>Date of Issue</span>
								<span className={styles.ledgerValue}>
									{new Date(Number(belge.date)).toLocaleDateString('en-US', {
										day: 'numeric',
										month: 'short',
										year: 'numeric',
									})}
								</span>
							</div>
						</div>

						{Number(belge.kamuyaAcikMi) === 1 ? (
							<div className={styles.ledgerField} style={{ paddingTop: '12px', borderTop: '1px solid #18181b' }}>
								<span className={styles.ledgerLabel}>Subject</span>
								<span className={styles.ledgerValue}>{belge.baslik}</span>
							</div>
						) : (
							<div style={{ paddingTop: '12px', borderTop: '1px solid #18181b', fontSize: '12.5px', color: '#a1a1aa' }}>
								Full document contents are restricted to authorized board members.
							</div>
						)}

						<div className={styles.ledgerField} style={{ paddingTop: '12px', borderTop: '1px solid #18181b' }}>
							<span className={styles.ledgerLabel}>Content Digest (SHA-256 Fingerprint)</span>
							<span className={styles.ledgerMono}>{ozet}</span>
							<span style={{ fontSize: '11.5px', color: '#71717a', marginTop: '4px' }}>
								Compare this digest with the fingerprint printed on the physical or PDF document.
							</span>
						</div>
					</div>

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
