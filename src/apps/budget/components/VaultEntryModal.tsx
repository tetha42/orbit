'use client';

import React, { useState } from 'react';
import { Receipt } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { BUDGET_CATEGORIES, MAX_AMOUNT_CENTS } from '@/types/budget';
import { formatMinor, parseAmount, dateInputToMs } from '@/lib/budget';
import { toDateInput } from '@/lib/kanban';
import ui from '@/core/ui/ui.module.css';
import { sendJson } from '@/core/data/http';
import k from './Vault.module.css';
import type { VaultRecord } from '../types';
import { Sheet } from '@/core/ui/Sheet';
import { ReceiptUploadField } from './ReceiptUploadField';
import { useNow } from '@/lib/client/useSheet';
import { compressImageToWebp } from '@/lib/client/imageCompress';
import { fill } from '@/lib/text';
import { orbitBus } from '@/core/ipc/orbitBus';

interface VaultEntryModalProps {
	teamId: string | null;
	registration?: VaultRecord;
	netBalanceMinor: number;
	onClose: () => void;
	onSaved: (message: string) => void;
}

export function VaultEntryModal({
	teamId,
	registration,
	netBalanceMinor,
	onClose,
	onSaved,
}: VaultEntryModalProps) {
	const { t } = useI18n();
	const editing = !!registration;
	const transfer = !!registration?.transferId;
	const now = useNow(60_000);
	const today = toDateInput(now);

	const [typeValue, setType] = useState<'gelir' | 'gider'>(registration?.typeValue ?? 'gider');
	const [category, setCategory] = useState<string>(registration?.category ?? t('kasaCatHardware'));
	const [amount, setAmount] = useState('');
	const [date, setDate] = useState(() => toDateInput(registration?.date ?? now));
	const [description, setDescription] = useState(registration?.description ?? '');
	const [receiptPhotoUrl, setReceiptPhotoUrl] = useState<string | null>(registration?.receiptPhotoUrl ?? null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);

	const minor = editing ? registration.amountMinor : parseAmount(amount);
	const overdraft = !editing && typeValue === 'gider' && minor !== null && minor > netBalanceMinor;

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
			if (res.ok && body.url) setReceiptPhotoUrl(body.url);
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
		const ms = dateInputToMs(date, Date.now());
		if (ms === null) return setError(t('kasaInvalidDate'));
		if (!description.trim()) return setError(t('kasaDescRequired'));
		if (!editing) {
			if (minor === null) return setError(t('kasaInvalidAmount'));
			if (minor > MAX_AMOUNT_CENTS)
				return setError(fill(t('kasaMaxAmountError'), { max: formatMinor(MAX_AMOUNT_CENTS) }));
		}
		setBusy(true);
		const res = editing
			? await sendJson('/api/budget', 'PATCH', {
					id: registration.id,
					description: description.trim(),
					date: ms,
					...(transfer ? {} : { category, receiptPhotoUrl }),
				})
			: await sendJson('/api/budget', 'POST', {
					teamId,
					typeValue,
					category,
					amountMinor: minor,
					description: description.trim(),
					date: ms,
					receiptPhotoUrl: receiptPhotoUrl || undefined,
				});
		setBusy(false);
		if (!res.ok) return setError(res.error || t('actionFailed'));
		if (!editing) {
			orbitBus.emit('budget:record_created', {
				recordId: String((res.data as Record<string, unknown>)?.id || ''),
				amount: minor ?? 0,
				type: typeValue as 'gelir' | 'gider',
				teamId: teamId || undefined,
			});
		}
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
							aria-checked={typeValue === typeOpt}
							className={`${ui.segment} ${typeValue === typeOpt ? ui.segmentActive : ''}`}
							onClick={() => setType(typeOpt)}
						>
							{typeOpt === 'gider' ? t('kasaExpenseOption') : t('kasaIncomeOption')}
						</button>
					))}
				</div>
			) : (
				<div className={k.balanceHint}>
					<span className={`${k.tag} ${registration.typeValue === 'gelir' ? k.tagIn : k.tagOut}`}>
						{registration.typeValue === 'gelir' ? t('kasaTagIncome') : t('kasaTagExpense')}
					</span>{' '}
					<strong>{formatMinor(registration.amountMinor)} ₺</strong> — {t('kasaTypeAmountLockedNotice')}
				</div>
			)}

			<div className={k.grid3}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('budgetColCategory')}</span>
					{transfer ? (
						<input className={ui.input} value={registration.category} disabled />
					) : (
						<select
							className={ui.select}
							style={{ maxWidth: 'none', width: '100%' }}
							value={category}
							onChange={(e) => setCategory(e.target.value)}
						>
							{BUDGET_CATEGORIES.map((c) => (
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
						<input className={ui.input} value={formatMinor(registration.amountMinor)} disabled />
					) : (
						<input
							className={ui.input}
							inputMode="decimal"
							placeholder="1.250,00"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
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
						onChange={(e) => setDate(e.target.value)}
						required
					/>
				</label>
			</div>
			{!editing && (
				<div className={k.balanceHint}>
					{t('kasaCurrentBalance')} <strong>{formatMinor(netBalanceMinor)} ₺</strong>
					{minor !== null && (
						<>
							{' '}
							{t('kasaAfterEntry')}{' '}
							<strong className={overdraft ? k.neg : undefined}>
								{formatMinor(netBalanceMinor + (typeValue === 'gelir' ? minor : -minor))} ₺
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
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					required
				/>
			</label>

			{!transfer && (
				<ReceiptUploadField
					receiptPhotoUrl={receiptPhotoUrl}
					uploading={uploading}
					onUpload={upload}
					onRemove={() => setReceiptPhotoUrl(null)}
				/>
			)}

			{error && <div className={ui.error}>{error}</div>}
		</Sheet>
	);
}
