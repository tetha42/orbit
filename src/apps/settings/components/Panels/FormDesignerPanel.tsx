'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Eye,
	ListChecks,
	Plus,
	Save,
	Trash2,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { errorMessage } from '@/lib/errors';
import {
	FORM_FIELD_COLLECT_AT,
	FORM_FIELD_DIRECTORY_VISIBILITY,
	FORM_FIELD_REQUIRED_AT,
	FORM_FIELD_TYPES,
	normalizeFieldKey,
	type FormField,
	type FormFieldCollectAt,
	type FormFieldDirectoryVisibility,
	type FormFieldOption,
	type FormFieldRequiredAt,
	type FormFieldType,
} from '@/lib/formFields';
import { RegistrationCoreFieldsPanel } from './RegistrationCoreFieldsPanel';
import { FormPreview } from './FormPreview';

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 11px',
	borderRadius: '8px',
	border: '1px solid var(--window-border)',
	background: 'rgba(0, 0, 0, 0.22)',
	color: 'inherit',
	fontSize: '12.5px',
	outline: 'none',
	boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
	display: 'block',
	fontSize: '11.5px',
	fontWeight: 600,
	opacity: 0.82,
	marginBottom: '5px',
};

const cardStyle: React.CSSProperties = {
	padding: '14px',
	borderRadius: '10px',
	border: '1px solid var(--window-border)',
	background: 'var(--card-bg, rgba(255,255,255,0.03))',
};

