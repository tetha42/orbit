'use client';

import React from 'react';
import { Ban, Pencil, Send, Trash2, Tv } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { fill } from '@/lib/text';
import type { EventView, Tab } from '../../types';
import s from '../../EventsMobile.module.css';

interface EventMobileManageSheetProps {
	event: EventView;
	ended: boolean;
	tabOf: (e: EventView) => Tab;
	onTabChange: (t: Tab) => void;
	onClose: () => void;
	onEdit: (e: EventView) => void;
	onAct: (body: Record<string, unknown>, success?: string) => Promise<boolean>;
	onProjector: (e: EventView) => void;
	onDeleted: () => void;
}

export function EventMobileManageSheet({
	event: e,
	ended,
	tabOf,
	onTabChange,
	onClose,
	onEdit,
	onAct,
	onProjector,
	onDeleted,
}: EventMobileManageSheetProps) {
	const { t } = useI18n();
	const dialog = useDialog();

	return (
		<div className={s.sheetScrim} onClick={onClose}>
			<div className={s.sheetCard} onClick={(ev) => ev.stopPropagation()}>
				<div className={s.sheetHeader}>
					{t('evManage')} · {e.title}
				</div>
				{e.status === 'published' && (
					<button
						type="button"
						className={s.sheetActionBtn}
						onClick={() => {
							onClose();
							onProjector(e);
						}}
					>
						<Tv size={18} />
						<span>{t('evProjector')}</span>
					</button>
				)}
				<button
					type="button"
					className={s.sheetActionBtn}
					onClick={() => {
						onClose();
						onEdit(e);
					}}
				>
					<Pencil size={18} />
					<span>{t('evEdit')}</span>
				</button>
				{e.status === 'draft' && (
					<button
						type="button"
						className={s.sheetActionBtn}
						onClick={() => {
							onClose();
							void onAct({ action: 'updateEvent', eventId: e.id, status: 'published' }, t('evSaved')).then(
								(ok) => ok && onTabChange(tabOf({ ...e, status: 'published' }))
							);
						}}
					>
						<Send size={18} />
						<span>{t('evPublish')}</span>
					</button>
				)}
				{e.status === 'published' && !ended && (
					<button
						type="button"
						className={s.sheetDestructiveBtn}
						onClick={async () => {
							onClose();
							if (await dialog.confirm({ message: fill(t('evCancelEventConfirm'), { title: e.title }), tone: 'danger' })) {
								await onAct({ action: 'updateEvent', eventId: e.id, status: 'cancelled' });
							}
						}}
					>
						<Ban size={18} />
						<span>{t('evCancelEvent')}</span>
					</button>
				)}
				{e.participantCount === 0 && (
					<button
						type="button"
						className={s.sheetDestructiveBtn}
						onClick={async () => {
							onClose();
							if (await dialog.confirm({ message: fill(t('evDeleteConfirm'), { title: e.title }), tone: 'danger' })) {
								if (await onAct({ action: 'deleteEvent', eventId: e.id })) {
									onDeleted();
								}
							}
						}}
					>
						<Trash2 size={18} />
						<span>{t('evDelete')}</span>
					</button>
				)}
			</div>
			<button type="button" className={s.sheetCancelBtn} onClick={onClose}>
				<span>{t('cancel')}</span>
			</button>
		</div>
	);
}
