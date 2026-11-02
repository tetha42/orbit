'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
	Award,
	CalendarCheck,
	CheckCheck,
	ClipboardList,
	FolderGit2,
	QrCode,
	Users,
	Check,
	Cpu,
	ListChecks,
	Mail,
	Newspaper,
	UserPlus,
	X,
	type LucideIcon,
} from 'lucide-react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useWindowActions } from '@/core/windows';
import { useShell, useShellActions } from '@/core/shell';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useIsMounted } from '@/lib/client/useClientValue';
import { emitAppEvent } from '@/core/commands';
import { groupNotifications } from '@/lib/notifications';
import { dayOffset, relativeTime } from '@/core/data/format';
import { fill } from '@/lib/text';
import type { NotificationItem, NotificationKind } from '@/types/notifications';
import { useNotifications } from './NotificationsProvider';

/**
 * The notification center: one panel under the bell.
 *
 * It replaces a full-height drawer with tabs, a headline pill in the menu bar and
 * a badge that opened the same drawer. Now there is one list — to-dos first, then
 * what is new, then the rest — and every row goes to the thing it is about.
 */

const KIND_STYLE: Record<NotificationKind, { Icon: LucideIcon; color: string }> = {
	approval: { Icon: UserPlus, color: '#0a84ff' },
	news: { Icon: Newspaper, color: '#ff9f0a' },
	event: { Icon: CalendarCheck, color: '#ff3b30' },
	task: { Icon: ListChecks, color: '#5e5ce6' },
	loan: { Icon: Cpu, color: '#30b0c7' },
	certificate: { Icon: Award, color: '#ff9500' },
	teamApplication: { Icon: Users, color: '#0a84ff' },
	teamDecision: { Icon: Users, color: '#30d158' },
	projectProposal: { Icon: FolderGit2, color: '#5e5ce6' },
	assigned: { Icon: ClipboardList, color: '#5e5ce6' },
	checkin: { Icon: QrCode, color: '#30d158' },
	message: { Icon: Mail, color: '#0a84ff' },
};

type Translate = (key: string, fallback?: string) => string;

function dueLabel(dueAt: number, now: number, t: Translate): string {
	const days = dayOffset(dueAt, now);
	if (days < -1) return fill(t('ncDueOverdue'), { n: -days });
	if (days === -1) return t('ncDueOverdueOne');
	if (days === 0) return t('ncDueToday');
	if (days === 1) return t('ncDueTomorrow');
	return fill(t('ncDueInDays'), { n: days });
}

/** The second line of a row. Wording lives here, in the member's language; the API only sends facts. */
function metaFor(item: NotificationItem, now: number, t: Translate, locale: string): string[] {
	const d = item.data;
	switch (item.kind) {
		case 'approval':
			return [
				t('ncApprovalMeta'),
				d.department ? String(d.department) : '',
				d.year ? fill(t('ncYear'), { n: Number(d.year) }) : '',
			].filter(Boolean);
		case 'news':
			return [d.category ? String(d.category) : '', relativeTime(item.at, now, locale)].filter(Boolean);
		case 'event': {
			const when = item.dueAt
				? new Intl.DateTimeFormat(locale, {
						weekday: 'short',
						day: 'numeric',
						month: 'short',
						hour: '2-digit',
						minute: '2-digit',
					}).format(item.dueAt)
				: '';
			return [d.ongoing ? t('ncEventOngoing') : when, d.location ? String(d.location) : ''].filter(Boolean);
		}
		case 'task':
			return [
				fill(t('ncTaskMeta'), { team: String(d.teamName ?? ''), when: dueLabel(item.dueAt ?? item.at, now, t) }),
			];
		case 'loan':
			return [fill(t('ncLoanMeta'), { when: dueLabel(item.dueAt ?? item.at, now, t) })];
		case 'certificate':
			return [t('ncCertificateMeta'), relativeTime(item.at, now, locale)];
		case 'teamApplication':
			return [fill(t('ncTeamApplicationMeta'), { team: String(d.teamName ?? '') }), relativeTime(item.at, now, locale)];
		case 'teamDecision':
			return [t(d.accepted ? 'ncTeamDecisionAccepted' : 'ncTeamDecisionRejected'), relativeTime(item.at, now, locale)];
		case 'projectProposal':
			return [t('ncProjectProposalMeta'), d.author ? String(d.author) : '', relativeTime(item.at, now, locale)].filter(Boolean);
		case 'assigned':
			return [
				d.by ? fill(t('ncAssignedBy'), { name: String(d.by) }) : t('ncAssignedMeta'),
				String(d.teamName ?? ''),
				relativeTime(item.at, now, locale),
			].filter(Boolean);
		case 'checkin':
			return [t('ncCheckinMeta'), d.location ? String(d.location) : ''].filter(Boolean);
		case 'message':
			return [fill(t('ncMessageMeta'), { name: String(d.from ?? '') }), relativeTime(item.at, now, locale)];
	}
}

