import Link from 'next/link';
import { ArrowLeft, FileCheck2, Lock, PenLine, XCircle } from 'lucide-react';
import { getDecisionByNumber } from '@/db';
import { documentSummary } from '@/server/documentDigest';
import { documentCount } from '@/lib/documents';
import styles from './verify.module.css';

const DOCUMENT_TYPES: Record<string, string> = {
	decision: 'Board Resolution',
	hall_allocation: 'Venue Allocation Request',
	event_permission: 'Event Authorization Petition',
	material_request: 'Equipment Requisition',
	top_text: 'Official Cover Letter',
};

/**
 * Public verification ledger for an official Orbit document (`ORBIT-DOC-<no>` or `BEU-EVRAK-<no>`).
 */
export async function DocumentVerification({ code, no }: { code: string; no: number }) {
	const document = await getDecisionByNumber(no);

	if (!document) {
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
							No official community document matching reference <strong>{code}</strong> exists in the ledger.
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

	const signed = Number(document.isLocked) === 1;
	const summary = documentSummary(document);

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
							{DOCUMENT_TYPES[document.documentType ?? 'resolution'] ?? 'Official Document'}
						</span>
					</div>

					<h1 className={styles.title}>
						{DOCUMENT_TYPES[document.documentType ?? 'resolution'] ?? 'Official Community Document'}
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
									{documentCount(Number(document.decisionNo))} · {code}
								</span>
							</div>
							<div className={styles.ledgerField} style={{ textAlign: 'right' }}>
								<span className={styles.ledgerLabel}>Date of Issue</span>
								<span className={styles.ledgerValue}>
									{new Date(Number(document.date)).toLocaleDateString('en-US', {
										day: 'numeric',
										month: 'short',
										year: 'numeric',
									})}
								</span>
							</div>
						</div>

						{Number(document.isPublicOpen) === 1 ? (
							<div className={styles.ledgerField} style={{ paddingTop: '12px', borderTop: '1px solid #18181b' }}>
								<span className={styles.ledgerLabel}>Subject</span>
								<span className={styles.ledgerValue}>{document.title}</span>
							</div>
						) : (
							<div style={{ paddingTop: '12px', borderTop: '1px solid #18181b', fontSize: '12.5px', color: '#a1a1aa' }}>
								Full document contents are restricted to authorized board members.
							</div>
						)}

						<div className={styles.ledgerField} style={{ paddingTop: '12px', borderTop: '1px solid #18181b' }}>
							<span className={styles.ledgerLabel}>Content Digest (SHA-256 Fingerprint)</span>
							<span className={styles.ledgerMono}>{summary}</span>
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
