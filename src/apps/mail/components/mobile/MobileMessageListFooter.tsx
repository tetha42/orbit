'use client';

import React from 'react';
import { MailOpen, Trash2 } from 'lucide-react';
import { fill } from '@/lib/text';
import { MobileBottomTabBar, type MailMobileTab, type MobileTabItem } from './MobileBottomTabBar';
import s from '../../MailMobile.module.css';

interface MobileMessageListFooterProps {
	totalPages: number;
	page: number;
	isLoadingList: boolean;
	isSelecting: boolean;
	isTrashFolder: boolean;
	selectedCount: number;
	tabs: MobileTabItem[];
	activeTabId: MailMobileTab;
	onPageChange: (nextPage: number) => void;
	onBatchToggleRead?: (markSeen: boolean) => void;
	onBatchTrash?: () => void;
	onExitSelecting: () => void;
	onTabChange: (id: MailMobileTab) => void;
	t: (key: string, fallback?: string) => string;
}

export function MobileMessageListFooter({
	totalPages,
	page,
	isLoadingList,
	isSelecting,
	isTrashFolder,
	selectedCount,
	tabs,
	activeTabId,
	onPageChange,
	onBatchToggleRead,
	onBatchTrash,
	onExitSelecting,
	onTabChange,
	t,
}: MobileMessageListFooterProps) {
	const pagerStyle = (disabled: boolean): React.CSSProperties => ({
		border: 'none',
		background: 'transparent',
		color: disabled ? 'var(--text-muted)' : 'var(--accent)',
		fontWeight: 600,
		cursor: disabled ? 'default' : 'pointer',
		padding: '4px 8px',
	});

	return (
		<>
			{totalPages > 1 && (
				<div
					style={{
						padding: '8px 16px',
						borderTop: '1px solid var(--border-subtle)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						fontSize: 12,
						color: 'var(--text-secondary)',
						background: 'var(--settings-sidebar-bg)',
					}}
				>
					<button
						type="button"
						style={pagerStyle(page <= 1)}
						disabled={page <= 1 || isLoadingList}
						onClick={() => onPageChange(page - 1)}
					>
						‹ {t('mailPrevPage')}
					</button>
					<span>{fill(t('mailPageOf'), { page, totalPages, n: page, total: totalPages })}</span>
					<button
						type="button"
						style={pagerStyle(page >= totalPages)}
						disabled={page >= totalPages || isLoadingList}
						onClick={() => onPageChange(page + 1)}
					>
						{t('mailNextPage')} ›
					</button>
				</div>
			)}

			{isSelecting ? (
				<div className={s.bottomToolbar}>
					<button
						type="button"
						className={s.toolbarBtn}
						onClick={() => onBatchToggleRead?.(true)}
						disabled={selectedCount === 0}
						style={{ opacity: selectedCount === 0 ? 0.4 : 1 }}
					>
						<MailOpen size={18} />
						<span>{t('mailBatchMarkRead')}</span>
					</button>
					<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
						{fill(t('mailSelectedCount'), { count: selectedCount })}
					</span>
					<button
						type="button"
						className={`${s.toolbarBtn} ${s.toolbarBtnDestructive}`}
						onClick={() => {
							onBatchTrash?.();
							onExitSelecting();
						}}
						disabled={selectedCount === 0}
						style={{ opacity: selectedCount === 0 ? 0.4 : 1 }}
					>
						<Trash2 size={18} />
						<span>{isTrashFolder ? t('mailBatchDelete') : t('mailBatchTrash')}</span>
					</button>
				</div>
			) : (
				<MobileBottomTabBar
					tabs={tabs}
					activeTabId={activeTabId}
					onTabChange={onTabChange}
					ariaLabel={t('mailMobNavAria')}
				/>
			)}
		</>
	);
}
