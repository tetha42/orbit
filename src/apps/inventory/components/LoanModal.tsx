'use client';

import React, { useState } from 'react';
import { CalendarClock, PackageCheck, PackageOpen } from 'lucide-react';
import { useJsonResource } from '@/core/data/useJsonResource';
import { toDateInput } from '@/lib/kanban';
import {
	EN_UZUN_ODUNC_GUN,
	VARSAYILAN_ODUNC_GUN,
	YONETIM_EN_UZUN_ODUNC_GUN,
	gunSonu,
} from '@/lib/inventory';
import ui from '@/core/ui/ui.module.css';
import { sendJson } from '@/core/data/http';
import s from './Inventory.module.css';
import { trDate, type InventoryItem } from '../types';
import { Sheet } from '@/core/ui/Sheet';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';

const DAY = 86_400_000;

export type LoanMode = 'borrow' | 'lend' | 'extend' | 'return';

interface Member {
	id: string;
	ad: string;
	soyad: string;
	status?: string;
}

/**
 * The three loan actions in one small sheet:
 *  - borrow / lend (management, for a member): pick the return date
 *  - extend: move the return date (members: within 30 days of the loan's start)
 *  - return: optionally report the item broken, with a note
 */
export function LoanModal({
	item,
	mode,
	isManager,
	selfId,
	onClose,
	onDone,
}: {
	item: InventoryItem;
	mode: LoanMode;
	isManager: boolean;
	selfId: string | null;
	onClose: () => void;
	onDone: (message: string) => void;
}) {
	const { t } = useI18n();
	// Dates for the picker's bounds; taken once so rendering stays pure.
	const [now] = useState(() => Date.now());
	const start = mode === 'extend' ? (item.oduncTarihi ?? now) : now;
	const maxDays = isManager ? YONETIM_EN_UZUN_ODUNC_GUN : EN_UZUN_ODUNC_GUN;
	const maxDate = toDateInput(start + maxDays * DAY);
	const initial =
		mode === 'extend'
			? Math.min((item.iadeTarihi ?? now) + 7 * DAY, start + maxDays * DAY)
			: now + VARSAYILAN_ODUNC_GUN * DAY;
	const [date, setTarih] = useState(() => toDateInput(initial));
	const [userId, setKullaniciId] = useState('');
	const [ariza, setAriza] = useState(false);
	const [not, setNot] = useState('');
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const { data: members } = useJsonResource<{ members: Member[] }>(
		mode === 'lend' ? '/api/members' : null,
	);
	const activeMembers = (members?.members ?? []).filter(
		(m) => (m.status ?? 'aktif') === 'aktif' && m.id !== selfId,
	);

	const title = {
		borrow: t('invBorrowBtn'),
		lend: t('invLendForMember'),
		extend: t('invExtendLoan'),
		return: t('invReturnBtn'),
	}[mode];
	const Icon = mode === 'return' ? PackageCheck : mode === 'extend' ? CalendarClock : PackageOpen;

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		let body: Record<string, unknown>;
		if (mode === 'return') {
			body = { action: 'iadeEt', envanterId: item.id, ariza, not: not.trim() };
		} else {
			const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
			if (!m) return setError(t('invSelectDate'));
			const iadeTarihi = gunSonu(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime());
			if (mode === 'lend' && !userId) return setError(t('invSelectMemberPrompt'));
			body = {
				action: mode === 'extend' ? 'uzat' : 'oduncAl',
				envanterId: item.id,
				iadeTarihi,
				...(mode === 'lend' ? { userId } : {}),
			};
		}
		setBusy(true);
		const res = await sendJson<{ message?: string }>('/api/inventory', 'POST', body);
		setBusy(false);
		if (!res.ok) return setError(res.error || t('actionFailed'));
		onDone(res.data.message || t('saved'));
	};

	return (
		<Sheet
			header={
				<>
					<div style={{ flex: 1, minWidth: 0 }}>
						<h3 style={{ margin: 0, fontSize: 16, fontWeight: 750 }}>{title}</h3>
						<div className={ui.muted} style={{ fontSize: 12 }}>
							<span className={s.code}>{item.kod}</span> {item.ad}
						</div>
					</div>
				</>
			}
			label={title}
			icon={<Icon size={18} color="#0a84ff" />}
			onClose={onClose}
			onSubmit={submit}
			maxWidth={480}
			bodyStyle={{}}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('cancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={busy}>
						{busy ? t('saving') : title}
					</button>
				</>
			}
		>
			{mode === 'lend' && (
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('membersMember')}</span>
					<select
						className={ui.select}
						style={{ maxWidth: 'none', width: '100%' }}
						value={userId}
						onChange={(e) => setKullaniciId(e.target.value)}
						required
					>
						<option value="">{members ? t('invSelectMember') : t('loading')}</option>
						{activeMembers.map((m) => (
							<option key={m.id} value={m.id}>
								{m.ad} {m.soyad}
							</option>
						))}
					</select>
				</label>
			)}
			{mode !== 'return' ? (
				<>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>
							{mode === 'extend' ? t('invNewDueDate') : t('invDueDate')}
						</span>
						<input
							className={ui.input}
							type="date"
							value={date}
							min={toDateInput(now)}
							max={maxDate}
							onChange={(e) => setTarih(e.target.value)}
							required
						/>
					</label>
					<div className={ui.hint}>
						{mode === 'extend' && item.iadeTarihi
							? `${fill(t('invCurrentDue'), { date: trDate(item.iadeTarihi) })} `
							: ''}
						{isManager
							? fill(t('invManagerMaxDays'), { days: YONETIM_EN_UZUN_ODUNC_GUN })
							: fill(t('invMemberMaxDays'), { days: EN_UZUN_ODUNC_GUN })}
					</div>
				</>
			) : (
				<>
					<label className={s.check}>
						<input type="checkbox" checked={ariza} onChange={(e) => setAriza(e.target.checked)} />
						{t('invDefectCheckbox')}
					</label>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{ariza ? t('invDefectNoteLabel') : t('invOptionalNoteLabel')}</span>
						<textarea
							className={ui.textarea}
							rows={3}
							maxLength={500}
							value={not}
							onChange={(e) => setNot(e.target.value)}
							required={ariza}
							placeholder={
								ariza
									? t('invDefectNotePh')
									: t('invReturnNotePh')
							}
						/>
					</label>
				</>
			)}
			{error && <div className={ui.error}>{error}</div>}
		</Sheet>
	);
}
