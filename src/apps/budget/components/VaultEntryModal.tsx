'use client';

import React, { useState } from 'react';
import { Receipt } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { BUDGET_CATEGORIES, MAX_AMOUNT_CENTS } from '@/types/budget';
import { formatMinor, parseAmount, dateInputToMs } from '@/lib/budget';
import { toDateInput } from '@/lib/kanban';
import ui from '@/core/ui/ui.module.css';
import k from './Vault.module.css';
import type { VaultRecord } from '../types';
import { Sheet } from '@/core/ui/Sheet';
import { ReceiptUploadField } from './ReceiptUploadField';
import { useNow } from '@/lib/client/useSheet';
import { fill } from '@/lib/text';
import contract from '../budget.contract.json';
import { categoryLabel } from '../categoryLabel';
import { uploadVaultReceiptImage, saveVaultEntry } from './vaultEntryApi';

interface VaultEntryModalProps {
	teamId: string | null;
	registration?: VaultRecord;
	netBalanceMinor: number;
	onClose: () => void;
	onSaved: (message: string) => void;
}

export function VaultEntryModal({ teamId, registration, netBalanceMinor, onClose, onSaved }: VaultEntryModalProps) {
	const { t } = useI18n();
	const editing = !!registration;
	const transfer = !!registration?.transferId;
	const now = useNow(60_000);
	const today = toDateInput(now);

	const [entryType, setEntryType] = useState<'income' | 'expense'>(registration?.type ?? 'expense');
	const [category, setCategory] = useState<string>(registration?.category ?? 'hardware');
	const [amount, setAmount] = useState('');
	const [date, setDate] = useState(() => toDateInput(registration?.date ?? now));
	const [description, setDescription] = useState(registration?.description ?? '');
	const [receiptUrl, setReceiptUrl] = useState<string | null>(registration?.receiptUrl ?? null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);

	const minor = editing ? registration.amountMinor : parseAmount(amount);
	const overdraft = !editing && entryType === 'expense' && minor !== null && minor > netBalanceMinor;

	const upload = async (file: File | undefined) => {
		if (!file) return;
		setUploading(true);
		setError('');
		try {
			const res = await uploadVaultReceiptImage(file);
			if (res.url) setReceiptUrl(res.url);
			else setError(res.error || t('treasuryUploadFailed'));
		} catch {
			setError(t('treasuryUploadFailed'));
		} finally {
			setUploading(false);
		}
	};

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		const ms = dateInputToMs(date, Date.now());
		if (ms === null) return setError(t('treasuryInvalidDate'));
		const trimmedDesc = description.trim();
		if (!trimmedDesc) return setError(t('treasuryDescRequired'));
		if (trimmedDesc.length > contract.limits.maxDescriptionLength)
			return setError(t('treasuryDescRequired'));
		const maxAmount = Math.min(MAX_AMOUNT_CENTS, contract.limits.maxAmountPerTransaction);
		if (!editing) {
			if (minor === null) return setError(t('treasuryInvalidAmount'));
			if (minor > maxAmount)
				return setError(fill(t('treasuryMaxAmountError'), { max: formatMinor(maxAmount) }));
		}
		setBusy(true);
		const res = await saveVaultEntry({
			editingId: registration?.id,
			transfer,
			teamId,
			type: entryType,
			category,
			amountMinor: minor,
			description: trimmedDesc,
			dateMs: ms,
			receiptUrl,
		});
		setBusy(false);
		if (!res.ok) return setError(res.error || t('actionFailed'));
		onSaved(editing ? t('treasuryRecordUpdated') : t('treasuryRecordAdded'));
	};

	return (
		<Sheet
			title={editing ? t('treasuryEditTitle') : t('treasuryNewTitle')}
			label={editing ? t('treasuryEditTitle') : t('treasuryNewTitle')}
			icon={<Receipt size={18} color="var(--accent)" />}
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
					{(['expense', 'income'] as const).map((typeOpt) => (
						<button
							key={typeOpt}
							type="button"
							role="radio"
							aria-checked={entryType === typeOpt}
							className={`${ui.segment} ${entryType === typeOpt ? ui.segmentActive : ''}`}
							onClick={() => setEntryType(typeOpt)}
						>
							{typeOpt === 'expense' ? t('treasuryExpenseOption') : t('treasuryIncomeOption')}
						</button>
					))}
				</div>
			) : (
				<div className={k.balanceHint}>
					<span className={`${k.tag} ${registration.type === 'income' ? k.tagIn : k.tagOut}`}>
						{registration.type === 'income' ? t('treasuryTagIncome') : t('treasuryTagExpense')}
					</span>{' '}
					<strong>{formatMinor(registration.amountMinor)} ₺</strong> — {t('treasuryTypeAmountLockedNotice')}
				</div>
			)}

			<div className={k.grid3}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('budgetColCategory')}</span>
					{transfer ? (
						<input className={ui.input} value={categoryLabel(t, registration.category)} disabled />
					) : (
						<select
							className={ui.select}
							style={{ maxWidth: 'none', width: '100%' }}
							value={category}
							onChange={(e) => setCategory(e.target.value)}
						>
							{BUDGET_CATEGORIES.map((c) => (
								<option key={c} value={c}>
									{categoryLabel(t, c)}
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
					<span className={ui.fieldLabel}>{t('treasuryDateLabel')}</span>
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
					{t('treasuryCurrentBalance')} <strong>{formatMinor(netBalanceMinor)} ₺</strong>
					{minor !== null && (
						<>
							{' '}
							{t('treasuryAfterEntry')}{' '}
							<strong className={overdraft ? k.neg : undefined}>
								{formatMinor(netBalanceMinor + (entryType === 'income' ? minor : -minor))} ₺
							</strong>
						</>
					)}
					{overdraft && <span className={k.neg}> {t('treasuryCannotOverdraft')}</span>}
				</div>
			)}

			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('budgetColTitle')}</span>
				<textarea
					className={ui.textarea}
					rows={3}
					maxLength={500}
					placeholder={t('treasuryDescPh')}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					required
				/>
			</label>

			{!transfer && (
				<ReceiptUploadField
					receiptUrl={receiptUrl}
					uploading={uploading}
					onUpload={upload}
					onRemove={() => setReceiptUrl(null)}
				/>
			)}

			{error && <div className={ui.error}>{error}</div>}
		</Sheet>
	);
}
