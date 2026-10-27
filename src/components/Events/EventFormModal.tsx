'use client';

import React, { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { toDateInput } from '@/lib/kanban';
import { ETKINLIK_BASLIK_MAX, ETKINLIK_TURLERI, type EventType } from '@/lib/events';
import ui from '@/core/ui/ui.module.css';
import { sendJson } from '@/core/data/http';
import { TYPE_META, type EventView } from './eventsShared';
import { Sheet } from '@/core/ui/Sheet';

interface Props {
	event: EventView | null;
	onClose: () => void;
	onSaved: (id: string, created: boolean) => void;
}

const hhmm = (ms: number) => {
	const d = new Date(ms);
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Local date + time inputs to an instant. */
function at(date: string, time: string): number {
	const [y, m, d] = date.split('-').map(Number);
	const [hh, mm] = time.split(':').map(Number);
	return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

export function EventFormModal({ event, onClose, onSaved }: Props) {
	const { t } = useI18n();
	// A new event defaults to a week from now, 14:00–16:00.
	const [defaults] = useState(() => {
		const d = new Date();
		d.setDate(d.getDate() + 7);
		d.setHours(14, 0, 0, 0);
		return d.getTime();
	});
	const start0 = event?.baslangic ?? defaults;
	const end0 = event?.endTime ?? defaults + 2 * 3_600_000;
	const [baslik, setBaslik] = useState(event?.baslik ?? '');
	const [tur, setTur] = useState<EventType>(event?.tur ?? 'atolye');
	const [aciklama, setAciklama] = useState(event?.aciklama ?? '');
	const [konum, setKonum] = useState(event?.konum ?? '');
	const [date, setDate] = useState(toDateInput(start0));
	const [startTime, setStartTime] = useState(hhmm(start0));
	const [endTime, setEndTime] = useState(hhmm(end0));
	const [kapasite, setKapasite] = useState(String(event?.kapasite ?? 50));
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const save = async (draft: boolean) => {
		if (busy) return;
		setError('');
		const baslangic = at(date, startTime);
		let endTimestamp = at(date, endTime);
		// An end time earlier than the start means it runs past midnight.
		if (endTimestamp <= baslangic) endTimestamp += 86_400_000;
		const fields = { baslik, tur, aciklama, konum, baslangic, endTime: endTimestamp, kapasite: Number(kapasite) };
		setBusy(true);
		const res = event
			? await sendJson('/api/events', 'POST', {
					action: 'updateEvent',
					etkinlikId: event.id,
					...fields,
				})
			: await sendJson<{ id: string }>('/api/events', 'POST', {
					action: 'createEvent',
					...fields,
					status: draft ? 'taslak' : 'yayinda',
				});
		setBusy(false);
		if (!res.ok) {
			setError(res.error || t('kbActionFailed'));
			return;
		}
		onSaved(event?.id ?? (res.data as { id: string }).id, !event);
	};

	return (
		<Sheet
			title={event ? t('evFormEdit') : t('evFormNew')}
			icon={<CalendarPlus size={20} color="#0a84ff" />}
			onClose={onClose}
			onSubmit={(e) => {
				e.preventDefault();
				void save(false);
			}}
			maxWidth={600}
			closeLabel={t('kbClose')}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('evCancel')}
					</button>
					{!event && (
						<button type="button" className={ui.btn} disabled={busy} onClick={() => save(true)}>
							{t('evSaveDraft')}
						</button>
					)}
					<button type="submit" className={ui.primaryBtn} disabled={busy}>
						{event ? t('evSave') : t('evPublish')}
					</button>
				</>
			}
		>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('evFieldTitle')}</span>
				<input
					className={ui.input}
					autoFocus
					required
					minLength={3}
					maxLength={ETKINLIK_BASLIK_MAX}
					value={baslik}
					onChange={(e) => setBaslik(e.target.value)}
				/>
			</label>
			<div className={ui.field}>
				<span className={ui.fieldLabel}>{t('evFieldType')}</span>
				<div className={ui.prioPicker} role="radiogroup">
					{ETKINLIK_TURLERI.map((x) => (
						<button
							key={x}
							type="button"
							role="radio"
							aria-checked={tur === x}
							className={`${ui.prioOption} ${tur === x ? ui.prioOptionActive : ''}`}
							style={{ '--prio': TYPE_META[x].color } as React.CSSProperties}
							onClick={() => setTur(x)}
						>
							{t(TYPE_META[x].key)}
						</button>
					))}
				</div>
			</div>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('evFieldPlace')}</span>
				<input
					className={ui.input}
					required
					value={konum}
					onChange={(e) => setKonum(e.target.value)}
					placeholder="Mühendislik Fakültesi D-101"
				/>
			</label>
			<div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 10 }}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('evFieldDate')}</span>
					<input
						className={ui.input}
						type="date"
						required
						value={date}
						onChange={(e) => setDate(e.target.value)}
					/>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('evFieldStart')}</span>
					<input
						className={ui.input}
						type="time"
						required
						value={startTime}
						onChange={(e) => setStartTime(e.target.value)}
					/>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('evFieldEnd')}</span>
					<input
						className={ui.input}
						type="time"
						required
						value={endTime}
						onChange={(e) => setEndTime(e.target.value)}
					/>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel} title={t('evFieldCapacity')}>
						{t('evCapacity')}
					</span>
					<input
						className={ui.input}
						type="number"
						min={0}
						max={5000}
						value={kapasite}
						onChange={(e) => setKapasite(e.target.value)}
					/>
				</label>
			</div>
			<span className={ui.hint} style={{ marginTop: -8 }}>
				{t('evFieldCapacity')}
			</span>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('evFieldDesc')}</span>
				<textarea
					className={ui.textarea}
					rows={4}
					value={aciklama}
					onChange={(e) => setAciklama(e.target.value)}
				/>
			</label>
			{error && (
				<div className={ui.error} role="alert">
					{error}
				</div>
			)}
		</Sheet>
	);
}
