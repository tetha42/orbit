'use client';

import React, { useState } from 'react';
import { Receipt } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { BUTCE_KATEGORILERI, MAX_TUTAR_KURUS } from '@/types/budget';
import { formatKurus, parseTutar, tarihInputToMs } from '@/lib/budget';
import { toDateInput } from '@/lib/kanban';
import ui from '@/core/ui/ui.module.css';
import { sendJson } from '@/core/data/http';
import k from './Kasa.module.css';
import type { KasaRecord } from '../types';
import { Sheet } from '@/core/ui/Sheet';
import { ReceiptUploadField } from './ReceiptUploadField';
import { useNow } from '@/lib/client/useSheet';
import { compressImageToWebp } from '@/lib/client/imageCompress';
import { fill } from '@/lib/text';

interface KasaEntryModalProps {
	teamId: string | null;
	registration?: KasaRecord;
	netBakiyeKurus: number;
	onClose: () => void;
	onSaved: (message: string) => void;
}

export function KasaEntryModal({
	teamId,
	registration,
	netBakiyeKurus,
	onClose,
	onSaved,
}: KasaEntryModalProps) {
	const { t } = useI18n();
	const editing = !!registration;
	const transfer = !!registration?.aktarimId;
	const now = useNow(60_000);
	const today = toDateInput(now);

	const [tur, setTur] = useState<'gelir' | 'gider'>(registration?.tur ?? 'gider');
	const [kategori, setKategori] = useState<string>(registration?.kategori ?? t('kasaCatHardware'));
	const [tutar, setTutar] = useState('');
	const [date, setTarih] = useState(() => toDateInput(registration?.date ?? now));
	const [aciklama, setAciklama] = useState(registration?.aciklama ?? '');
	const [fisFotoUrl, setFisFotoUrl] = useState<string | null>(registration?.fisFotoUrl ?? null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);

	const kurus = editing ? registration.tutarKurus : parseTutar(tutar);
	const overdraft = !editing && tur === 'gider' && kurus !== null && kurus > netBakiyeKurus;

	const upload = async (file: File | undefined) => {
		if (!file) return;
		setUploading(true);
		setError('');
		try {
			const compressed = await compressImageToWebp(file, 1280, 0.85);
			const fd = new FormData();
			const fileName = compressed.type === 'image/webp' ? 'receipt.webp' : (file.name || 'receipt.jpg');
			fd.append('file', compressed, fileName);
			const res = await fetch('/api/upload', { method: 'POST', body: fd });
			const body = await res.json().catch(() => ({}));
			if (res.ok && body.url) setFisFotoUrl(body.url);
			else setError(body.error || t('kasaUploadFailed'));
		} catch {
			setError(t('kasaUploadFailed'));
		} finally {
			setUploading(false);
		}
	};

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		const ms = tarihInputToMs(date, Date.now());
		if (ms === null) return setError(t('kasaInvalidDate'));
		if (!aciklama.trim()) return setError(t('kasaDescRequired'));
		if (!editing) {
			if (kurus === null) return setError(t('kasaInvalidAmount'));
			if (kurus > MAX_TUTAR_KURUS)
				return setError(fill(t('kasaMaxAmountError'), { max: formatKurus(MAX_TUTAR_KURUS) }));
		}
		setBusy(true);
		const res = editing
			? await sendJson('/api/budget', 'PATCH', {
					id: registration.id,
					aciklama: aciklama.trim(),
					date: ms,
					...(transfer ? {} : { kategori, fisFotoUrl }),
				})
			: await sendJson('/api/budget', 'POST', {
					teamId,
					tur,
					kategori,
					tutarKurus: kurus,
					aciklama: aciklama.trim(),
					date: ms,
					fisFotoUrl: fisFotoUrl || undefined,
				});
		setBusy(false);
		if (!res.ok) return setError(res.error || t('actionFailed'));
		onSaved(editing ? t('kasaRecordUpdated') : t('kasaRecordAdded'));
	};

	return (
		<Sheet
			title={editing ? t('kasaEditTitle') : t('kasaNewTitle')}
			label={editing ? t('kasaEditTitle') : t('kasaNewTitle')}
			icon={<Receipt size={18} color="#0a84ff" />}
			onClose={onClose}
			onSubmit={submit}
			maxWidth={620}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('cancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={busy || uploading || overdraft}>
						{busy ? t('saving') : t('save')}
					</button>
				</>
			}
		>
			{!editing ? (
				<div className={ui.segmented} role="radiogroup" aria-label={t('budgetColType')}>
					{(['gider', 'gelir'] as const).map((typeOpt) => (
						<button
							key={typeOpt}
							type="button"
							role="radio"
							aria-checked={tur === typeOpt}
							className={`${ui.segment} ${tur === typeOpt ? ui.segmentActive : ''}`}
							onClick={() => setTur(typeOpt)}
						>
							{typeOpt === 'gider' ? t('kasaExpenseOption') : t('kasaIncomeOption')}
						</button>
					))}
				</div>
			) : (
				<div className={k.balanceHint}>
					<span className={`${k.tag} ${registration.tur === 'gelir' ? k.tagIn : k.tagOut}`}>
						{registration.tur === 'gelir' ? t('kasaTagIncome') : t('kasaTagExpense')}
					</span>{' '}
					<strong>{formatKurus(registration.tutarKurus)} ₺</strong> — {t('kasaTypeAmountLockedNotice')}
				</div>
			)}

			<div className={k.grid3}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('budgetColCategory')}</span>
					{transfer ? (
						<input className={ui.input} value={registration.kategori} disabled />
					) : (
						<select
							className={ui.select}
							style={{ maxWidth: 'none', width: '100%' }}
							value={kategori}
							onChange={(e) => setKategori(e.target.value)}
						>
							{BUTCE_KATEGORILERI.map((c) => (
								<option key={c} value={c}>
									{c}
								</option>
							))}
						</select>
					)}
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('budgetColAmount')}</span>
					{editing ? (
						<input className={ui.input} value={formatKurus(registration.tutarKurus)} disabled />
					) : (
						<input
							className={ui.input}
							inputMode="decimal"
							placeholder="1.250,00"
							value={tutar}
							onChange={(e) => setTutar(e.target.value)}
							required
							autoFocus
						/>
					)}
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('kasaDateLabel')}</span>
					<input
						className={ui.input}
						type="date"
						value={date}
						max={today}
						onChange={(e) => setTarih(e.target.value)}
						required
					/>
				</label>
			</div>
			{!editing && (
				<div className={k.balanceHint}>
					{t('kasaCurrentBalance')} <strong>{formatKurus(netBakiyeKurus)} ₺</strong>
					{kurus !== null && (
						<>
							{' '}
							{t('kasaAfterEntry')}{' '}
							<strong className={overdraft ? k.neg : undefined}>
								{formatKurus(netBakiyeKurus + (tur === 'gelir' ? kurus : -kurus))} ₺
							</strong>
						</>
					)}
					{overdraft && <span className={k.neg}> {t('kasaCannotOverdraft')}</span>}
				</div>
			)}

			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('budgetColTitle')}</span>
				<textarea
					className={ui.textarea}
					rows={3}
					maxLength={500}
					placeholder={t('kasaDescPh')}
					value={aciklama}
					onChange={(e) => setAciklama(e.target.value)}
					required
				/>
			</label>

			{!transfer && (
				<ReceiptUploadField
					fisFotoUrl={fisFotoUrl}
					uploading={uploading}
					onUpload={upload}
					onRemove={() => setFisFotoUrl(null)}
				/>
			)}

			{error && <div className={ui.error}>{error}</div>}
		</Sheet>
	);
}
