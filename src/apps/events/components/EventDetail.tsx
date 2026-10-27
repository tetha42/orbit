import React from 'react';
import {
	Ban,
	CheckCircle2,
	Clock,
	MapPin,
	Pencil,
	Plus,
	QrCode,
	Send,
	Ticket,
	Trash2,
	Users,
	X,
	Info,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { Linkified } from '@/components/Common/Linkified';
import { fill } from '@/lib/text';
import type { EventView, Tab } from '../types';
import { formatRange, isLive, typeMeta } from '@/components/Events/eventsShared';
import { AttendancePanel } from '@/components/Events/AttendancePanel';
import ui from '@/core/ui/ui.module.css';
import styles from '@/components/Events/Events.module.css';

interface Props {
	event: EventView;
	manage: boolean;
	now: number;
	locale: string;
	busy: boolean;
	notify: (msg: string, type?: 'info' | 'error' | 'success') => void;
	refetch: () => Promise<void>;
	tabOf: (e: EventView) => Tab;
	setTab: (t: Tab) => void;
	onRegister: (e: EventView) => void;
	onUnregister: (e: EventView) => void;
	onOpenTicket: (e: EventView) => void;
	onStartScan: () => void;
	onEdit: (e: EventView) => void;
	onAct: (body: Record<string, unknown>, success?: string) => Promise<boolean>;
	onProjector: (e: EventView) => void;
	onDeleted: () => void;
}

export function EventDetail({
	event: e,
	manage,
	now,
	locale,
	busy,
	notify,
	refetch,
	tabOf,
	setTab,
	onRegister,
	onUnregister,
	onOpenTicket,
	onStartScan,
	onEdit,
	onAct,
	onProjector,
	onDeleted,
}: Props) {
	const { t } = useI18n();
	const dialog = useDialog();

	const meta = typeMeta(e.tur);
	const live = isLive(e, now);
	const ended = e.endTime < now;
	const full = e.kapasite > 0 && e.kayitliSayisi >= e.kapasite;
	const canRegister = e.status === 'yayinda' && !ended && !e.benimKaydim;
	const canCheckIn = e.status === 'yayinda' && Number(e.yoklamaAcik) === 1 && !e.benimYoklamam && !ended;

	return (
		<div style={{ '--type-color': meta.color } as React.CSSProperties} data-event-id={e.id}>
			<header className={styles.hero}>
				<div className={styles.badges}>
					<span className={`${styles.badge} ${styles.b_type}`}>{t(meta.key)}</span>
					{live && <span className={`${styles.badge} ${styles.b_live}`}>{t('evLive')}</span>}
					{e.status === 'taslak' && <span className={`${styles.badge} ${styles.b_draft}`}>{t('evDraft')}</span>}
					{e.status === 'iptal' && <span className={`${styles.badge} ${styles.b_cancelled}`}>{t('evCancelled')}</span>}
					{e.benimYoklamam ? (
						<span className={`${styles.badge} ${styles.b_attended}`}>
							<CheckCircle2 size={10} /> {t('evAttended')}
						</span>
					) : (
						e.benimKaydim && <span className={`${styles.badge} ${styles.b_registered}`}>{t('evRegistered')}</span>
					)}
				</div>
				<h2 className={styles.heroTitle}>{e.baslik}</h2>
			</header>
			<div className={styles.content}>
				<div className={styles.facts}>
					<div className={styles.fact}>
						<span className={styles.factIcon}>
							<Clock size={15} />
						</span>
						<div>
							<div className={styles.factLabel}>{t('evWhen')}</div>
							<div className={styles.factValue}>{formatRange(e.baslangic, e.endTime, locale)}</div>
						</div>
					</div>
					<div className={styles.fact}>
						<span className={styles.factIcon}>
							<MapPin size={15} />
						</span>
						<div>
							<div className={styles.factLabel}>{t('evWhere')}</div>
							<div className={styles.factValue}>{e.konum}</div>
						</div>
					</div>
					<div className={styles.fact}>
						<span className={styles.factIcon}>
							<Users size={15} />
						</span>
						<div style={{ flex: 1 }}>
							<div className={styles.factLabel}>{t('evCapacity')}</div>
							<div className={styles.factValue}>
								{e.kapasite > 0 ? `${e.kayitliSayisi} / ${e.kapasite}` : `${e.kayitliSayisi} · ${t('evUnlimited')}`}
							</div>
							{e.kapasite > 0 && (
								<div className={styles.meter}>
									<span style={{ width: `${Math.min(100, (e.kayitliSayisi / e.kapasite) * 100)}%` }} />
								</div>
							)}
							<div className={styles.factLabel} style={{ marginTop: 4 }}>
								{ended || live
									? fill(t('evAttendedCount'), { n: e.katilimciSayisi })
									: full
									? t('evFull')
									: e.kapasite > 0
									? fill(t('evSeatsLeft'), { n: e.kapasite - e.kayitliSayisi })
									: ''}
							</div>
						</div>
					</div>
				</div>

				{e.benimYoklamam && (
					<div className={styles.attendedBanner}>
						<CheckCircle2 size={18} />
						{fill(t('evAttendedAt'), {
							when: new Date(e.benimYoklamam.katilimZamani).toLocaleString(locale, {
								hour: '2-digit',
								minute: '2-digit',
								day: 'numeric',
								month: 'short',
							}),
						})}
					</div>
				)}

				<div className={styles.actions}>
					{canRegister && (
						<button
							type="button"
							className={`${ui.primaryBtn} ${styles.bigBtn}`}
							disabled={busy || full}
							onClick={() => onRegister(e)}
						>
							<Plus size={16} /> {full ? t('evFull') : t('evRegister')}
						</button>
					)}
					{e.benimKaydim && e.biletKodu && (
						<button type="button" className={`${ui.btn} ${styles.bigBtn}`} onClick={() => onOpenTicket(e)}>
							<Ticket size={16} /> {t('evMyTicket')}
						</button>
					)}
					{canCheckIn && (
						<button
							type="button"
							className={`${ui.primaryBtn} ${styles.bigBtn}`}
							style={{ background: '#30d158' }}
							onClick={onStartScan}
						>
							<QrCode size={16} /> {t('evCheckIn')}
						</button>
					)}
					{e.benimKaydim && e.baslangic > now && e.status === 'yayinda' && (
						<button type="button" className={`${ui.btn} ${styles.bigBtn}`} disabled={busy} onClick={() => onUnregister(e)}>
							<X size={15} /> {t('evCancelRegistration')}
						</button>
					)}
					{e.benimKaydim && e.baslangic <= now && !ended && e.status === 'yayinda' && (
						<span className={ui.muted} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
							<Info size={14} /> {t('evRegistrationLockedStarted')}
						</span>
					)}
					{!canRegister && !e.benimKaydim && !ended && e.status !== 'taslak' && (
						<span className={ui.muted}>{t('evRegisterClosed')}</span>
					)}
				</div>
				{canCheckIn && <div className={ui.hint}>{t('evCheckInHint')}</div>}

				{e.aciklama && (
					<section>
						<h3 className={ui.sectionTitle}>{t('evAbout')}</h3>
						<div className={ui.descView}>
							<Linkified text={e.aciklama} />
						</div>
					</section>
				)}

				{manage && (
					<>
						<div className={styles.actions} style={{ paddingTop: 4 }}>
							<button type="button" className={ui.btn} onClick={() => onEdit(e)}>
								<Pencil size={14} /> {t('evEdit')}
							</button>
							{e.status === 'taslak' && (
								<button
									type="button"
									className={ui.primaryBtn}
									style={{ height: 30 }}
									onClick={() =>
										onAct({ action: 'updateEvent', etkinlikId: e.id, status: 'yayinda' }).then(
											(ok) => ok && setTab(tabOf({ ...e, status: 'yayinda' }))
										)
									}
								>
									<Send size={14} /> {t('evPublish')}
								</button>
							)}
							{e.status === 'yayinda' && !ended && (
								<button
									type="button"
									className={ui.btn}
									onClick={async () => {
										if (await dialog.confirm({ message: fill(t('evCancelEventConfirm'), { title: e.baslik }), tone: 'danger' })) {
											await onAct({ action: 'updateEvent', etkinlikId: e.id, status: 'iptal' });
										}
									}}
								>
									<Ban size={14} /> {t('evCancelEvent')}
								</button>
							)}
							{e.status === 'iptal' && (
								<button type="button" className={ui.btn} onClick={() => onAct({ action: 'updateEvent', etkinlikId: e.id, status: 'yayinda' })}>
									<Send size={14} /> {t('evRestore')}
								</button>
							)}
							{e.katilimciSayisi === 0 && (
								<button
									type="button"
									className={`${ui.btn} ${ui.btnDanger}`}
									style={{ marginLeft: 'auto' }}
									onClick={async () => {
										if (await dialog.confirm({ message: fill(t('evDeleteConfirm'), { title: e.baslik }), tone: 'danger' })) {
											if (await onAct({ action: 'deleteEvent', etkinlikId: e.id })) onDeleted();
										}
									}}
								>
									<Trash2 size={14} /> {t('evDelete')}
								</button>
							)}
						</div>
						{e.status !== 'taslak' && (
							<AttendancePanel key={e.id} event={e} notify={notify} onChanged={refetch} onProjector={() => onProjector(e)} />
						)}
					</>
				)}
			</div>
		</div>
	);
}
