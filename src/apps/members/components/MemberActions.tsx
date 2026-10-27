'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { Check, X, MoreHorizontal } from 'lucide-react';
import type { MemberRecord } from '../types';

interface MemberActionsProps {
	member: MemberRecord;
	onUpdateStatus: (memberId: string, status: 'aktif' | 'reddedildi' | 'mezun') => void;
	onOpenContextMenu?: (e: React.MouseEvent) => void;
}

export function MemberActions({
	member,
	onUpdateStatus,
	onOpenContextMenu,
}: MemberActionsProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
			{member.status === 'beklemede' && (
				<>
					<button
						onClick={() => onUpdateStatus(member.id, 'aktif')}
						title={t('membersCtxApprove')}
						style={{
							padding: '3px 8px',
							borderRadius: '6px',
							border: 'none',
							background: '#34c759',
							color: '#fff',
							fontSize: '11px',
							fontWeight: 700,
							cursor: 'pointer',
							display: 'inline-flex',
							alignItems: 'center',
							gap: '3px',
						}}
					>
						<Check size={12} /> {t('approve')}
					</button>
					<button
						onClick={() => onUpdateStatus(member.id, 'reddedildi')}
						title={t('membersCtxReject')}
						style={{
							padding: '3px 8px',
							borderRadius: '6px',
							border: 'none',
							background: '#ff3b30',
							color: '#fff',
							fontSize: '11px',
							fontWeight: 700,
							cursor: 'pointer',
							display: 'inline-flex',
							alignItems: 'center',
							gap: '3px',
						}}
					>
						<X size={12} /> {t('reject')}
					</button>
				</>
			)}

			{onOpenContextMenu && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onOpenContextMenu(e);
					}}
					title={t('membersActionsMenuTooltip')}
					aria-label={t('membersActionsMenuAria')}
					data-member-menu={member.id}
					style={{
						background: 'rgba(255, 255, 255, 0.08)',
						border: '1px solid var(--window-border)',
						color: 'inherit',
						cursor: 'pointer',
						padding: '4px 8px',
						borderRadius: '6px',
						display: 'inline-flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '4px',
						fontSize: '12px',
					}}
				>
					<MoreHorizontal size={14} />
				</button>
			)}
		</div>
	);
}
