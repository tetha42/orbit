'use client';

import React from 'react';
import { Clock, FolderPlus, HardDrive, Shield, Star, Trash2, Upload, Users } from 'lucide-react';
import { formatBytes } from '@/core/data/format';
import { useI18n } from '@/core/i18n';
import type { DriveViewMode } from '@/domains/drive/types';
import { fill } from '@/lib/text';
import type { UserStorageBreakdown } from '@/server/storage/quota';

interface DriveSidebarProps {
	view: DriveViewMode;
	showQuotas: boolean;
	canManage: boolean;
	storage: UserStorageBreakdown | null;
	onSelectView: (v: DriveViewMode) => void;
	onSelectQuotas: () => void;
	onTriggerUpload: () => void;
	onToggleNewFolder: () => void;
}

export function DriveSidebar({
	view,
	showQuotas,
	canManage,
	storage,
	onSelectView,
	onSelectQuotas,
	onTriggerUpload,
	onToggleNewFolder,
}: DriveSidebarProps) {
	const { t } = useI18n();
	const navItems: Array<{ id: DriveViewMode; label: string; icon: React.ReactNode }> = [
		{ id: 'my', label: t('driveMyDrive'), icon: <HardDrive size={15} /> },
		{ id: 'shared', label: t('driveSharedWithMe'), icon: <Users size={15} /> },
		{ id: 'starred', label: t('driveStarred'), icon: <Star size={15} /> },
		{ id: 'recent', label: t('driveRecent'), icon: <Clock size={15} /> },
		{ id: 'trash', label: t('driveTrash'), icon: <Trash2 size={15} /> },
	];

	const usedBytes = storage?.usedBytes ?? 0;
	const quotaBytes = storage?.quotaBytes ?? 512 * 1024 * 1024;
	const isUnlimited = storage?.isUnlimited ?? quotaBytes === -1;
	const usagePct = isUnlimited || quotaBytes <= 0 ? 12 : Math.min(100, Math.round((usedBytes / quotaBytes) * 100));

	return (
		<div
			style={{
				width: '215px',
				borderRight: '1px solid var(--border-subtle)',
				padding: '12px',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				gap: '12px',
				flexShrink: 0,
			}}
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
				<div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
					<button
						type="button"
						onClick={onTriggerUpload}
						style={{
							flex: 1,
							background: 'var(--accent)',
							color: 'var(--text-on-accent)',
							border: 'none',
							borderRadius: '8px',
							padding: '7px 10px',
							fontSize: '12px',
							fontWeight: 600,
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: '6px',
						}}
					>
						<Upload size={14} /> {t('driveUploadFiles')}
					</button>
					<button
						type="button"
						onClick={onToggleNewFolder}
						title={t('driveNewFolder')}
						style={{
							background: 'var(--surface-hover)',
							color: 'var(--text-primary)',
							border: '1px solid var(--border-subtle)',
							borderRadius: '8px',
							padding: '7px 9px',
							cursor: 'pointer',
						}}
					>
						<FolderPlus size={15} />
					</button>
				</div>

				{navItems.map((n) => {
					const active = !showQuotas && view === n.id;
					return (
						<button
							key={n.id}
							type="button"
							onClick={() => onSelectView(n.id)}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								padding: '8px 10px',
								borderRadius: '8px',
								border: 'none',
								background: active ? 'var(--accent-subtle)' : 'transparent',
								color: active ? 'var(--accent)' : 'var(--text-primary)',
								fontWeight: active ? 600 : 500,
								fontSize: '12.5px',
								cursor: 'pointer',
								textAlign: 'left',
							}}
						>
							{n.icon}
							<span>{n.label}</span>
						</button>
					);
				})}

				{canManage && (
					<button
						type="button"
						onClick={onSelectQuotas}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							padding: '8px 10px',
							borderRadius: '8px',
							border: 'none',
							background: showQuotas ? 'var(--accent-subtle)' : 'transparent',
							color: showQuotas ? 'var(--accent)' : 'var(--text-primary)',
							fontWeight: showQuotas ? 600 : 500,
							fontSize: '12.5px',
							cursor: 'pointer',
							textAlign: 'left',
							marginTop: '4px',
						}}
					>
						<Shield size={15} />
						<span>{t('driveQuotasTab')}</span>
					</button>
				)}
			</div>

			<div
				style={{
					padding: '10px',
					borderRadius: '10px',
					background: 'var(--surface-hover)',
					border: '1px solid var(--border-subtle)',
					display: 'flex',
					flexDirection: 'column',
					gap: '6px',
				}}
			>
				<div style={{ fontSize: '11.5px', fontWeight: 600 }}>{t('driveStorageHeading')}</div>
				<div style={{ height: '6px', borderRadius: '999px', background: 'var(--border-subtle)', overflow: 'hidden' }}>
					<div style={{ width: `${usagePct}%`, height: '100%', background: 'var(--accent)' }} />
				</div>
				<div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
					{fill(t('driveStorageUsedOf'), {
						used: formatBytes(usedBytes),
						quota: isUnlimited ? t('driveQuotaUnlimited') : formatBytes(quotaBytes),
					})}
				</div>
				{storage && (
					<div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
						<span>{t('driveAppDrive')}: {formatBytes(storage.byApp.drive)}</span>
						<span>{t('driveAppNotes')}: {formatBytes(storage.byApp.notes)}</span>
						<span>{t('driveAppChat')}: {formatBytes(storage.byApp.chat)}</span>
					</div>
				)}
			</div>
		</div>
	);
}