interface RowProps {
	item: NotificationItem;
	now: number;
	unread?: boolean;
	pinned?: boolean;
	busy: boolean;
	error?: string;
	onOpen: (item: NotificationItem) => void;
	onDecide: (item: NotificationItem, action: 'onayla' | 'reddet') => void;
}

function NotificationRow({ item, now, unread, pinned, busy, error, onOpen, onDecide }: RowProps) {
	const { t, language } = useI18n();
	const { Icon, color } = KIND_STYLE[item.kind];
	const overdue = item.dueAt !== undefined && item.priority === 'action' && dayOffset(item.dueAt, now) < 0;
	const registered = item.kind === 'event' && item.data.registered === true;
	const meta = metaFor(item, now, t, language);

	return (
		<li className={`nc-row${pinned ? ' nc-row--pinned' : ''}`} data-notification-item={item.id} data-unread={unread || undefined}>
			<button type="button" className="nc-row-main" onClick={() => onOpen(item)}>
				<span className="nc-icon" style={{ background: `${color}26`, color }} aria-hidden="true">
					<Icon size={16} />
				</span>
				<span className="nc-text">
					{pinned && <span className="nc-flag">{t('ncUrgent')}</span>}
					<span className="nc-row-title">{item.data.title}</span>
					<span className="nc-row-meta" style={overdue ? { color: '#ff453a' } : undefined}>
						{/* One run of text, so a wrapped line never starts with a stray separator dot. */}
						<span>{meta.join('\u00A0· ')}</span>
						{registered && <span className="nc-chip">{t('ncEventRegistered')}</span>}
					</span>
				</span>
				{unread && <span className="nc-dot" aria-hidden="true" />}
			</button>

			{item.kind === 'approval' && (
				<div className="nc-actions">
					<button
						type="button"
						className="nc-btn nc-btn--danger"
						data-notification-action="reddet"
						disabled={busy}
						onClick={() => onDecide(item, 'reddet')}
					>
						{t('ncReject')}
					</button>
					<button
						type="button"
						className="nc-btn nc-btn--primary"
						data-notification-action="onayla"
						disabled={busy}
						onClick={() => onDecide(item, 'onayla')}
					>
						<Check size={12} aria-hidden="true" /> {t('ncApprove')}
					</button>
				</div>
			)}
			{error && (
				<div role="alert" className="nc-row-error">
					{error}
				</div>
			)}
		</li>
	);
}

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

	// The panel mounts when it opens: take keyboard focus so Tab starts inside it. When it
	// closes, focus that was inside it would fall to <body>; hand it back to the bell instead.
	// (Focus the member moved elsewhere — clicking into a window — is left where it is.)
	useEffect(() => {
		panelRef.current?.focus();
		return () => {
			if (document.activeElement === document.body) {
				document.querySelector<HTMLElement>('[data-notification-toggle]')?.focus();
			}
		};
	}, []);

	// Click anywhere outside closes it — except the bell (which toggles it itself) and a
	// confirmation dialog opened from inside the panel.
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

	// Times are relative to when the server built the list, so labels do not shift on every re-render.
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

	const decide = async (item: NotificationItem, action: 'onayla' | 'reddet') => {
		if (action === 'reddet') {
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
				body: JSON.stringify({ userId: String(item.data.userId), aksiyon: action }),
			});
			const body = await res.json().catch(() => ({}));
			if (res.ok && body.success) {
				playSystemSound();
				setStatus(t(action === 'onayla' ? 'ncApproved' : 'ncRejected'));
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