export function FormDesignerPanel() {
	const { t, language } = useI18n();
	const dialog = useDialog();
	const [fields, setFields] = useState<FormField[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [draft, setDraft] = useState<FormField | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

	const load = React.useCallback(async () => {
		try {
			const res = await fetch('/api/settings/form-fields', { cache: 'no-store' });
			const data = await res.json();
			if (res.ok && data.ok) setFields(data.fields ?? []);
		} catch {
			// The empty state is a valid fallback.
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const fieldLabel = (field: FormField) =>
		language === 'tr' ? field.labelTr || field.labelEn : field.labelEn || field.labelTr;

	const collectLabel = (value: FormFieldCollectAt) => t(`formCollectAt_${value}`);
	const requiredLabel = (value: FormFieldRequiredAt) => t(`formRequiredAt_${value}`);
	const directoryLabel = (value: FormFieldDirectoryVisibility) => t(`formDirectory_${value}`);

	const selectField = (field: FormField) => {
		setActiveId(field.id);
		setDraft({ ...field, options: field.options.map((option) => ({ ...option })) });
		setStatus(null);
	};

	const startNew = () => {
		setActiveId(null);
		setDraft({
			id: '',
			scope: 'registration',
			collectAt: 'registration',
			requiredAt: 'none',
			directoryVisibility: 'hidden',
			selfEditable: false,
			adminEditable: true,
			fieldKey: '',
			type: 'text',
			section: 'custom',
			labelTr: '',
			labelEn: '',
			placeholderTr: '',
			placeholderEn: '',
			options: [],
			required: false,
			enabled: true,
			sortOrder: fields.length,
			archivedAt: null,
		});
		setStatus(null);
	};

	const updateOption = (index: number, patch: Partial<FormFieldOption>) => {
		if (!draft) return;
		setDraft({
			...draft,
			options: draft.options.map((option, optionIndex) =>
				optionIndex === index ? { ...option, ...patch } : option
			),
		});
	};

	const addOption = () => {
		if (!draft) return;
		const index = draft.options.length + 1;
		setDraft({
			...draft,
			options: [
				...draft.options,
				{ value: `option_${index}`, labelTr: `Seçenek ${index}`, labelEn: `Option ${index}` },
			],
		});
	};

	const removeOption = (index: number) => {
		if (!draft) return;
		setDraft({ ...draft, options: draft.options.filter((_, optionIndex) => optionIndex !== index) });
	};

	const save = async () => {
		if (!draft) return;
		setIsSaving(true);
		setStatus(null);
		try {
			const payload = {
				...draft,
				fieldKey: draft.fieldKey || normalizeFieldKey(draft.labelEn, 'field'),
			};
			const res = await fetch('/api/settings/form-fields', {
				method: draft.id ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('formSaveFailed'));
			const saved = data.field as FormField;
			setFields((previous) => {
				const exists = previous.some((field) => field.id === saved.id);
				const next = exists
					? previous.map((field) => (field.id === saved.id ? saved : field))
					: [...previous, saved];
				return next.sort((a, b) => a.sortOrder - b.sortOrder);
			});
			setActiveId(saved.id);
			setDraft({ ...saved, options: saved.options.map((option) => ({ ...option })) });
			setStatus({ text: t('formSaved'), type: 'ok' });
		} catch (error) {
			setStatus({ text: errorMessage(error) || t('formSaveFailed'), type: 'err' });
		} finally {
			setIsSaving(false);
		}
	};

	const removeField = async () => {
		if (!draft?.id) return;
		const confirmed = await dialog.confirm({
			title: t('formDeleteTitle'),
			message: t('formDeleteConfirm'),
			tone: 'danger',
		});
		if (!confirmed) return;
		setIsSaving(true);
		try {
			const res = await fetch(
				`/api/settings/form-fields?id=${encodeURIComponent(draft.id)}`,
				{ method: 'DELETE' }
			);
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('formDeleteFailed'));
			setFields(data.fields ?? []);
			setActiveId(null);
			setDraft(null);
			setStatus({ text: t('formDeleted'), type: 'ok' });
		} catch (error) {
			setStatus({ text: errorMessage(error) || t('formDeleteFailed'), type: 'err' });
		} finally {
			setIsSaving(false);
		}
	};

	const moveField = async (fieldId: string, direction: -1 | 1) => {
		const index = fields.findIndex((field) => field.id === fieldId);
		const target = index + direction;
		if (index < 0 || target < 0 || target >= fields.length) return;
		const next = [...fields];
		const [removed] = next.splice(index, 1);
		next.splice(target, 0, removed);
		setFields(next);
		try {
			await fetch('/api/settings/form-fields', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ order: next.map((field) => field.id) }),
			});
		} catch {
			void load();
		}
	};

	const typeLabel = (type: FormFieldType) => t(`formType_${type}`);
	const canSave = useMemo(
		() =>
			Boolean(draft) &&
			draft!.labelTr.trim().length > 0 &&
			draft!.labelEn.trim().length > 0 &&
			(draft!.type !== 'select' || draft!.options.length > 0),
		[draft]
	);

	const previewFields = useMemo(() => {
		const base = draft
			? [
					...fields.filter((field) => field.id !== draft.id),
					{ ...draft, id: draft.id || 'draft' },
				]
			: fields;
		return base.filter((field) => field.enabled);
	}, [fields, draft]);

	if (isLoading) {
		return <div style={{ padding: 30, textAlign: 'center', opacity: 0.55 }}>{t('loading')}</div>;
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
				<div>
					<h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{t('formTitle')}</h2>
					<p style={{ margin: '3px 0 0 0', fontSize: '12.5px', opacity: 0.65 }}>{t('formDesc')}</p>
				</div>
				<button
					type="button"
					onClick={startNew}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						padding: '7px 12px',
						borderRadius: '8px',
						border: '1px solid var(--accent)',
						background: 'var(--accent)',
						color: '#fff',
						fontSize: '12px',
						fontWeight: 600,
						cursor: 'pointer',
					}}
				>
					<Plus size={13} />
					{t('formAdd')}
				</button>
			</div>

			<div style={{ ...cardStyle, padding: '16px' }}>
				<RegistrationCoreFieldsPanel />
			</div>

			<div style={{ ...cardStyle, padding: '16px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: 700 }}>
					<Eye size={14} style={{ opacity: 0.7 }} />
					{t('formPreview')}
				</div>
				<div style={{ fontSize: '11px', opacity: 0.55, margin: '3px 0 10px' }}>{t('formPreviewHint')}</div>
				<FormPreview fields={previewFields} />
			</div>

			<div style={{ height: '1px', background: 'var(--window-border)' }} />

			{status && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						padding: '10px 12px',
						borderRadius: '8px',
						fontSize: '12px',
						background: status.type === 'ok' ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
						color: status.type === 'ok' ? '#30d158' : '#ff453a',
						border: `1px solid ${status.type === 'ok' ? 'rgba(48,209,88,0.3)' : 'rgba(255,69,58,0.3)'}`,
					}}
				>
					{status.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
					{status.text}
				</div>
			)}

			<div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: '16px', alignItems: 'start' }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
					{fields.map((field, index) => {
						const active = field.id === activeId;
						return (
							<div
								key={field.id}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '4px',
									border: active ? '1px solid var(--accent)' : '1px solid transparent',
									borderRadius: '8px',
									background: active ? 'var(--accent-subtle, rgba(99,102,241,0.16))' : 'transparent',
								}}
							>
								<button
									type="button"
									onClick={() => selectField(field)}
									style={{
										flex: 1,
										minWidth: 0,
										display: 'flex',
										alignItems: 'center',
										gap: '7px',
										padding: '8px 6px 8px 9px',
										border: 'none',
										background: 'transparent',
										color: 'inherit',
										fontSize: '12px',
										fontWeight: active ? 600 : 500,
										textAlign: 'left',
										cursor: 'pointer',
									}}
								>
									<ListChecks size={13} style={{ opacity: 0.7, flexShrink: 0 }} />
									<span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										{fieldLabel(field)}
									</span>
								</button>
								<div style={{ display: 'flex', flexDirection: 'column' }}>
									<button
										type="button"
										onClick={() => void moveField(field.id, -1)}
										disabled={index === 0}
										title={t('formMoveUp')}
										style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.25 : 0.7, padding: '0 2px' }}
									>
										<ChevronUp size={11} />
									</button>
									<button
										type="button"
										onClick={() => void moveField(field.id, 1)}
										disabled={index === fields.length - 1}
										title={t('formMoveDown')}
										style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: index === fields.length - 1 ? 'default' : 'pointer', opacity: index === fields.length - 1 ? 0.25 : 0.7, padding: '0 2px' }}
									>
										<ChevronDown size={11} />
									</button>
								</div>
							</div>
						);
					})}
					{fields.length === 0 && (
						<div style={{ fontSize: '11.5px', opacity: 0.6, padding: '4px 2px' }}>{t('formEmpty')}</div>
					)}
				</div>

				{draft ? (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
						<div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
							<div>
								<label style={labelStyle}>{t('formLabelTr')}</label>
								<input
									style={inputStyle}
									value={draft.labelTr}
									maxLength={120}
									onChange={(event) => setDraft({ ...draft, labelTr: event.target.value })}
								/>
							</div>
							<div>
								<label style={labelStyle}>{t('formLabelEn')}</label>
								<input
									style={inputStyle}
									value={draft.labelEn}
									maxLength={120}
									onChange={(event) =>
										setDraft({
											...draft,
											labelEn: event.target.value,
											fieldKey:
												draft.fieldKey ||
												normalizeFieldKey(event.target.value, 'field'),
										})
									}
								/>
							</div>
							<div>
								<label style={labelStyle}>{t('formKey')}</label>
								<input
									style={inputStyle}
									value={draft.fieldKey}
									maxLength={48}
									onChange={(event) =>
										setDraft({ ...draft, fieldKey: normalizeFieldKey(event.target.value, '') })
									}
									placeholder="e.g. shirt_size"
								/>
							</div>
							<div>
								<label style={labelStyle}>{t('formSection')}</label>
								<input
									style={inputStyle}
									value={draft.section}
									maxLength={40}
									onChange={(event) => setDraft({ ...draft, section: event.target.value })}
									placeholder="custom"
								/>
							</div>
							<div>
								<label style={labelStyle}>{t('formType')}</label>
								<select
									style={inputStyle}
									value={draft.type}
									onChange={(event) =>
										setDraft({ ...draft, type: event.target.value as FormFieldType })
									}
								>
									{FORM_FIELD_TYPES.map((type) => (
										<option key={type} value={type}>
											{typeLabel(type)}
										</option>
									))}
								</select>
							</div>
							<div>
								<label style={labelStyle}>{t('formCollectAt')}</label>
								<select
									style={inputStyle}
									value={draft.collectAt}
									onChange={(event) => {
										const collectAt = event.target.value as FormFieldCollectAt;
										setDraft({
											...draft,
											collectAt,
											scope: collectAt === 'admin' ? 'member' : collectAt,
										});
									}}
								>
									{FORM_FIELD_COLLECT_AT.map((value) => (
										<option key={value} value={value}>
											{collectLabel(value)}
										</option>
									))}
								</select>
							</div>
							<div>
								<label style={labelStyle}>{t('formRequiredAt')}</label>
								<select
									style={inputStyle}
									value={draft.requiredAt}
									onChange={(event) => {
										const requiredAt = event.target.value as FormFieldRequiredAt;
										setDraft({ ...draft, requiredAt, required: requiredAt !== 'none' });
									}}
								>
									{FORM_FIELD_REQUIRED_AT.map((value) => (
										<option key={value} value={value}>
											{requiredLabel(value)}
										</option>
									))}
								</select>
							</div>
							<div>
								<label style={labelStyle}>{t('formDirectoryVisibility')}</label>
								<select
									style={inputStyle}
									value={draft.directoryVisibility}
									onChange={(event) =>
										setDraft({
											...draft,
											directoryVisibility: event.target.value as FormFieldDirectoryVisibility,
										})
									}
								>
									{FORM_FIELD_DIRECTORY_VISIBILITY.map((value) => (
										<option key={value} value={value}>
											{directoryLabel(value)}
										</option>
									))}
								</select>
							</div>
							<div>
								<label style={labelStyle}>{t('formPlaceholderTr')}</label>
								<input
									style={inputStyle}
									value={draft.placeholderTr}
									maxLength={160}
									onChange={(event) => setDraft({ ...draft, placeholderTr: event.target.value })}
								/>
							</div>
							<div>
								<label style={labelStyle}>{t('formPlaceholderEn')}</label>
								<input
									style={inputStyle}
									value={draft.placeholderEn}
									maxLength={160}
									onChange={(event) => setDraft({ ...draft, placeholderEn: event.target.value })}
								/>
							</div>
							<label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px' }}>
								<input
									type="checkbox"
									checked={draft.selfEditable}
									onChange={(event) => setDraft({ ...draft, selfEditable: event.target.checked })}
								/>
								{t('formSelfEditable')}
							</label>
							<label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px' }}>
								<input
									type="checkbox"
									checked={draft.adminEditable}
									onChange={(event) => setDraft({ ...draft, adminEditable: event.target.checked })}
								/>
								{t('formAdminEditable')}
							</label>
							<label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px' }}>
								<input
									type="checkbox"
									checked={draft.enabled}
									onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
								/>
								{t('formEnabled')}
							</label>
						</div>

						{draft.type === 'select' && (
							<div style={cardStyle}>
								<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
									<label style={{ ...labelStyle, marginBottom: 0 }}>{t('formOptions')}</label>
									<button
										type="button"
										onClick={addOption}
										style={{
											display: 'inline-flex',
											alignItems: 'center',
											gap: '5px',
											padding: '5px 9px',
											borderRadius: '7px',
											border: '1px solid var(--window-border)',
											background: 'var(--fill-soft)',
											color: 'inherit',
											fontSize: '11px',
											fontWeight: 600,
											cursor: 'pointer',
										}}
									>
										<Plus size={11} />
										{t('formAddOption')}
									</button>
								</div>
								<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
									{draft.options.map((option, index) => (
										<div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '6px', alignItems: 'center' }}>
											<input
												style={inputStyle}
												value={option.value}
												placeholder={t('formOptionValue')}
												onChange={(event) => updateOption(index, { value: event.target.value })}
											/>
											<input
												style={inputStyle}
												value={option.labelTr}
												placeholder={t('formOptionTr')}
												onChange={(event) => updateOption(index, { labelTr: event.target.value })}
											/>
											<input
												style={inputStyle}
												value={option.labelEn}
												placeholder={t('formOptionEn')}
												onChange={(event) => updateOption(index, { labelEn: event.target.value })}
											/>
											<button
												type="button"
												onClick={() => removeOption(index)}
												title={t('delete')}
												style={{
													width: '27px',
													height: '27px',
													borderRadius: '6px',
													border: '1px solid rgba(239,68,68,0.3)',
													background: 'rgba(239,68,68,0.08)',
													color: '#f87171',
													display: 'grid',
													placeItems: 'center',
													cursor: 'pointer',
												}}
											>
												<Trash2 size={12} />
											</button>
										</div>
									))}
									{draft.options.length === 0 && (
										<div style={{ fontSize: '11.5px', opacity: 0.55 }}>{t('formNoOptions')}</div>
									)}
								</div>
							</div>
						)}

						<div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
							<div>
								{draft.id && (
									<button
										type="button"
										onClick={() => void removeField()}
										disabled={isSaving}
										style={{
											display: 'inline-flex',
											alignItems: 'center',
											gap: '5px',
											padding: '8px 12px',
											borderRadius: '8px',
											border: '1px solid rgba(239,68,68,0.3)',
											background: 'rgba(239,68,68,0.08)',
											color: '#f87171',
											fontSize: '12px',
											fontWeight: 600,
											cursor: 'pointer',
										}}
									>
										<Trash2 size={13} />
										{t('delete')}
									</button>
								)}
							</div>
							<div style={{ display: 'flex', gap: '8px' }}>
								<button
									type="button"
									onClick={() => {
										setDraft(null);
										setActiveId(null);
										setStatus(null);
									}}
									disabled={isSaving}
									style={{
										padding: '8px 14px',
										borderRadius: '8px',
										border: '1px solid var(--window-border)',
										background: 'transparent',
										color: 'inherit',
										fontSize: '12px',
										fontWeight: 600,
										cursor: 'pointer',
									}}
								>
									{t('cancel')}
								</button>
								<button
									type="button"
									onClick={() => void save()}
									disabled={!canSave || isSaving}
									style={{
										display: 'inline-flex',
										alignItems: 'center',
										gap: '6px',
										padding: '8px 16px',
										borderRadius: '8px',
										border: 'none',
										background: 'var(--accent)',
										color: '#fff',
										fontSize: '12px',
										fontWeight: 600,
										cursor: canSave && !isSaving ? 'pointer' : 'not-allowed',
										opacity: canSave && !isSaving ? 1 : 0.55,
									}}
								>
									<Save size={13} />
									{isSaving ? t('saving') : t('formSave')}
								</button>
							</div>
						</div>
					</div>
				) : (
					<div style={{ ...cardStyle, fontSize: '12.5px', opacity: 0.6 }}>{t('formSelectPrompt')}</div>
				)}
			</div>
		</div>
	);
}
