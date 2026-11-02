'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, ListChecks, QrCode, X } from 'lucide-react';
import { useSession, useLiveEvent } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useJsonResource } from '@/core/data/useJsonResource';
import { postAction } from '@/core/data/http';
import { dayOffset } from '@/core/data/format';
import { useNow } from '@/lib/client/useSheet';
import { fill } from '@/lib/text';
import { seviye } from '@/lib/profile';
import { myOpenTasks, nextEvent } from '@/lib/mobileCockpit';
import { CameraQRScannerModal } from '@/apps/events/components/CameraQRScannerModal';
import type { EventsResponse } from '@/components/Events/eventsShared';
import type { Team } from '@/apps/teams/types';
import type { AppID } from '@/types/workspace';
import { NoRoleNotice } from '@/components/shell/Desktop/NoRoleNotice';

const CARD = {
	background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.03))',
	border: '1px solid rgba(255, 255, 255, 0.12)',
	borderRadius: '18px',
	padding: '16px',
	color: '#fff',
	textAlign: 'left',
	width: '100%',
	boxSizing: 'border-box',
} as const;

const MAX_TASKS_SHOWN = 3;

interface Feedback {
	ok: boolean;
	text: string;
}

/**
 * The student's phone home: level and XP, then three quick cards — check in with
 * a QR code, the tasks assigned to them, and the next club event. A card appears
 * only when the member's role opens the app behind it, and its data is read from
 * the same endpoints the apps use, so nothing here can show more than they would.
 */
