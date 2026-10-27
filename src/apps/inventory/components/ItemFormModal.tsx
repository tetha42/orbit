'use client';

import React, { useState } from 'react';
import { Cpu } from 'lucide-react';
import { kodHatasi, normalizeKod } from '@/lib/inventory';
import ui from '@/core/ui/ui.module.css';
import { sendJson } from '@/core/data/http';
import s from './Inventory.module.css';
import { KATEGORI_ONERILERI, type InventoryItem } from '../types';
import { Sheet } from '@/core/ui/Sheet';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';

/** Adds an item (management) or edits one's code, name, category, place, serial and notes. */
export function ItemFormModal({
	item,
	onClose,
	onSaved,
}: {
	item?: InventoryItem;
	onClose: () => void;
	onSaved: (message: string) => void;
}) {
	const { t } = useI18n();
	const [kod, setKod] = useState(item?.kod ?? '');
	const [ad, setAd] = useState(item?.ad ?? '');
	const [kategori, setKategori] = useState(item?.kategori ?? t('kasaCatHardware'));
	const [konum, setKonum] = useState(item?.konum ?? '');
	const [seriNo, setSeriNo] = useState(item?.seriNo ?? '');
	const [aciklama, setAciklama] = useState(item?.aciklama ?? '');
	const [status, setDurum] = useState<'saglam' | 'arizali'>('saglam');
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const kodNorm = normalizeKod(kod);
	const kodErr = kod ? kodHatasi(kodNorm) : null;

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		if (kodErr) return setError(kodErr);
		setBusy(true);
		const fields = {
			kod: kodNorm,
			ad: ad.trim(),
			kategori: kategori.trim(),
			konum: konum.trim(),
			seriNo: seriNo.trim(),
			aciklama: aciklama.trim(),
		};
		const res = item
			? await sendJson('/api/inventory', 'POST', {
					action: 'update',
					envanterId: item.id,
					...fields,
				})
			: await sendJson('/api/inventory', 'POST', { action: 'create', ...fields, status });
		setBusy(false);
		if (!res.ok) return setError(res.error || 'Kaydedilemedi.');
		onSaved(item ? t('invItemUpdated') : fill(t('invItemAdded'), { code: kodNorm }));
	};

	return (
		<Sheet
			title={<>{item ? `${item.kod} · ${t('edit')}` : t('invNewEquipment')}</>}
			label={item ? t('edit') : t('invNewEquipment')}
			icon={<Cpu size={18} color="#0a84ff" />}
			onClose={onClose}
			onSubmit={submit}
			maxWidth={620}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('cancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={busy || !!kodErr}>
						{busy ? t('saving') : item ? t('save') : t('invNewEquipment')}
					</button>
				</>
			}
		>
			<div className={s.grid2}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('invCodeLabel')}</span>
					<input
						className={ui.input}
						value={kod}
						onChange={(e) => setKod(e.target.value)}
						placeholder="LAB-RPI-006"
						required
						autoFocus={!item}
						style={{ fontFamily: 'ui-monospace, monospace' }}
					/>
					{kod && kodNorm !== kod && !kodErr && (
						<span className={ui.hint}>{fill(t('invWillBeSaved'), { code: kodNorm })}</span>
					)}
					{kodErr && <span className={ui.error}>{kodErr}</span>}
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('invSerialOptional')}</span>
					<input
						className={ui.input}
						value={seriNo}
						maxLength={80}
						onChange={(e) => setSeriNo(e.target.value)}
						placeholder={t('invSerialPh')}
					/>
				</label>
			</div>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('invNameLabel')}</span>
				<input
					className={ui.input}
					value={ad}
					minLength={3}
					maxLength={120}
					onChange={(e) => setAd(e.target.value)}
					placeholder={t('invItemNamePh')}
					required
				/>
			</label>
			<div className={s.grid2}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('invColCategory')}</span>
					<input
						className={ui.input}
						list="envanter-kategorileri"
						value={kategori}
						minLength={2}
						maxLength={60}
						onChange={(e) => setKategori(e.target.value)}
						required
					/>
					<datalist id="envanter-kategorileri">
						{KATEGORI_ONERILERI.map((k) => (
							<option key={k} value={k} />
						))}
					</datalist>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('invLocationLabel')}</span>
					<input
						className={ui.input}
						value={konum}
						minLength={2}
						maxLength={120}
						onChange={(e) => setKonum(e.target.value)}
						placeholder={t('invLocationPh')}
						required
					/>
				</label>
			</div>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('invNotesLabel')}</span>
				<textarea
					className={ui.textarea}
					rows={3}
					maxLength={1000}
					value={aciklama}
					onChange={(e) => setAciklama(e.target.value)}
					placeholder={t('invNotesPh')}
				/>
			</label>
			{!item && (
				<div className={ui.segmented} role="radiogroup" aria-label={t('invConditionLabel')}>
					{(['saglam', 'arizali'] as const).map((d) => (
						<button
							key={d}
							type="button"
							role="radio"
							aria-checked={status === d}
							className={`${ui.segment} ${status === d ? ui.segmentActive : ''}`}
							onClick={() => setDurum(d)}
						>
							{d === 'saglam' ? t('invBadgeAvailable') : t('invBadgeBroken')}
						</button>
					))}
				</div>
			)}
			{error && <div className={ui.error}>{error}</div>}
		</Sheet>
	);
}
