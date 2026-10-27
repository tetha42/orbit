'use client';

import React, { useState } from 'react';
import { PenLine, Loader2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { KulupBilgileri } from '@/db';
import ui from '@/core/ui/ui.module.css';
import { sendJson } from '@/core/data/http';
import { Sheet } from '@/core/ui/Sheet';
import { useToast } from '@/core/ui/Toast';

/** The board's editor for what certificates print: university, club, signatories. */
export function SignatoriesModal({
	initial,
	onClose,
	onSaved,
}: {
	initial: KulupBilgileri;
	onClose: () => void;
	onSaved: () => void;
}) {
	const { t } = useI18n();
	const notify = useToast();
	const [universite, setUniversite] = useState(initial.universite);
	const [kulupAdi, setKulupAdi] = useState(initial.kulupAdi);
	const [imzalar, setImzalar] = useState(initial.imzalar.map((i) => ({ ...i })));
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);

	const set = (i: number, key: 'ad' | 'unvan', v: string) =>
		setImzalar((list) => list.map((row, j) => (j === i ? { ...row, [key]: v } : row)));

	return (
		<Sheet
			title={t('crtSettingsTitle')}
			icon={<PenLine size={18} color="#d4af37" />}
			onClose={onClose}
			onSubmit={async (e) => {
				e.preventDefault();
				setBusy(true);
				setError('');
				const res = await sendJson('/api/community', 'PATCH', { universite, kulupAdi, imzalar });
				setBusy(false);
				if (!res.ok) {
					setError(res.error || t('kbActionFailed'));
					notify(res.error || t('kbActionFailed'), 'error');
				} else {
					notify(t('crtSaved'), 'success');
					onSaved();
				}
			}}
			closeLabel={t('kbClose')}
			bodyStyle={{}}
		>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('crtUniversity')}</span>
				<input
					className={ui.input}
					required
					maxLength={80}
					value={universite}
					onChange={(e) => setUniversite(e.target.value)}
				/>
			</label>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('crtClubName')}</span>
				<input
					className={ui.input}
					required
					maxLength={80}
					value={kulupAdi}
					onChange={(e) => setKulupAdi(e.target.value)}
				/>
			</label>
			{imzalar.map((row, i) => (
				<div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{`${t('crtSignatory')} ${i + 1}`}</span>
						<input
							className={ui.input}
							maxLength={80}
							value={row.ad}
							placeholder={t('crtSignatoryPh')}
							onChange={(e) => set(i, 'ad', e.target.value)}
						/>
					</label>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('crtTitle')}</span>
						<input
							className={ui.input}
							required
							maxLength={80}
							value={row.unvan}
							onChange={(e) => set(i, 'unvan', e.target.value)}
						/>
					</label>
				</div>
			))}
			<div className={ui.hint}>{t('crtSignatoryHint')}</div>
			{error && <div className={ui.error}>{error}</div>}
			<div className={ui.btnRow}>
				<button type="button" className={ui.btn} onClick={onClose}>
					{t('kbCancel')}
				</button>
				<button type="submit" className={ui.primaryBtn} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
					{busy ? <Loader2 size={14} className="animate-spin" /> : null}
					{busy ? t('saving') : t('kbSave')}
				</button>
			</div>
		</Sheet>
	);
}
