'use client';

import React, { useRef, useState } from 'react';
import { FileText, Folder, RotateCcw, Share2, Star, Trash2 } from 'lucide-react';
import { useAppCommand } from '@/core/commands';
import { formatBytes } from '@/core/data/format';
import { useI18n } from '@/core/i18n';
import { openMediaAttachment } from '@/core/mediaViewer';
import { useSession } from '@/core/session';
import { useWindowActions } from '@/core/windows';
import { fill } from '@/lib/text';
import s from './Drive.module.css';
import { DriveQuotasPanel } from './DriveQuotasPanel';
import { DriveShareModal } from './DriveShareModal';
import { DriveSidebar } from './DriveSidebar';
import { DriveToolbar } from './DriveToolbar';
import { useDrive } from './useDrive';

export function DriveApp() {
	const { t } = useI18n();
	const { canManageApp } = useSession();
	const { openApp } = useWindowActions();
	const canManage = canManageApp('drive');
	const drive = useDrive();

	const [showQuotas, setShowQuotas] = useState(false);
	const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
	const [shareTarget, setShareTarget] = useState<{ id: string; name: string; kind: 'item' | 'folder' } | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useAppCommand('drive', (cmd) => {
		if (cmd === 'drive-new-folder') setIsNewFolderOpen(true);
	});

	return (
		<div
			onDragOver={(e) => e.preventDefault()}
			onDrop={(e) => {
				e.preventDefault();
				if (e.dataTransfer?.files?.length) void drive.uploadFiles(e.dataTransfer.files);
			}}
			style={{ display: 'flex', height: '100%', width: '100%', color: 'var(--text-primary)', background: 'var(--window-bg)' }}
		>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				style={{ display: 'none' }}
				onChange={(e) => {
					if (e.target.files?.length) void drive.uploadFiles(e.target.files);
					e.target.value = '';
				}}
			/>
			<DriveSidebar
				view={drive.view}
				showQuotas={showQuotas}
				canManage={canManage}
				storage={drive.storage}
				onSelectView={(v) => { setShowQuotas(false); drive.switchView(v); }}
				onSelectQuotas={() => setShowQuotas(true)}
				onTriggerUpload={() => fileInputRef.current?.click()}
				onToggleNewFolder={() => setIsNewFolderOpen((v) => !v)}
			/>

			{showQuotas ? (
				<DriveQuotasPanel />
			) : (
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
					<DriveToolbar
						breadcrumbs={drive.breadcrumbs}
						query={drive.query}
						isNewFolderOpen={isNewFolderOpen}
						onOpenFolder={drive.openFolder}
						onQueryChange={drive.setQuery}
						onCreateFolder={drive.createFolder}
						onCloseNewFolder={() => setIsNewFolderOpen(false)}
					/>

					<div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
						{drive.folders.map((f) => {
							const delTitle = drive.view === 'trash' ? t('driveActionDeleteForever') : t('driveActionTrash');
							return (
								<div key={f.id} className={s.rowCard}>
									<button type="button" onClick={() => drive.openFolder({ id: f.id, name: f.name })} className={s.itemBtn}>
										<Folder size={16} color="var(--accent)" />
										<span style={{ fontWeight: 600 }}>{f.name}</span>
									</button>
									<div style={{ display: 'flex', gap: '6px' }}>
										<button
											type="button"
											onClick={() => setShareTarget({ id: f.id, name: f.name, kind: 'folder' })}
											title={t('driveActionShare')}
											className={s.iconBtn}
										>
											<Share2 size={14} />
										</button>
										<button
											type="button"
											onClick={() => void drive.deleteFolder(f.id, drive.view === 'trash')}
											title={delTitle}
											className={s.iconBtn}
											style={{ color: 'var(--danger)' }}
										>
											<Trash2 size={14} />
										</button>
									</div>
								</div>
							);
						})}

						{drive.items.map((item) => {
							const fileUrl = `/api/uploads/${encodeURIComponent(item.fileId)}`;
							const ownerNote = item.ownerName ? ` · ${fill(t('driveOwnerBy'), { name: item.ownerName })}` : '';
							const starTitle = item.isStarred ? t('driveActionUnstar') : t('driveActionStar');
							const starColor = item.isStarred ? 'var(--accent)' : 'var(--text-secondary)';
							return (
								<div key={item.id} className={s.rowCard}>
									<button
										type="button"
										onClick={() => {
											if (openMediaAttachment({ name: item.displayName, url: fileUrl, size: item.sizeBytes, type: item.mimeType })) {
												openApp('mediaviewer');
											}
										}}
										className={s.itemBtn}
									>
										<FileText size={16} color="var(--accent)" />
										<div>
											<div style={{ fontWeight: 600 }}>{item.displayName}</div>
											<div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
												{formatBytes(item.sizeBytes)}{ownerNote}
											</div>
										</div>
									</button>
									<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
										<button
											type="button"
											onClick={() => void drive.updateItem(item.id, { isStarred: !item.isStarred })}
											title={starTitle}
											className={s.iconBtn}
											style={{ color: starColor }}
										>
											<Star size={14} />
										</button>
										<button
											type="button"
											onClick={() => setShareTarget({ id: item.id, name: item.displayName, kind: 'item' })}
											title={t('driveActionShare')}
											className={s.iconBtn}
										>
											<Share2 size={14} />
										</button>
										{drive.view === 'trash' ? (
											<>
												<button
													type="button"
													onClick={() => void drive.updateItem(item.id, { isTrashed: false })}
													title={t('driveActionRestore')}
													className={s.iconBtn}
												>
													<RotateCcw size={14} color="var(--accent)" />
												</button>
												<button
													type="button"
													onClick={() => void drive.deleteItemForever(item.id)}
													title={t('driveActionDeleteForever')}
													className={s.iconBtn}
												>
													<Trash2 size={14} color="var(--danger)" />
												</button>
											</>
										) : (
											<button
												type="button"
												onClick={() => void drive.updateItem(item.id, { isTrashed: true })}
												title={t('driveActionTrash')}
												className={s.iconBtn}
											>
												<Trash2 size={14} color="var(--danger)" />
											</button>
										)}
									</div>
								</div>
							);
						})}

						{!drive.loading && drive.folders.length === 0 && drive.items.length === 0 && (
							<div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
								<div>{t('driveEmptyFolder')}</div>
								<div style={{ fontSize: '11px', marginTop: '4px' }}>{t('driveDropHint')}</div>
							</div>
						)}
					</div>
				</div>
			)}

			<DriveShareModal target={shareTarget} onClose={() => setShareTarget(null)} />
		</div>
	);
}
