'use client';

import React, { useState, useEffect } from 'react';
import {
	ChevronLeft,
	Search,
	X,
	Plus,
	Clock,
	MapPin,
	Users,
	QrCode,
	Ticket,
	CheckCircle2,
	ChevronRight,
	RefreshCw,
	Pencil,
	Tv,
	Trash2,
	Ban,
	Send,
	Info,
	MoreHorizontal,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { Linkified } from '@/components/Common/Linkified';
import { fill } from '@/lib/text';
import type { EventView, Tab } from '../types';
import { formatRange, isLive, typeMeta } from '@/components/Events/eventsShared';
import { AttendancePanel } from '@/components/Events/AttendancePanel';
import { useMobileSubView } from '@/lib/client/useMobileSubView';
import s from '../EventsMobile.module.css';

interface EventsMobileViewProps {
	counts: { upcoming: number; past: number; drafts: number };
	tab: Tab;
	onTabChange: (t: Tab) => void;
	query: string;
	onQueryChange: (q: string) => void;
	data: unknown;
	error: unknown;
	httpStatus?: number;
	visible: EventView[];
	selectedId: string | null;
	onSelectId: (id: string | null) => void;
	selected: EventView | null;
	manage: boolean;
	now: number;
	locale: string;
	busy: boolean;
	notify: (msg: string, type?: 'info' | 'error' | 'success') => void;
	refetch: () => Promise<void>;
	tabOf: (e: EventView) => Tab;
	onRegister: (e: EventView) => void;
	onUnregister: (e: EventView) => void;
	onOpenTicket: (e: EventView) => void;
	onStartScan: () => void;
	onEdit: (e: EventView) => void;
	onAct: (body: Record<string, unknown>, success?: string) => Promise<boolean>;
	onProjector: (e: EventView) => void;
	onNewEvent: () => void;
}

export const EventsMobileView: React.FC<EventsMobileViewProps> = ({
	counts,
	tab,
	onTabChange,
	query,
	onQueryChange,
	data,
	error,
	httpStatus,
	visible,
	selectedId,
	onSelectId,
	selected,
	manage,
	now,
	locale,
	busy,
	notify,
	refetch,
	tabOf,
	onRegister,
	onUnregister,
	onOpenTicket,
	onStartScan,
	onEdit,
	onAct,
	onProjector,
	onNewEvent,
}) => {
	const { t } = useI18n();
	const dialog = useDialog();

	// Screen stack: 'list' <-> 'detail'
	const [screen, setScreen] = useState<'list' | 'detail'>('list');
	// Detail sub-tab for managers: 'info' | 'attendance'
	const [detailTab, setDetailTab] = useState<'info' | 'attendance'>('info');
	// Action Sheet for managers
	const [manageSheetOpen, setManageSheetOpen] = useState(false);

	useMobileSubView(screen === 'detail');

	// If selectedId is explicitly updated, navigate to detail
	useEffect(() => {
		if (selectedId) {
			setScreen('detail');
			setManageSheetOpen(false);
		}
	}, [selectedId]);

	const day = (ms: number) =>
		new Date(ms).toLocaleDateString(locale, { day: 'numeric' });
	const month = (ms: number) =>
		new Date(ms).toLocaleDateString(locale, { month: 'short' });
	const weekday = (ms: number) =>
		new Date(ms).toLocaleDateString(locale, { weekday: 'short' });

	const emptyText =
		tab === 'upcoming'
			? t('evNoUpcoming')
			: tab === 'past'
			? t('evNoPast')
			: t('evNoDrafts');

	// --------------------------------------------------------------------------
	// Render Screen 2: CommunityEvent Detayı (Event Detail)
	// --------------------------------------------------------------------------
	if (screen === 'detail' && selected) {
		const e = selected;
		const meta = typeMeta(e.tur);
		const live = isLive(e, now);
		const ended = e.endTime < now;
		const full = e.kapasite > 0 && e.kayitliSayisi >= e.kapasite;
		const canRegister = e.status === 'yayinda' && !ended && !e.benimKaydim;
		const canCheckIn =
			e.status === 'yayinda' &&
			Number(e.yoklamaAcik) === 1 &&
			!e.benimYoklamam &&
			!ended;

		return (
			<div
				className={s.root}
				style={{ '--type-color': meta.color } as React.CSSProperties}
			>
				{/* Top Navigation Bar with Back Button */}
				<div className={s.topBar}>
					<button
						type="button"
						className={s.backBtn}
						onClick={() => {
							onSelectId(null);
							setScreen('list');
						}}
					>
						<ChevronLeft size={20} />
						<span>{t('evTitle')}</span>
					</button>

					<span className={s.topTitle}>{e.baslik}</span>

					<div className={s.topActions}>
						{manage && (
							<button
								type="button"
								className={s.iconBtn}
								onClick={() => onEdit(e)}
								title={t('evEdit')}
							>
								<Pencil size={16} />
							</button>
						)}
					</div>
				</div>

				{/* Manager Sub-Tabs: Genel Bilgiler vs Katılımcılar & Attendance */}
				{manage && e.status !== 'taslak' && (
					<div className={s.segmentWrap} style={{ paddingBottom: 0 }}>
						<div className={s.segmentedBar}>
							<button
								type="button"
								className={`${s.segmentBtn} ${
									detailTab === 'info' ? s.segmentBtnActive : ''
								}`}
								onClick={() => setDetailTab('info')}
							>
								{t('evAbout')}
							</button>
							<button
								type="button"
								className={`${s.segmentBtn} ${
									detailTab === 'attendance' ? s.segmentBtnActive : ''
								}`}
								onClick={() => setDetailTab('attendance')}
							>
								{fill(t('evAttendeesCountTab'), { n: e.kayitliSayisi })}
							</button>
						</div>
					</div>
				)}

				{/* Detail Content */}
				{manage && detailTab === 'attendance' && e.status !== 'taslak' ? (
					<div
						style={{
							flex: 1,
							overflowY: 'auto',
							padding: 12,
							WebkitOverflowScrolling: 'touch',
						}}
					>
						<AttendancePanel
							key={e.id}
							event={e}
							notify={notify}
							onChanged={refetch}
							onProjector={() => onProjector(e)}
						/>
					</div>
				) : (
					<div className={s.detailScroll}>
						{/* Hero Header */}
						<div className={s.heroCard}>
							<div className={s.cardBadgeRow}>
								<span className={s.typeBadge}>{t(meta.key)}</span>
								{live && <span className={s.liveBadge}>{t('evLive')}</span>}
								{e.status === 'taslak' && (
									<span
										className={s.typeBadge}
										style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff' }}
									>
										{t('evDraft')}
									</span>
								)}
								{e.status === 'iptal' && (
									<span
										className={s.typeBadge}
										style={{ background: 'rgba(255, 69, 58, 0.15)', color: '#ff453a' }}
									>
										{t('evCancelled')}
									</span>
								)}
								{e.benimYoklamam ? (
									<span
										className={s.typeBadge}
										style={{
											background: 'rgba(48, 209, 88, 0.15)',
											color: '#30d158',
											display: 'inline-flex',
											alignItems: 'center',
											gap: 4,
										}}
									>
										<CheckCircle2 size={11} /> {t('evAttended')}
									</span>
								) : e.benimKaydim ? (
									<span
										className={s.typeBadge}
										style={{ background: 'rgba(10, 132, 255, 0.15)', color: '#0a84ff' }}
									>
										{t('evRegistered')}
									</span>
								) : null}
							</div>

							<h1 className={s.detailTitle}>{e.baslik}</h1>
						</div>

						{/* Facts Group (iOS Inset Table) */}
						<div className={s.factsGroup}>
							<div className={s.factRow}>
								<div className={s.factIconCircle}>
									<Clock size={16} />
								</div>
								<div className={s.factTexts}>
									<span className={s.factLabel}>{t('evWhen')}</span>
									<span className={s.factValue}>
										{formatRange(e.baslangic, e.endTime, locale)}
									</span>
								</div>
							</div>

							<div className={s.factRow}>
								<div className={s.factIconCircle}>
									<MapPin size={16} />
								</div>
								<div className={s.factTexts}>
									<span className={s.factLabel}>{t('evWhere')}</span>
									<span className={s.factValue}>{e.konum}</span>
								</div>
							</div>

							<div className={s.factRow}>
								<div className={s.factIconCircle}>
									<Users size={16} />
								</div>
								<div className={s.factTexts}>
									<div
										style={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center',
										}}
									>
										<span className={s.factLabel}>{t('evCapacity')}</span>
										<span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
											{e.kapasite > 0
												? `${e.kayitliSayisi} / ${e.kapasite}`
												: `${e.kayitliSayisi} · ${t('evUnlimited')}`}
										</span>
									</div>

									{e.kapasite > 0 && (
										<div className={s.meterBar}>
											<div
												className={s.meterFill}
												style={{
													width: `${Math.min(
														100,
														(e.kayitliSayisi / e.kapasite) * 100
													)}%`,
												}}
											/>
										</div>
									)}

									<span
										style={{
											fontSize: 10.5,
											color: 'var(--text-muted)',
											marginTop: 3,
										}}
									>
										{ended || live
											? fill(t('evAttendedCount'), { n: e.katilimciSayisi })
											: full
											? t('evFull')
											: e.kapasite > 0
											? fill(t('evSeatsLeft'), {
													n: e.kapasite - e.kayitliSayisi,
											  })
											: ''}
									</span>
								</div>
							</div>
						</div>

						{/* Attended Success Banner */}
						{e.benimYoklamam && (
							<div
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 8,
									padding: '10px 14px',
									borderRadius: 14,
									background: 'rgba(48, 209, 88, 0.12)',
									border: '1px solid rgba(48, 209, 88, 0.25)',
									color: '#30d158',
									fontSize: 12.5,
									fontWeight: 600,
								}}
							>
								<CheckCircle2 size={16} />
								<span>
									{fill(t('evAttendedAt'), {
										when: new Date(
											e.benimYoklamam.katilimZamani
										).toLocaleString(locale, {
											hour: '2-digit',
											minute: '2-digit',
											day: 'numeric',
											month: 'short',
										}),
									})}
								</span>
							</div>
						)}

						{/* Ticket Card if Registered */}
						{e.benimKaydim && e.biletKodu && (
							<div className={s.ticketCard}>
								<div className={s.ticketLeft}>
									<Ticket size={24} color="var(--accent)" />
									<div>
										<div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
											{t('evMyTicket')}
										</div>
										<div
											style={{
												fontSize: 11,
												color: 'var(--text-muted)',
												fontFamily: 'monospace',
											}}
										>
											{e.biletKodu}
										</div>
									</div>
								</div>
								<button
									type="button"
									className={s.ticketBtn}
									onClick={() => onOpenTicket(e)}
								>
									{t('evMyTicket')}
								</button>
							</div>
						)}

						{e.benimKaydim && e.baslangic <= now && !ended && e.status === 'yayinda' && (
							<div
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 8,
									padding: '8px 12px',
									borderRadius: 12,
									background: 'rgba(255, 255, 255, 0.05)',
									border: '1px solid var(--border-subtle)',
									color: 'var(--text-muted)',
									fontSize: 12,
								}}
							>
								<Info size={14} style={{ flexShrink: 0 }} />
								<span>{t('evRegistrationLockedStarted')}</span>
							</div>
						)}

						{/* Description */}
						{e.aciklama && (
							<div className={s.aboutCard}>
								<div className={s.aboutTitle}>{t('evAbout')}</div>
								<div className={s.aboutText}>
									<Linkified text={e.aciklama} />
								</div>
							</div>
						)}
					</div>
				)}

				{/* Fixed Bottom Action Toolbar (Apple Style - Strictly Responsive to Canvas Width) */}
				<div className={s.bottomToolbar}>
					{canRegister ? (
						<div style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'center' }}>
							<button
								type="button"
								className={s.bigActionBtn}
								disabled={busy || full}
								onClick={() => onRegister(e)}
								style={{ flex: 1 }}
							>
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
							{e.benimKaydim && e.biletKodu && (
								<button
									type="button"
									className={s.toolbarBtn}
									onClick={() => onOpenTicket(e)}
									title={t('evMyTicket')}
								>
									<Ticket size={18} />
									<span>{t('evMyTicket')}</span>
								</button>
							)}

							{canCheckIn && (
								<button
									type="button"
									className={s.toolbarBtn}
									style={{ color: '#30d158' }}
									onClick={onStartScan}
									title={t('evCheckIn')}
								>
									<QrCode size={18} />
									<span>{t('evCheckIn')}</span>
								</button>
							)}

							{e.benimKaydim && e.baslangic > now && e.status === 'yayinda' && (
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
								<button
									type="button"
									className={s.toolbarBtn}
									onClick={() => setManageSheetOpen(true)}
									title={t('evManage')}
								>
									<MoreHorizontal size={18} />
									<span>{t('evManage')}</span>
								</button>
							)}
						</>
					)}
				</div>

				{/* Manager Actions Action Sheet (iOS Style) */}
				{manageSheetOpen && (
					<div className={s.sheetScrim} onClick={() => setManageSheetOpen(false)}>
						<div className={s.sheetCard} onClick={(ev) => ev.stopPropagation()}>
							<div className={s.sheetHeader}>{t('evManage')} · {e.baslik}</div>
							{e.status === 'yayinda' && (
								<button
									type="button"
									className={s.sheetActionBtn}
									onClick={() => {
										setManageSheetOpen(false);
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
									setManageSheetOpen(false);
									onEdit(e);
								}}
							>
								<Pencil size={18} />
								<span>{t('evEdit')}</span>
							</button>
							{e.status === 'taslak' && (
								<button
									type="button"
									className={s.sheetActionBtn}
									onClick={() => {
										setManageSheetOpen(false);
										void onAct(
											{ action: 'updateEvent', etkinlikId: e.id, status: 'yayinda' },
											t('evSaved')
										).then((ok) => ok && onTabChange(tabOf({ ...e, status: 'yayinda' })));
									}}
								>
									<Send size={18} />
									<span>{t('evPublish')}</span>
								</button>
							)}
							{e.status === 'yayinda' && !ended && (
								<button
									type="button"
									className={s.sheetDestructiveBtn}
									onClick={async () => {
										setManageSheetOpen(false);
										if (
											await dialog.confirm({
												message: fill(t('evCancelEventConfirm'), { title: e.baslik }),
												tone: 'danger',
											})
										) {
											await onAct({
												action: 'updateEvent',
												etkinlikId: e.id,
												status: 'iptal',
											});
										}
									}}
								>
									<Ban size={18} />
									<span>{t('evCancelEvent')}</span>
								</button>
							)}
							{e.katilimciSayisi === 0 && (
								<button
									type="button"
									className={s.sheetDestructiveBtn}
									onClick={async () => {
										setManageSheetOpen(false);
										if (
											await dialog.confirm({
												message: fill(t('evDeleteConfirm'), { title: e.baslik }),
												tone: 'danger',
											})
										) {
											if (await onAct({ action: 'deleteEvent', etkinlikId: e.id })) {
												onSelectId(null);
												setScreen('list');
											}
										}
									}}
								>
									<Trash2 size={18} />
									<span>Sil</span>
								</button>
							)}
						</div>
						<button
							type="button"
							className={s.sheetCancelBtn}
							onClick={() => setManageSheetOpen(false)}
						>
							<span>{t('cancel')}</span>
						</button>
					</div>
				)}
			</div>
		);
	}

	// --------------------------------------------------------------------------
	// Render Screen 1: CommunityEvent Listesi (Events List - Default Screen)
	// --------------------------------------------------------------------------
	return (
		<div className={s.root}>
			{/* Large iOS Title with Add & Refresh */}
			<div className={s.largeTitleWrap}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
					}}
				>
					<h1 className={s.largeTitle}>{t('evTitle')}</h1>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						{manage && (
							<button
								type="button"
								className={s.iconBtn}
								onClick={onNewEvent}
								title={t('evNew')}
								style={{ color: 'var(--accent)' }}
							>
								<Plus size={18} />
							</button>
						)}
						<button
							type="button"
							className={s.iconBtn}
							onClick={() => void refetch()}
							title="Yenile"
						>
							<RefreshCw size={15} />
						</button>
					</div>
				</div>
			</div>

			{/* iOS Segmented Bar: Yaklaşan / Geçmiş / Taslaklar */}
			<div className={s.segmentWrap}>
				<div className={s.segmentedBar} role="tablist">
					{(['upcoming', 'past', ...(manage && counts.drafts ? (['drafts'] as const) : [])] as Tab[]).map((id) => (
						<button
							key={id}
							type="button"
							role="tab"
							aria-selected={tab === id}
							className={`${s.segmentBtn} ${tab === id ? s.segmentBtnActive : ''}`}
							onClick={() => onTabChange(id)}
						>
							<span>
								{t(id === 'upcoming' ? 'evUpcoming' : id === 'past' ? 'evPast' : 'evDrafts')}
							</span>
							{counts[id] > 0 && (
								<span className={s.segmentBadge}>({counts[id]})</span>
							)}
						</button>
					))}
				</div>
			</div>

			{/* Search Box */}
			<div className={s.searchWrap}>
				<div className={s.searchBox}>
					<Search size={14} color="var(--text-muted)" />
					<input
						type="text"
						className={s.searchInput}
						placeholder={t('evSearch')}
						value={query}
						onChange={(e) => onQueryChange(e.target.value)}
					/>
					{query && (
						<button
							type="button"
							className={s.clearSearchBtn}
							onClick={() => onQueryChange('')}
						>
							<X size={14} />
						</button>
					)}
				</div>
			</div>

			{/* Scrollable Event Cards with Apple Calendar Leaf */}
			<div className={s.eventsScroll}>
				{data === null && (error || (httpStatus ?? 0) >= 400) && (
					<div className={s.emptyState}>{t('evLoadFailed')}</div>
				)}

				{data !== null && visible.length === 0 && (
					<div className={s.emptyState}>{emptyText}</div>
				)}

				{visible.map((e) => {
					const meta = typeMeta(e.tur);
					const live = isLive(e, now);
					return (
						<div
							key={e.id}
							className={s.eventCard}
							style={{ '--type-color': meta.color } as React.CSSProperties}
							onClick={() => {
								onSelectId(e.id);
								setDetailTab('info');
								setScreen('detail');
							}}
						>
							{/* Apple Calendar Leaf */}
							<div className={s.calendarLeaf}>
								<div className={s.calendarLeafMonth}>{month(e.baslangic)}</div>
								<div className={s.calendarLeafDay}>{day(e.baslangic)}</div>
								<div className={s.calendarLeafWeekday}>{weekday(e.baslangic)}</div>
							</div>

							{/* Center Info */}
							<div className={s.cardContent}>
								<div className={s.cardBadgeRow}>
									<span className={s.typeBadge}>{t(meta.key)}</span>
									{live && <span className={s.liveBadge}>{t('evLive')}</span>}
								</div>

								<div className={s.cardTitle}>{e.baslik}</div>

								<div className={s.cardSubtitle}>
									<span>📍</span>
									<span>{e.konum}</span>
								</div>
							</div>

							{/* Right Status */}
							<div className={s.cardStatusCol}>
								{e.benimYoklamam ? (
									<span className={`${s.statusPill} ${s.attendedPill}`}>
										{t('evAttended')}
									</span>
								) : e.benimKaydim ? (
									<span className={s.statusPill}>{t('evRegistered')}</span>
								) : e.kapasite > 0 ? (
									<span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
										{e.kayitliSayisi}/{e.kapasite}
									</span>
								) : null}
								<ChevronRight size={16} color="var(--text-muted)" style={{ opacity: 0.6 }} />
							</div>
						</div>
					);
				})}
			</div>

			{/* iOS Bottom Bar */}
			<div className={s.bottomToolbar}>
				<span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
					Toplam {visible.length} CommunityEvent
				</span>

				<button
					type="button"
					className={s.toolbarBtn}
					onClick={onStartScan}
					title={t('evCheckIn')}
				>
					<QrCode size={18} />
					<span>{t('evCheckIn')}</span>
				</button>
			</div>
		</div>
	);
};
