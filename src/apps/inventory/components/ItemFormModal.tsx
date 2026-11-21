'use client';

import React, { useState } from 'react';
import { Cpu } from 'lucide-react';
import { codeProblem, normalizeCode } from '@/lib/inventory';
import ui from '@/core/ui/ui.module.css';
import { sendJson } from '@/core/data/http';
import s from './Inventory.module.css';
import { CATEGORY_SUGGESTION_KEYS, type InventoryItem } from '../types';
import { Sheet } from '@/core/ui/Sheet';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import inventoryContract from '../inventory.contract.json';

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
	const [code, setCode] = useState(item?.code ?? '');
	const [name, setName] = useState(item?.name ?? '');
	const [category, setCategory] = useState(item?.category ?? t('treasuryCatHardware'));
	const [location, setLocation] = useState(item?.location ?? '');
	const [serialNo, setSerialNo] = useState(item?.serialNo ?? '');
	const [description, setDescription] = useState(item?.description ?? '');
	const [status, setStatus] = useState<'available' | 'faulty'>('available');
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const normalizedCode = normalizeCode(code);
	const codeError = code
		? normalizedCode.length > inventoryContract.limits.maxCodeLength
			? `Max ${inventoryContract.limits.maxCodeLength}`
			: codeProblem(normalizedCode)
		: null;

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		if (codeError) return setError(codeError);
		if (name.trim().length > inventoryContract.limits.maxNameLength) {
			return setError(`Max ${inventoryContract.limits.maxNameLength}`);
		}
		setBusy(true);
		const fields = {
			code: normalizedCode,
			name: name.trim(),
			category: category.trim(),
			location: location.trim(),
			serialNo: serialNo.trim(),
			description: description.trim(),
		};
		const res = item
			? await sendJson('/api/inventory', 'POST', {
					action: 'update',
					inventoryId: item.id,
					...fields,
				})
			: await sendJson('/api/inventory', 'POST', { action: 'create', ...fields, status });
		setBusy(false);
		if (!res.ok) return setError(res.error || t('error'));
		onSaved(item ? t('invItemUpdated') : fill(t('invItemAdded'), { code: normalizedCode }));
	};

	return (
		<Sheet
			title={<>{item ? `${item.code} · ${t('edit')}` : t('invNewEquipment')}</>}
			label={item ? t('edit') : t('invNewEquipment')}
			icon={<Cpu size={18} color="var(--accent)" />}
			onClose={onClose}
			onSubmit={submit}
			maxWidth={620}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('cancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={busy || !!codeError}>
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
						value={code}
						maxLength={inventoryContract.limits.maxCodeLength}
						onChange={(e) => setCode(e.target.value)}
						placeholder="LAB-RPI-006"
						required
						autoFocus={!item}
						style={{ fontFamily: 'ui-monospace, monospace' }}
					/>
					{code && normalizedCode !== code && !codeError && (
						<span className={ui.hint}>{fill(t('invWillBeSaved'), { code: normalizedCode })}</span>
					)}
					{codeError && <span className={ui.error}>{codeError}</span>}
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('invSerialOptional')}</span>
					<input
						className={ui.input}
						value={serialNo}
						maxLength={80}
						onChange={(e) => setSerialNo(e.target.value)}
						placeholder={t('invSerialPh')}
					/>
				</label>
			</div>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('invNameLabel')}</span>
				<input
					className={ui.input}
					value={name}
					minLength={3}
					maxLength={inventoryContract.limits.maxNameLength}
					onChange={(e) => setName(e.target.value)}
					placeholder={t('invItemNamePh')}
					required
				/>
			</label>
			<div className={s.grid2}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('invColCategory')}</span>
					<input
						className={ui.input}
						list="inventory-categories"
						value={category}
						minLength={2}
						maxLength={60}
						onChange={(e) => setCategory(e.target.value)}
						required
					/>
					<datalist id="inventory-categories">
						{CATEGORY_SUGGESTION_KEYS.map((k) => (
							<option key={k} value={t(k)} />
						))}
					</datalist>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('invLocationLabel')}</span>
					<input
						className={ui.input}
						value={location}
						minLength={2}
						maxLength={120}
						onChange={(e) => setLocation(e.target.value)}
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
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder={t('invNotesPh')}
				/>
			</label>
			{!item && (
				<div className={ui.segmented} role="radiogroup" aria-label={t('invConditionLabel')}>
					{(['available', 'faulty'] as const).map((d) => (
						<button
							key={d}
							type="button"
							role="radio"
							aria-checked={status === d}
							className={`${ui.segment} ${status === d ? ui.segmentActive : ''}`}
							onClick={() => setStatus(d)}
						>
							{d === 'available' ? t('invBadgeAvailable') : t('invBadgeBroken')}
						</button>
					))}
				</div>
			)}
			{error && <div className={ui.error}>{error}</div>}
		</Sheet>
	);
}
