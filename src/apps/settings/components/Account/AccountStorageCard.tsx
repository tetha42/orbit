'use client';

import React from 'react';
import { HardDrive, Laptop, LogOut, RotateCcw } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatBytes } from '@/core/data/format';
import ui from '@/core/ui/ui.module.css';
import styles from './Account.module.css';

interface AccountStorageCardProps {
	email: string;
	diskUsage?: { bytes: number; count: number; quotaBytes?: number };
	resetMessage: string | null;
	onLogout: () => void;
	onResetWorkspace: () => void;
}

export function AccountStorageCard({
	email,
	diskUsage,
	resetMessage,
	onLogout,
	onResetWorkspace,
}: AccountStorageCardProps) {
	const { t } = useI18n();

	return (
		<div className={styles.card}>
			<h4 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
				<HardDrive size={16} /> {t('settingsStorageTitle')}
			</h4>
			<p style={{ margin: 0, fontSize: '12px', opacity: 0.65 }}>
				{t('settingsStorageCardDesc')}
			</p>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '4px' }}>
				<div
					style={{
						padding: '12px',
						background: 'rgba(255, 255, 255, 0.03)',
						borderRadius: '8px',
						border: '1px solid var(--window-border)',
					}}
				>
					<div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
						<HardDrive size={12} color="var(--accent)" />
						<span>{t('membersColStorage')}</span>
					</div>
					<div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>
						{formatBytes(diskUsage?.bytes)}
						{diskUsage?.quotaBytes && diskUsage.quotaBytes > 0
							? ` / ${formatBytes(diskUsage.quotaBytes)}`
							: ''}
					</div>
					<div style={{ fontSize: '11.5px', opacity: 0.6, marginTop: '2px' }}>
						{diskUsage?.count ?? 0} {t('filesCountUnit')}
					</div>
				</div>

				<div
					style={{
						padding: '12px',
						background: 'rgba(255, 255, 255, 0.03)',
						borderRadius: '8px',
						border: '1px solid var(--window-border)',
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'space-between',
					}}
				>
					<div>
						<div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<Laptop size={12} />
							<span>{t('settingsActiveSession')}</span>
						</div>
						<div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
							{email}
						</div>
					</div>
					<div style={{ marginTop: '8px' }}>
						<button
							type="button"
							onClick={onLogout}
							className={ui.btn}
							style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
						>
							<LogOut size={12} /> {t('navLogout')}
						</button>
					</div>
				</div>
			</div>

			<div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
				<div>
					<div style={{ fontSize: '13.5px', fontWeight: 600 }}>{t('settingsResetWorkspace')}</div>
					<div style={{ fontSize: '12px', opacity: 0.65 }}>{t('settingsResetWorkspaceDesc')}</div>
				</div>
				<button
					type="button"
					onClick={onResetWorkspace}
					style={{
						background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
						color: 'var(--danger)',
						border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
						padding: '6px 14px',
						borderRadius: '6px',
						fontSize: '13px',
						fontWeight: 600,
						display: 'flex',
						alignItems: 'center',
						gap: '6px',
						cursor: 'pointer',
					}}
				>
					<RotateCcw size={14} />
					{t('dlgReset')}
				</button>
			</div>
			{resetMessage && (
				<div
					style={{
						fontSize: '12px',
						color: 'var(--success)',
						background: 'color-mix(in srgb, var(--success) 10%, transparent)',
						padding: '6px 10px',
						borderRadius: '6px',
					}}
				>
					{resetMessage}
				</div>
			)}
		</div>
	);
}
