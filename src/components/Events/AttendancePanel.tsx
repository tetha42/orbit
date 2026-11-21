'use client';

import React, { useState } from 'react';
import { Download, ListChecks, ScanLine, Tv, UserPlus, Undo2, UserMinus } from 'lucide-react';
import { useSound } from '@/core/sound';
import { resolveLocalizedText, useI18n } from '@/core/i18n';
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

const METHOD_KEY: Record<string, string> = { qr: 'evMethodQr', ticket: 'evMethodTicket', manual: 'evMethodManual' };

/** Organiser tools for one event: check-in switch, projector, ticket scan, manual entry, the list and CSV. */
export function AttendancePanel({ event, notify, onChanged, onProjector }: Props) {
	const { t, language } = useI18n();
	const { playSystemSound } = useSound();
	const dialog = useDialog();
	const locale = resolveLocalizedText({ en: 'en-GB', tr: 'tr-TR' }, language, 'tr-TR');
	const { data, refetch } = useJsonResource<{ list: AttendeeRow[] }>(
		`/api/events/${encodeURIComponent(event.id)}/attendance`
	);
	const list = data?.list ?? [];
	const [studentNo, setStudentNo] = useState('');
	const [scanning, setScanning] = useState(false);
	const open = Number(event.attendanceOpen) === 1;

	const post = async (body: Record<string, unknown>, quiet = false) => {
		const res = await sendJson<{ message?: string; already?: boolean; member?: { nameSurname?: string } }>('/api/events', 'POST', {
			eventId: event.id,
			...body,
		});
		if (!res.ok) notify(res.error || t('kbActionFailed'), 'error');
		else {
			if (!res.data.already) playSystemSound();
			const name = res.data.member?.nameSurname ?? '';
			if (!quiet && body.action === 'scanTicket') {
				notify(
					fill(res.data.already ? t('evAlreadyCheckedIn') : t('evCheckedInRecorded'), { name }),
					res.data.already ? 'error' : 'success'
				);
			} else if (!quiet && body.action === 'manualAttendance') {
				notify(fill(t('evManualAdded'), { name }), 'success');
			} else if (!quiet && body.action === 'deleteAttendance') {
				notify(fill(t('evCheckInRemoved'), { name }), 'success');
			} else if (!quiet && body.action === 'removeRegistration') {
				notify(fill(t('evRegistrationRemoved'), { name }), 'success');
			}
		}
		await Promise.all([refetch(), onChanged()]);
		return res.ok;
	};

	const time = (ms: number | null) =>
		ms ? new Date(ms).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

	const exportCsv = () => {
		downloadCsv(
			`${event.slug || event.id}-${t('evCsvName')}`,
			[t('evColName'), t('evStudentNo'), t('department'), t('evColReg'), t('evColAttend'), t('evColMethod'), t('evColBy')],
			list.map((r) => [
				r.nameSurname,
				r.studentNo,
				r.department,
				r.recordTime ? new Date(r.recordTime).toISOString() : '',
				r.participationTime ? new Date(r.participationTime).toISOString() : '',
				r.method ? t(METHOD_KEY[r.method]) : '',
				r.recorderNameSurname,
			])
		);
	};

	const attended = list.filter((r) => r.participationTime).length;

	return (
		<section className={styles.panel} aria-label={t('evManage')}>
			<div className={styles.panelHead}>
				<h3 className={styles.panelTitle}>
					<ListChecks size={15} /> {t('evList')}
					<span className={ui.count}>
						{attended}/{list.length}
					</span>
				</h3>
				{event.status === 'published' && (
					<label className={styles.switch}>
						<input type="checkbox" checked={open} onChange={() => post({ action: 'setAttendance', open: !open }, true)} />
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
						if (!studentNo.trim()) return;
						if (await post({ action: 'manualAttendance', studentNo: studentNo.trim() })) setStudentNo('');
					}}
				>
					<input
						className={ui.input}
						style={{ width: 150, height: 30, padding: '4px 8px' }}
						value={studentNo}
						inputMode="numeric"
						onChange={(e) => setStudentNo(e.target.value)}
						placeholder={t('evManualPh')}
						aria-label={t('evManualAdd')}
					/>
					<button type="submit" className={ui.btn} disabled={!studentNo.trim()}>
						<UserPlus size={14} /> {t('evAdd')}
					</button>
				</form>
				<button type="button" className={ui.btn} style={{ marginLeft: 'auto' }} disabled={!list.length} onClick={exportCsv}>
					<Download size={14} /> {t('evExportCsv')}
				</button>
			</div>
			{list.length === 0 ? (
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
							{list.map((r) => (
								<tr key={r.userId} data-member-id={r.userId}>
									<td>
										<div style={{ fontWeight: 650 }}>{r.nameSurname}</div>
										<div className={styles.mono}>{r.studentNo || '—'}</div>
									</td>
									<td>{r.recordTime ? time(r.recordTime) : <span className={`${styles.badge} ${styles.b_draft}`}>{t('evWalkIn')}</span>}</td>
									<td>
										{r.participationTime ? (
											<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
												<span className={`${styles.badge} ${styles.b_attended}`}>{t(METHOD_KEY[r.method ?? 'qr'])}</span>
												{time(r.participationTime)}
											</span>
										) : (
											'—'
										)}
									</td>
									<td>{r.recorderNameSurname || '—'}</td>
									<td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
										{r.participationTime ? (
											<button
												type="button"
												className={ui.iconBtn}
												title={t('evRemoveCheckIn')}
												aria-label={t('evRemoveCheckIn')}
												onClick={async () => {
													if (await dialog.confirm({ message: fill(t('evRemoveConfirm'), { name: r.nameSurname }), tone: 'danger' })) {
														await post({ action: 'deleteAttendance', userId: r.userId }, true);
													}
												}}
											>
												<Undo2 size={14} />
											</button>
										) : r.recordTime ? (
											<button
												type="button"
												className={ui.iconBtn}
												title={t('evRemoveRegistration')}
												aria-label={t('evRemoveRegistration')}
												onClick={async () => {
													if (await dialog.confirm({ message: fill(t('evRemoveRegistrationConfirm'), { name: r.nameSurname }), tone: 'danger' })) {
														await post({ action: 'removeRegistration', userId: r.userId }, true);
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
				onScan={async (code) => {
					// Stays open for the next person in the queue.
					await post({ action: 'scanTicket', code });
				}}
			/>
		</section>
	);
}
