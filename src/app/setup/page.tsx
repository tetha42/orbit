'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FirstRunSetupWizard } from '@/components/Auth/FirstRunSetupWizard';
import type { KurulumYaniti } from '@/lib/kurulum';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import styles from '@/components/Auth/VsCodeSetup.module.css';

export default function SetupPage() {
	const [status, setStatus] = useState<KurulumYaniti | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch('/api/setup', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				setStatus(data);
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, []);

	if (loading) {
		return (
			<div className={styles.shell}>
				<div className="boot-splash__spinner" style={{ width: '36px', height: '36px' }} />
			</div>
		);
	}

	if (status?.hazir) {
		return (
			<main className={styles.shell}>
				<div className={styles.workbench} style={{ maxWidth: '640px', height: 'auto', padding: '16px' }}>
					{/* Content */}
					<div style={{ padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
						<div className={styles.alertSuccess}>
							<CheckCircle2 size={20} style={{ flexShrink: 0 }} />
							<div>
								<strong style={{ color: '#ffffff', fontSize: '14px', display: 'block' }}>
									Workspace Already Initialized
								</strong>
								<span style={{ fontSize: '12.5px', color: '#9cdcfe' }}>
									Orbit Community OS is configured and operational.
								</span>
							</div>
						</div>

						<p style={{ margin: 0, fontSize: '13px', color: '#a1a1aa', lineHeight: 1.6 }}>
							All database schemas, encryption secrets, and administrator credentials are active. Proceed to the authentication portal to sign in.
						</p>

						<div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px' }}>
							<Link
								href="/"
								className={styles.btnPrimary}
								style={{ height: '34px', padding: '0 18px', textDecoration: 'none' }}
							>
								<span>Proceed to Workspace</span>
								<ArrowRight size={14} />
							</Link>
						</div>
					</div>
				</div>
			</main>
		);
	}

	return (
		<main className={styles.shell}>
			{/* eslint-disable-next-line @next/next/no-location-assign-relative-destination */}
			<FirstRunSetupWizard onComplete={() => { window.location.href = '/'; }} />
		</main>
	);
}