export function MobileDashboard({ onOpenApp }: { onOpenApp: (appId: AppID) => void }) {
	const { currentUser, canUseApp } = useSession();
	const { t, language } = useI18n();
	const { playSystemSound } = useSound();
	const now = useNow(30_000);
	const canTeams = canUseApp('teams');
	const canEvents = canUseApp('events');
	const teams = useJsonResource<Team[]>(canTeams ? '/api/teams' : null);
	const events = useJsonResource<EventsResponse>(canEvents ? '/api/events' : null);
	const [scanning, setScanning] = useState(false);
	const [feedback, setFeedback] = useState<Feedback | null>(null);

	const { refetch: refetchTeams } = teams;
	const { refetch: refetchEvents } = events;
	useLiveEvent((event) => {
		if (event === 'team_updated' && canTeams) void refetchTeams();
		if (event === 'event_updated' && canEvents) void refetchEvents();
	});

	const locale = language === 'en' ? 'en-GB' : 'tr-TR';
	const tasks = useMemo(() => (currentUser && Array.isArray(teams.data) ? myOpenTasks(teams.data, currentUser.id) : []), [teams.data, currentUser]);
	const upcoming = useMemo(() => nextEvent(events.data?.etkinlikler ?? [], now), [events.data, now]);

	if (!currentUser) return null;
	const level = seviye(currentUser.xp || 0);

	const checkIn = async (kod: string) => {
		const res = await postAction<{ message: string; zaten?: boolean }>('/api/events', 'yoklama', { kisaKod: kod, kod });
		if (res.ok) {
			playSystemSound();
			setFeedback({ ok: !res.data.zaten, text: res.data.message });
		} else {
			setFeedback({ ok: false, text: res.error || t('kbActionFailed') });
		}
		await refetchEvents();
	};

	const dueLabel = (due: number) => {
		const days = dayOffset(due, now);
		const when = new Date(due).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
		return { text: when, overdue: days < 0 };
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<NoRoleNotice compact />

			{/* Level & XP */}
			<div data-cockpit="xp" style={CARD}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
					<div style={{ fontSize: '17px', fontWeight: 800 }}>{fill(t('mobLevel'), { n: level.seviye })}</div>
					<div style={{ fontSize: '12.5px', opacity: 0.75 }}>{currentUser.xp || 0} XP</div>
				</div>
				<div
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(level.ilerleme * 100)}
					aria-label={fill(t('mobLevel'), { n: level.seviye })}
					style={{ height: '8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.12)', margin: '10px 0 6px', overflow: 'hidden' }}
				>
					<div style={{ height: '100%', width: `${Math.round(level.ilerleme * 100)}%`, background: 'linear-gradient(90deg, #0a84ff, #5e5ce6)' }} />
				</div>
				<div style={{ fontSize: '11.5px', opacity: 0.6 }}>{fill(t('mobXpToNext'), { n: Math.max(0, level.sonraki - (currentUser.xp || 0)) })}</div>
			</div>

			{feedback && (
				<div
					role="status"
					data-cockpit="feedback"
					style={{
						...CARD,
						padding: '12px 14px',
						display: 'flex',
						gap: '10px',
						alignItems: 'center',
						justifyContent: 'space-between',
						borderColor: feedback.ok ? 'rgba(48, 209, 88, 0.5)' : 'rgba(255, 159, 10, 0.5)',
						fontSize: '13px',
					}}
				>
					<span>{feedback.text}</span>
					<button
						type="button"
						aria-label={t('mobDismiss')}
						onClick={() => setFeedback(null)}
						style={{ background: 'none', border: 0, color: 'inherit', padding: '6px', cursor: 'pointer', display: 'grid' }}
					>
						<X size={16} />
					</button>
				</div>
			)}

			{/* Quick action: QR check-in */}
			{canEvents && (
				<button
					type="button"
					data-cockpit="checkin"
					onClick={() => {
						playSystemSound();
						setFeedback(null);
						setScanning(true);
					}}
					style={{ ...CARD, display: 'flex', gap: '14px', alignItems: 'center', cursor: 'pointer', minHeight: '64px' }}
				>
					<span style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(48, 209, 88, 0.2)', color: '#30d158', flexShrink: 0 }}>
						<QrCode size={22} aria-hidden="true" />
					</span>
					<span>
						<span style={{ display: 'block', fontSize: '15px', fontWeight: 700 }}>{t('mobQuickAttendance')}</span>
						<span style={{ display: 'block', fontSize: '12px', opacity: 0.65 }}>{t('mobQuickAttendanceHint')}</span>
					</span>
				</button>
			)}

			{/* Quick action: my tasks */}
			{canTeams && (
				<button type="button" data-cockpit="tasks" onClick={() => onOpenApp('teams')} style={{ ...CARD, cursor: 'pointer' }}>
					<div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: tasks.length ? '10px' : 0 }}>
						<span style={{ width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(94, 92, 230, 0.22)', color: '#8e8cff' }}>
							<ListChecks size={19} aria-hidden="true" />
						</span>
						<span style={{ fontSize: '15px', fontWeight: 700 }}>{t('mobMyTasks')}</span>
						{tasks.length > 0 && <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.7 }}>{tasks.length}</span>}
					</div>
					{tasks.length === 0 ? (
						<div style={{ fontSize: '12.5px', opacity: 0.6, marginTop: '8px' }}>{teams.isLoading ? '…' : t('mobNoTasks')}</div>
					) : (
						<ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
							{tasks.slice(0, MAX_TASKS_SHOWN).map((task) => {
								const due = task.teslimTarihi ? dueLabel(task.teslimTarihi) : null;
								return (
									<li key={task.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '13px' }}>
										<span style={{ minWidth: 0 }}>
											<span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.baslik}</span>
											<span style={{ display: 'block', fontSize: '11.5px', opacity: 0.6 }}>{task.takimAdi}</span>
										</span>
										{due && <span style={{ fontSize: '11.5px', color: due.overdue ? '#ff453a' : undefined, opacity: due.overdue ? 1 : 0.7, whiteSpace: 'nowrap' }}>{due.text}</span>}
									</li>
								);
							})}
							{tasks.length > MAX_TASKS_SHOWN && (
								<li style={{ fontSize: '11.5px', opacity: 0.6 }}>{fill(t('mobTasksMore'), { n: tasks.length - MAX_TASKS_SHOWN })}</li>
							)}
						</ul>
					)}
				</button>
			)}

			{/* Quick action: next event */}
			{canEvents && (
				<button type="button" data-cockpit="event" onClick={() => onOpenApp('events')} style={{ ...CARD, cursor: 'pointer' }}>
					<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
						<span style={{ width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(255, 59, 48, 0.2)', color: '#ff6961' }}>
							<CalendarClock size={19} aria-hidden="true" />
						</span>
						<span style={{ fontSize: '15px', fontWeight: 700 }}>{t('mobUpcoming')}</span>
					</div>
					{upcoming ? (
						<div style={{ marginTop: '10px' }}>
							<div style={{ fontSize: '14px', fontWeight: 600 }}>{upcoming.baslik}</div>
							<div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>
								{upcoming.baslangic <= now
									? t('mobEventLive')
									: new Date(upcoming.baslangic).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
								{upcoming.konum ? ` · ${upcoming.konum}` : ''}
							</div>
							{upcoming.benimKaydim && <div style={{ fontSize: '11.5px', color: '#30d158', marginTop: '4px' }}>{t('mobEventRegistered')}</div>}
						</div>
					) : (
						<div style={{ fontSize: '12.5px', opacity: 0.6, marginTop: '8px' }}>{events.isLoading ? '…' : t('mobNoUpcoming')}</div>
					)}
				</button>
			)}

			{scanning && (
				// The scanner is laid out for a window; on the phone it covers the whole screen.
				<div style={{ position: 'fixed', inset: 0, zIndex: 10000 }}>
					<CameraQRScannerModal isOpen title={t('evScanTitleMember')} onClose={() => setScanning(false)} onScan={checkIn} mode="member" />
				</div>
			)}
		</div>
	);
}
