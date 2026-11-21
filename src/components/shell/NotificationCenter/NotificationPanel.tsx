'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCheck, X } from 'lucide-react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useWindowActions } from '@/core/windows';
import { useShell, useShellActions } from '@/core/shell';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useIsMounted } from '@/lib/client/useClientValue';
import { emitAppEvent } from '@/core/commands';
import { groupNotifications } from '@/lib/notifications';
import { fill } from '@/lib/text';
import type { NotificationItem } from '@/types/notifications';
import { useNotifications } from './NotificationsProvider';
import { NotificationRow } from './NotificationRow';

function PanelView() {
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const { openApp } = useWindowActions();
	const { setIsNotificationCenterOpen } = useShellActions();
	const { data, isLoading, hasError, viewSince, refresh } = useNotifications();
	const dialog = useDialog();

	const panelRef = useRef<HTMLDivElement>(null);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
		panelRef.current?.focus();
		return () => {
			if (document.activeElement === document.body) {
				document.querySelector<HTMLElement>('[data-notification-toggle]')?.focus();
			}
		};
	}, []);

	useEffect(() => {
		const onMouseDown = (event: MouseEvent) => {
			const target = event.target as Element | null;
			if (!target || panelRef.current?.contains(target)) return;
			if (target.closest('[data-notification-toggle], .dlg-backdrop')) return;
			setIsNotificationCenterOpen(false);
		};
		document.addEventListener('mousedown', onMouseDown, true);
		return () => document.removeEventListener('mousedown', onMouseDown, true);
	}, [setIsNotificationCenterOpen]);

	useEffect(() => {
		if (!status) return;
		const timer = setTimeout(() => setStatus(null), 3200);
		return () => clearTimeout(timer);
	}, [status]);

	const now = data?.generatedAt ?? 0;
	const groups = data ? groupNotifications(data.items, viewSince) : null;
	const isEmpty = !!data && data.items.length === 0 && !data.moreApprovals;

	const open = (item: NotificationItem) => {
		playSystemSound();
		setIsNotificationCenterOpen(false);
		openApp(item.target.appId, item.target);
	};

	const openMembers = () => {
		playSystemSound();
		setIsNotificationCenterOpen(false);
		openApp('members');
	};

	const decide = async (item: NotificationItem, action: 'approve' | 'reject') => {
		if (action === 'reject') {
			const confirmed = await dialog.confirm({
				title: t('ncRejectTitle'),
				message: fill(t('ncRejectConfirm'), { name: item.data.title }),
				tone: 'danger',
				confirmLabel: t('ncReject'),
			});
			if (!confirmed) return;
		}
		setBusyId(item.id);
		setRowError(null);
		try {
			const res = await fetch('/api/admin/approve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: String(item.data.userId), action }),
			});
			const body = await res.json().catch(() => ({}));
			if (res.ok && body.success) {
				playSystemSound();
				setStatus(t(action === 'approve' ? 'ncApproved' : 'ncRejected'));
				emitAppEvent('roster-changed');
				await refresh();
			} else {
				setRowError({ id: item.id, text: body.error || t('ncActionFailed') });
			}
		} catch {
			setRowError({ id: item.id, text: t('ncActionFailed') });
		} finally {
			setBusyId(null);
		}
	};

	const renderRows = (items: NotificationItem[], options: { unread?: boolean } = {}) =>
		items.map((item) => (
			<NotificationRow
				key={item.id}
				item={item}
				now={now}
				unread={options.unread}
				busy={busyId === item.id}
				error={rowError?.id === item.id ? rowError.text : undefined}
				onOpen={open}
				onDecide={decide}
			/>
		));

	const section = (group: string, title: string, items: NotificationItem[], options: { unread?: boolean } = {}) =>
		items.length > 0 && (
			<section aria-label={title} data-notification-group={group}>
				<h3 className="nc-group-title">{title}</h3>
				<ul className="nc-list">{renderRows(items, options)}</ul>
			</section>
		);

	return (
		<div
			ref={panelRef}
			className="nc-panel"
			role="dialog"
			aria-labelledby="nc-title"
			data-notification-panel=""
			tabIndex={-1}
		>
			<div className="nc-head">
				<h2 id="nc-title" className="nc-title">
					{t('ncTitle')}
				</h2>
				<button
					type="button"
					className="nc-close"
					aria-label={t('ncClose')}
					title={t('ncClose')}
					onClick={() => setIsNotificationCenterOpen(false)}
				>
					<X size={15} />
				</button>
			</div>

			<div className="nc-body">
				{isLoading && <div className="nc-note">{t('ncLoading')}</div>}

				{!data && hasError && (
					<div className="nc-note">
						<p>{t('ncLoadFailed')}</p>
						<button type="button" className="nc-btn" onClick={() => void refresh()}>
							{t('ncRetry')}
						</button>
					</div>
				)}

				{groups && (
					<>
						{groups.pinned && (
							<section aria-label={t('ncPinned')} data-notification-group="pinned">
								<ul className="nc-list nc-list--pinned">
									<NotificationRow
										item={groups.pinned}
										now={now}
										pinned
										unread={groups.pinned.at > viewSince}
										busy={false}
										onOpen={open}
										onDecide={decide}
									/>
								</ul>
							</section>
						)}
						{section('action', t('ncGroupAction'), groups.action)}
						{data?.moreApprovals ? (
							<button type="button" className="nc-more" onClick={openMembers}>
								{fill(t('ncMoreApprovals'), { n: data.moreApprovals })}
							</button>
						) : null}
						{section('fresh', t('ncGroupNew'), groups.fresh, { unread: true })}
						{section('earlier', t('ncGroupEarlier'), groups.earlier)}
					</>
				)}

				{isEmpty && (
					<div className="nc-empty" data-notification-empty="">
						<CheckCheck size={30} aria-hidden="true" />
						<p className="nc-empty-title">{t('ncEmpty')}</p>
						<p>{t('ncEmptyHint')}</p>
					</div>
				)}
			</div>

			{(status || (data && hasError)) && (
				<div role="status" className={`nc-status${status ? '' : ' nc-status--warn'}`}>
					{status ?? t('ncStale')}
				</div>
			)}
		</div>
	);
}

/** Mounts the panel only while it is open, so every opening starts with fresh focus and no leftover state. */
export function NotificationPanel() {
	const { isLocked } = useSession();
	const { isNotificationCenterOpen } = useShell();
	const isMounted = useIsMounted();
	if (!isMounted || !isNotificationCenterOpen || isLocked) return null;
	return createPortal(<PanelView />, document.body);
}
