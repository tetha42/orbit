'use client';

import React from 'react';
import { ChevronLeft, MoreHorizontal, Pencil, Plus, QrCode, Ticket, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { isLive, typeMeta } from '@/components/Events/eventsShared';
import { AttendancePanel } from '@/components/Events/AttendancePanel';
import type { Notify } from '@/core/ui/Toast';
import type { EventView, Tab } from '../../types';
import { EventMobileDetailBody } from './EventMobileDetailBody';
import { EventMobileManageSheet } from './EventMobileManageSheet';
import s from '../../EventsMobile.module.css';

interface EventMobileDetailProps {
	event: EventView;
	manage: boolean;
	now: number;
	locale: string;
	busy: boolean;
	notify: Notify;
	detailTab: 'info' | 'attendance';
	setDetailTab: (t: 'info' | 'attendance') => void;
	manageSheetOpen: boolean;
	setManageSheetOpen: (v: boolean) => void;
	tabOf: (e: EventView) => Tab;
	onTabChange: (t: Tab) => void;
	onBack: () => void;
	refetch: () => Promise<void>;
	onRegister: (e: EventView) => void;
	onUnregister: (e: EventView) => void;
	onOpenTicket: (e: EventView) => void;
	onStartScan: () => void;
	onEdit: (e: EventView) => void;
	onAct: (body: Record<string, unknown>, success?: string) => Promise<boolean>;
	onProjector: (e: EventView) => void;
}

export function EventMobileDetail({
	event: e,
	manage,
	now,
	locale,
	busy,
	notify,
	detailTab,
	setDetailTab,
	manageSheetOpen,
	setManageSheetOpen,
	tabOf,
	onTabChange,
	onBack,
	refetch,
	onRegister,
	onUnregister,
	onOpenTicket,
	onStartScan,
	onEdit,
	onAct,
	onProjector,
}: EventMobileDetailProps) {
	const { t } = useI18n();
	const meta = typeMeta(e.typeValue);
	const live = isLive(e, now);
	const ended = e.endTime < now;
	const full = e.capacity > 0 && e.registeredCount >= e.capacity;
	const canRegister = e.status === 'published' && !ended && !e.myRecord;
	const canCheckIn = e.status === 'published' && Number(e.attendanceOpen) === 1 && !e.myAttendance && !ended;

	return (
		<div className={s.root} style={{ '--type-color': meta.color } as React.CSSProperties}>
			<div className={s.topBar}>
				<button type="button" className={s.backBtn} onClick={onBack}>
					<ChevronLeft size={20} />
					<span>{t('evTitle')}</span>
				</button>
				<span className={s.topTitle}>{e.title}</span>
				<div className={s.topActions}>
					{manage && (
						<button type="button" className={s.iconBtn} onClick={() => onEdit(e)} title={t('evEdit')}>
							<Pencil size={16} />
						</button>
					)}
				</div>
			</div>

			{manage && e.status !== 'draft' && (
				<div className={s.segmentWrap} style={{ paddingBottom: 0 }}>
					<div className={s.segmentedBar}>
						<button
							type="button"
							className={`${s.segmentBtn} ${detailTab === 'info' ? s.segmentBtnActive : ''}`}
							onClick={() => setDetailTab('info')}
						>
							{t('evAbout')}
						</button>
						<button
							type="button"
							className={`${s.segmentBtn} ${detailTab === 'attendance' ? s.segmentBtnActive : ''}`}
							onClick={() => setDetailTab('attendance')}
						>
							{fill(t('evAttendeesCountTab'), { n: e.registeredCount })}
						</button>
					</div>
				</div>
			)}

			{manage && detailTab === 'attendance' && e.status !== 'draft' ? (
				<div style={{ flex: 1, overflowY: 'auto', padding: 12, WebkitOverflowScrolling: 'touch' }}>
					<AttendancePanel key={e.id} event={e} notify={notify} onChanged={refetch} onProjector={() => onProjector(e)} />
				</div>
			) : (
				<EventMobileDetailBody
					event={e}
					locale={locale}
					now={now}
					live={live}
					ended={ended}
					full={full}
					typeKey={meta.key}
					onOpenTicket={onOpenTicket}
				/>
			)}

			<div className={s.bottomToolbar}>
				{canRegister ? (
					<div style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'center' }}>
						<button type="button" className={s.bigActionBtn} disabled={busy || full} onClick={() => onRegister(e)} style={{ flex: 1 }}>
							<Plus size={18} />
							<span>{full ? t('evFull') : t('evRegister')}</span>
						</button>
						{manage && (
							<button
								type="button"
								className={s.toolbarBtn}
								onClick={() => setManageSheetOpen(true)}
								title={t('evManage')}
								style={{ flex: '0 0 54px' }}
							>
								<MoreHorizontal size={18} />
								<span>{t('evManage')}</span>
							</button>
						)}
					</div>
				) : (
					<>
						{e.myRecord && e.ticketCode && (
							<button type="button" className={s.toolbarBtn} onClick={() => onOpenTicket(e)} title={t('evMyTicket')}>
								<Ticket size={18} />
								<span>{t('evMyTicket')}</span>
							</button>
						)}
						{canCheckIn && (
							<button type="button" className={s.toolbarBtn} style={{ color: 'var(--success)' }} onClick={onStartScan} title={t('evCheckIn')}>
								<QrCode size={18} />
								<span>{t('evCheckIn')}</span>
							</button>
						)}
						{e.myRecord && e.start > now && e.status === 'published' && (
							<button
								type="button"
								className={`${s.toolbarBtn} ${s.toolbarBtnDestructive}`}
								disabled={busy}
								onClick={() => onUnregister(e)}
								title={t('evCancelRegistration')}
							>
								<X size={18} />
								<span>{t('evCancelRegistration')}</span>
							</button>
						)}
						{manage && (
							<button type="button" className={s.toolbarBtn} onClick={() => setManageSheetOpen(true)} title={t('evManage')}>
								<MoreHorizontal size={18} />
								<span>{t('evManage')}</span>
							</button>
						)}
					</>
				)}
			</div>

			{manageSheetOpen && (
				<EventMobileManageSheet
					event={e}
					ended={ended}
					tabOf={tabOf}
					onTabChange={onTabChange}
					onClose={() => setManageSheetOpen(false)}
					onEdit={onEdit}
					onAct={onAct}
					onProjector={onProjector}
					onDeleted={onBack}
				/>
			)}
		</div>
	);
}
