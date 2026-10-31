'use client';

import React, { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { formatKurus, parseAmount, dateInputToMs } from '@/lib/budget';
import { toDateInput } from '@/lib/kanban';
import ui from '@/core/ui/ui.module.css';
import { sendJson } from '@/core/data/http';
import k from './Kasa.module.css';
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
	const [kaynak, setKaynak] = useState(vaultKey(initialSource));
	const [hedef, setHedef] = useState(vaultKey(firstOther));
	const [tutar, setTutar] = useState('');
	const [date, setTarih] = useState(() => toDateInput(now));
	const [aciklama, setAciklama] = useState('');
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);

	const byKey = new Map(vaults.map((x) => [vaultKey(x.teamId), x]));
	const source = byKey.get(kaynak);
	const target = byKey.get(hedef);
	const kurus = parseAmount(tutar);
	const tooMuch = kurus !== null && !!source && kurus > source.netBakiyeKurus;

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		if (kaynak === hedef) return setError(t('kasaTransferSameError'));
		if (kurus === null) return setError(t('kasaInvalidAmount'));
		const ms = dateInputToMs(date, Date.now());
		if (ms === null) return setError(t('kasaInvalidDate'));
		setBusy(true);
		const res = await sendJson('/api/budget', 'POST', {
			action: 'aktar',
			kaynak,
			hedef,
			tutarKurus: kurus,
			aciklama: aciklama.trim() || undefined,
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
						value={kaynak}
						onChange={(e) => setKaynak(e.target.value)}
					>
						{vaults.map((x) => (
							<option key={vaultKey(x.teamId)} value={vaultKey(x.teamId)}>
								{x.ad} ({formatKurus(x.netBakiyeKurus)} ₺)
							</option>
						))}
					</select>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('kasaTarget')}</span>
					<select
						className={ui.select}
						style={{ maxWidth: 'none', width: '100%' }}
						value={hedef}
						onChange={(e) => setHedef(e.target.value)}
					>
						{vaults.map((x) => (
							<option
								key={vaultKey(x.teamId)}
								value={vaultKey(x.teamId)}
								disabled={vaultKey(x.teamId) === kaynak}
							>
								{x.ad}
							</option>
						))}
					</select>
				</label>
			</div>
			{source && (
				<div className={k.balanceHint}>
					{source.ad}: {t('kasaCurrentBalance')} <strong>{formatKurus(source.netBakiyeKurus)} ₺</strong>
					{kurus !== null && (
						<>
							{' '}
							· {t('kasaAfterTransfer')}{' '}
							<strong className={tooMuch ? k.neg : undefined}>
								{formatKurus(source.netBakiyeKurus - kurus)} ₺
							</strong>
						</>
					)}
					{target && (
						<div style={{ marginTop: 4 }}>
							{target.ad}: {formatKurus(target.netBakiyeKurus)} ₺
							{kurus !== null && (
								<>
									{' '}
									→ <strong>{formatKurus(target.netBakiyeKurus + kurus)} ₺</strong>
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
						value={tutar}
						onChange={(e) => setTutar(e.target.value)}
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
						onChange={(e) => setTarih(e.target.value)}
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
					value={aciklama}
					onChange={(e) => setAciklama(e.target.value)}
				/>
			</label>
			{error && <div className={ui.error}>{error}</div>}
		</Sheet>
	);
}
