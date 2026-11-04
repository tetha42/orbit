'use client';

import React, { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { formatMinor, parseAmount, dateInputToMs } from '@/lib/budget';
import { toDateInput } from '@/lib/kanban';
import ui from '@/core/ui/ui.module.css';
import { sendJson } from '@/core/data/http';
import k from './Vault.module.css';
import { vaultKey, type VaultSummary } from '../types';
import { Sheet } from '@/core/ui/Sheet';
import { useI18n } from '@/core/i18n';
import { useNow } from '@/lib/client/useSheet';

interface TransferModalProps {
	vaults: VaultSummary[];
	initialSource: string | null;
	onClose: () => void;
	onSaved: (message: string) => void;
}

export function TransferModal({
	vaults,
	initialSource,
	onClose,
	onSaved,
}: TransferModalProps) {
	const { t } = useI18n();
	const now = useNow(60_000);
	const today = toDateInput(now);

	const firstOther = vaults.find((x) => x.teamId !== initialSource)?.teamId ?? null;
	const [sourceKey, setSourceKey] = useState(vaultKey(initialSource));
	const [targetKey, setTargetKey] = useState(vaultKey(firstOther));
	const [amount, setAmount] = useState('');
	const [date, setDate] = useState(() => toDateInput(now));
	const [description, setDescription] = useState('');
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);

	const byKey = new Map(vaults.map((x) => [vaultKey(x.teamId), x]));
	const source = byKey.get(sourceKey);
	const target = byKey.get(targetKey);
	const minor = parseAmount(amount);
	const tooMuch = minor !== null && !!source && minor > source.netBalanceMinor;

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		if (sourceKey === targetKey) return setError(t('kasaTransferSameError'));
		if (minor === null) return setError(t('kasaInvalidAmount'));
		const ms = dateInputToMs(date, now);
		if (ms === null) return setError(t('kasaInvalidDate'));
		setBusy(true);
		const res = await sendJson('/api/budget', 'POST', {
			action: 'transfer',
			source,
			target,
			amountMinor: minor,
			description: description.trim() || undefined,
			date: ms,
		});
		setBusy(false);
		if (!res.ok) return setError(res.error || t('kasaTransferFailed'));
		onSaved(t('kasaTransferSuccess'));
	};

	return (
		<Sheet
			title={t('kasaTransferTitle')}
			label={t('kasaTransferTitle')}
			icon={<ArrowRightLeft size={18} color="#5856d6" />}
			onClose={onClose}
			onSubmit={submit}
			maxWidth={540}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('cancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={busy || tooMuch}>
						{busy ? t('saving') : t('kasaTransferSubmit')}
					</button>
				</>
			}
		>
			<p className={ui.muted} style={{ margin: '0 0 16px 0', fontSize: 13, lineHeight: 1.45 }}>
				{t('kasaTransferBody')}
			</p>
			<div className={k.grid2}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('kasaSource')}</span>
					<select
						className={ui.select}
						style={{ maxWidth: 'none', width: '100%' }}
						value={sourceKey}
						onChange={(e) => setSourceKey(e.target.value)}
					>
						{vaults.map((x) => (
							<option key={vaultKey(x.teamId)} value={vaultKey(x.teamId)}>
								{x.name} ({formatMinor(x.netBalanceMinor)} ₺)
							</option>
						))}
					</select>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('kasaTarget')}</span>
					<select
						className={ui.select}
						style={{ maxWidth: 'none', width: '100%' }}
						value={targetKey}
						onChange={(e) => setTargetKey(e.target.value)}
					>
						{vaults.map((x) => (
							<option
								key={vaultKey(x.teamId)}
								value={vaultKey(x.teamId)}
								disabled={vaultKey(x.teamId) === sourceKey}
							>
								{x.name}
							</option>
						))}
					</select>
				</label>
			</div>
			{source && (
				<div className={k.balanceHint}>
					{source.name}: {t('kasaCurrentBalance')} <strong>{formatMinor(source.netBalanceMinor)} ₺</strong>
					{minor !== null && (
						<>
							{' '}
							· {t('kasaAfterTransfer')}{' '}
							<strong className={tooMuch ? k.neg : undefined}>
								{formatMinor(source.netBalanceMinor - minor)} ₺
							</strong>
						</>
					)}
					{target && (
						<div style={{ marginTop: 4 }}>
							{target.name}: {formatMinor(target.netBalanceMinor)} ₺
							{minor !== null && (
								<>
									{' '}
									→ <strong>{formatMinor(target.netBalanceMinor + minor)} ₺</strong>
								</>
							)}
						</div>
					)}
					{tooMuch && <span className={k.neg}> {t('kasaSourceCannotCover')}</span>}
				</div>
			)}
			<div className={k.grid2}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('budgetColAmount')}</span>
					<input
						className={ui.input}
						inputMode="decimal"
						placeholder="5.000,00"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
						required
						autoFocus
					/>
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
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('kasaTransferDescLabel')}</span>
				<input
					className={ui.input}
					maxLength={200}
					placeholder={t('kasaTransferDescPlaceholder')}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</label>
			{error && <div className={ui.error}>{error}</div>}
		</Sheet>
	);
}
