'use client';

import React, { useState } from 'react';
import { Download, ListChecks, ScanLine, Tv, UserPlus, Undo2, UserMinus } from 'lucide-react';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useJsonResource } from '@/core/data/useJsonResource';
import { fill } from '@/lib/text';
import type { AttendeeRow } from '@/db';
import ui from '@/core/ui/ui.module.css';
import styles from './Events.module.css';
import { sendJson } from '@/core/data/http';
import { CameraQRScannerModal } from '@/apps/events/components/CameraQRScannerModal';
import type { EventView } from './eventsShared';
import { downloadCsv } from '@/core/data/download';

interface Props {
	event: EventView;
	notify: (text: string, tone?: 'success' | 'error') => void;
	onChanged: () => Promise<void>;
	onProjector: () => void;
}

const METHOD_KEY: Record<string, string> = { qr: 'evMethodQr', bilet: 'evMethodBilet', manuel: 'evMethodManuel' };

/** Organiser tools for one event: check-in switch, projector, ticket scan, manual entry, the list and CSV. */
export function AttendancePanel({ event, notify, onChanged, onProjector }: Props) {
	const { t, language } = useI18n();
	const { playSystemSound } = useSound();
	const dialog = useDialog();
	const locale = language === 'en' ? 'en-GB' : 'tr-TR';
	const { data, refetch } = useJsonResource<{ liste: AttendeeRow[] }>(
		`/api/events/${encodeURIComponent(event.id)}/katilim`
	);
	const liste = data?.liste ?? [];
	const [ogrenciNo, setOgrenciNo] = useState('');
	const [scanning, setScanning] = useState(false);
	const open = Number(event.yoklamaAcik) === 1;

	const post = async (body: Record<string, unknown>, quiet = false) => {
		const res = await sendJson<{ message?: string; zaten?: boolean }>('/api/events', 'POST', { etkinlikId: event.id, ...body });
		if (!res.ok) notify(res.error || t('kbActionFailed'), 'error');
		else {
			if (!res.data.zaten) playSystemSound();
			if (!quiet && res.data.message) notify(res.data.message, res.data.zaten ? 'error' : 'success');
		}
		await Promise.all([refetch(), onChanged()]);
		return res.ok;
	};

	const time = (ms: number | null) =>
		ms ? new Date(ms).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

	const exportCsv = () => {
		downloadCsv(
			`${event.slug || event.id}-${t('evCsvName')}`,
			[t('evColName'), t('evStudentNo'), 'Bölüm', t('evColReg'), t('evColAttend'), 'Yöntem', t('evColBy')],
			liste.map((r) => [
				r.adSoyad,
				r.ogrenciNo,
				r.bolum,
				r.kayitZamani ? new Date(r.kayitZamani).toISOString() : '',
				r.katilimZamani ? new Date(r.katilimZamani).toISOString() : '',
				r.yontem ? t(METHOD_KEY[r.yontem]) : '',
				r.kaydedenAdSoyad,
			])
		);
	};

	const attended = liste.filter((r) => r.katilimZamani).length;

	return (
		<section className={styles.panel} aria-label={t('evManage')}>
			<div className={styles.panelHead}>
				<h3 className={styles.panelTitle}>
					<ListChecks size={15} /> {t('evList')}
					<span className={ui.count}>
						{attended}/{liste.length}
					</span>
				</h3>
				{event.status === 'yayinda' && (
					<label className={styles.switch}>
						<input type="checkbox" checked={open} onChange={() => post({ action: 'setYoklama', acik: !open }, true)} />
						{open ? t('evAttendanceOpen') : t('evAttendanceClosed')}
					</label>
				)}
			</div>
			<div className={styles.panelHead} style={{ background: 'transparent' }}>
				<button type="button" className={ui.btn} disabled={!open} onClick={onProjector}>
					<Tv size={14} /> {t('evProjector')}
				</button>
				<button type="button" className={ui.btn} onClick={() => setScanning(true)}>
					<ScanLine size={14} /> {t('evScanTickets')}
				</button>
				<form
					style={{ display: 'flex', gap: 6 }}
					onSubmit={async (e) => {
						e.preventDefault();
						if (!ogrenciNo.trim()) return;
						if (await post({ action: 'manuelYoklama', ogrenciNo: ogrenciNo.trim() })) setOgrenciNo('');
					}}
				>
					<input
						className={ui.input}
						style={{ width: 150, height: 30, padding: '4px 8px' }}
						value={ogrenciNo}
						inputMode="numeric"
						onChange={(e) => setOgrenciNo(e.target.value)}
						placeholder={t('evManualPh')}
						aria-label={t('evManualAdd')}
					/>
					<button type="submit" className={ui.btn} disabled={!ogrenciNo.trim()}>
						<UserPlus size={14} /> {t('evAdd')}
					</button>
				</form>
				<button type="button" className={ui.btn} style={{ marginLeft: 'auto' }} disabled={!liste.length} onClick={exportCsv}>
					<Download size={14} /> {t('evExportCsv')}
				</button>
			</div>
			{liste.length === 0 ? (
				<div className={styles.empty}>{t('evListEmpty')}</div>
			) : (
				<div style={{ overflowX: 'auto' }}>
					<table className={styles.table}>
						<thead>
							<tr>
								<th>{t('evColName')}</th>
								<th>{t('evColReg')}</th>
								<th>{t('evColAttend')}</th>
								<th>{t('evColBy')}</th>
								<th aria-label="" />
							</tr>
						</thead>
						<tbody>
							{liste.map((r) => (
								<tr key={r.userId} data-member-id={r.userId}>
									<td>
										<div style={{ fontWeight: 650 }}>{r.adSoyad}</div>
										<div className={styles.mono}>{r.ogrenciNo || '—'}</div>
									</td>
									<td>{r.kayitZamani ? time(r.kayitZamani) : <span className={`${styles.badge} ${styles.b_draft}`}>{t('evWalkIn')}</span>}</td>
									<td>
										{r.katilimZamani ? (
											<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
												<span className={`${styles.badge} ${styles.b_attended}`}>{t(METHOD_KEY[r.yontem ?? 'qr'])}</span>
												{time(r.katilimZamani)}
											</span>
										) : (
											'—'
										)}
									</td>
									<td>{r.kaydedenAdSoyad || '—'}</td>
									<td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
										{r.katilimZamani ? (
											<button
												type="button"
												className={ui.iconBtn}
												title={t('evRemoveCheckIn')}
												aria-label={t('evRemoveCheckIn')}
												onClick={async () => {
													if (await dialog.confirm({ message: fill(t('evRemoveConfirm'), { name: r.adSoyad }), tone: 'danger' })) {
														await post({ action: 'deleteAttendance', userId: r.userId }, true);
													}
												}}
											>
												<Undo2 size={14} />
											</button>
										) : r.kayitZamani ? (
											<button
												type="button"
												className={ui.iconBtn}
												title={t('evRemoveRegistration')}
												aria-label={t('evRemoveRegistration')}
												onClick={async () => {
													if (await dialog.confirm({ message: fill(t('evRemoveRegistrationConfirm'), { name: r.adSoyad }), tone: 'danger' })) {
														await post({ action: 'kayitSil', userId: r.userId }, true);
													}
												}}
											>
												<UserMinus size={14} />
											</button>
										) : null}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<CameraQRScannerModal
				isOpen={scanning}
				continuous
				mode="staff"
				title={t('evScanTitleStaff')}
				onClose={() => setScanning(false)}
				onScan={async (kod) => {
					// Stays open for the next person in the queue.
					await post({ action: 'biletOkut', kod });
				}}
			/>
		</section>
	);
}
