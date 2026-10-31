'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
	AlertCircle,
	AlignLeft,
	ArrowDown,
	ArrowUp,
	Calendar,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Copy,
	Eye,
	GripVertical,
	Hash,
	Layers,
	List,
	Lock,
	Mail,
	Phone,
	Plus,
	Save,
	Search,
	Settings2,
	Sliders,
	Trash2,
	Type,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useIsMobile } from '@/lib/client/useClientValue';
import { invalidateResource } from '@/core/data/useJsonResource';
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
	transition: 'border-color 0.15s ease',
};

const labelStyle: React.CSSProperties = {
	display: 'block',
	fontSize: '11.5px',
	fontWeight: 600,
	opacity: 0.85,
	marginBottom: '5px',
};

const cardStyle: React.CSSProperties = {
	padding: '14px',
	borderRadius: '10px',
	border: '1px solid var(--window-border)',
	background: 'var(--card-bg, rgba(255,255,255,0.03))',
};

const FIELD_TYPE_ICONS: Record<FormFieldType, React.ReactNode> = {
	text: <Type size={14} />,
	textarea: <AlignLeft size={14} />,
	select: <List size={14} />,
	number: <Hash size={14} />,
	email: <Mail size={14} />,
	tel: <Phone size={14} />,
	date: <Calendar size={14} />,
	password: <Lock size={14} />,
};

interface PresetOption {
	label: string;
	options: FormFieldOption[];
}

export function FormDesignerPanel() {
	const { t, language } = useI18n();
	const dialog = useDialog();
	const isMobile = useIsMobile(900);
	const [mobileTab, setMobileTab] = useState<'fields' | 'edit' | 'preview'>('fields');

	const [fields, setFields] = useState<FormField[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [draft, setDraft] = useState<FormField | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

	// Studio UX states
	const [searchQuery, setSearchQuery] = useState('');
	const [previewContext, setPreviewContext] = useState<'registration' | 'profile'>('registration');
	const [activeTab, setActiveTab] = useState<'basic' | 'rules' | 'options'>('basic');
	const [activeLangTab, setActiveLangTab] = useState<'tr' | 'en'>('tr');
	const [isCoreExpanded, setIsCoreExpanded] = useState(false);

	const PRESETS: Record<string, PresetOption> = useMemo(
		() => ({
			sizes: {
				label: t('formPresetSizes'),
				options: [
					{ value: 'xs', labelTr: 'XS', labelEn: 'XS' },
					{ value: 's', labelTr: 'S', labelEn: 'S' },
					{ value: 'm', labelTr: 'M', labelEn: 'M' },
					{ value: 'l', labelTr: 'L', labelEn: 'L' },
					{ value: 'xl', labelTr: 'XL', labelEn: 'XL' },
					{ value: 'xxl', labelTr: 'XXL', labelEn: 'XXL' },
				],
			},
			blood: {
				label: t('formPresetBlood'),
				options: [
					{ value: 'a_pos', labelTr: 'A Rh+', labelEn: 'A Rh+' },
					{ value: 'a_neg', labelTr: 'A Rh-', labelEn: 'A Rh-' },
					{ value: 'b_pos', labelTr: 'B Rh+', labelEn: 'B Rh+' },
					{ value: 'b_neg', labelTr: 'B Rh-', labelEn: 'B Rh-' },
					{ value: 'ab_pos', labelTr: 'AB Rh+', labelEn: 'AB Rh+' },
					{ value: 'ab_neg', labelTr: 'AB Rh-', labelEn: 'AB Rh-' },
					{ value: '0_pos', labelTr: '0 Rh+', labelEn: '0 Rh+' },
					{ value: '0_neg', labelTr: '0 Rh-', labelEn: '0 Rh-' },
				],
			},
			grades: {
				label: t('formPresetGrades'),
				options: [
					{ value: 'prep', labelTr: 'Hazırlık', labelEn: 'Prep' },
					{ value: 'grade_1', labelTr: '1. Sınıf', labelEn: '1st Grade' },
					{ value: 'grade_2', labelTr: '2. Sınıf', labelEn: '2nd Grade' },
					{ value: 'grade_3', labelTr: '3. Sınıf', labelEn: '3rd Grade' },
					{ value: 'grade_4', labelTr: '4. Sınıf', labelEn: '4th Grade' },
					{ value: 'graduate', labelTr: 'Yüksek Lisans / Doktora', labelEn: 'Graduate / PhD' },
				],
			},
			yesno: {
				label: t('formPresetYesNo'),
				options: [
					{ value: 'yes', labelTr: 'Evet', labelEn: 'Yes' },
					{ value: 'no', labelTr: 'Hayır', labelEn: 'No' },
				],
			},
		}),
		[t]
	);

	const load = React.useCallback(async () => {
		try {
			const res = await fetch('/api/settings/form-fields', { cache: 'no-store' });
			const data = await res.json();
			if (res.ok && data.ok) setFields(data.fields ?? []);
		} catch {
			// Fallback
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
	const typeLabel = (type: FormFieldType) => t(`formType_${type}`);

	const selectField = (field: FormField) => {
		setActiveId(field.id);
		setDraft({ ...field, options: field.options.map((option) => ({ ...option })) });
		setStatus(null);
		setActiveTab(field.type === 'select' && activeTab === 'options' ? 'options' : 'basic');
		if (isMobile) setMobileTab('edit');
	};

	const startNew = () => {
		setActiveId(null);
		setDraft({
			id: '',
			scope: 'registration',
			collectAt: 'registration',
			requiredAt: 'none',
			directoryVisibility: 'members',
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
		setActiveTab('basic');
		if (isMobile) setMobileTab('edit');
	};

	const duplicateField = (field: FormField) => {
		const newKey = `${field.fieldKey}_copy`;
		const newField: FormField = {
			...field,
			id: '',
			fieldKey: newKey,
			labelTr: `${field.labelTr} (Kopya)`,
			labelEn: `${field.labelEn} (Copy)`,
			options: field.options.map((opt) => ({ ...opt })),
			sortOrder: fields.length,
		};
		setActiveId(null);
		setDraft(newField);
		setStatus({ text: t('formDuplicate'), type: 'ok' });
		setActiveTab('basic');
		if (isMobile) setMobileTab('edit');
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

	const applyPreset = (presetKey: string) => {
		if (!draft || !PRESETS[presetKey]) return;
		setDraft({
			...draft,
			type: 'select',
			options: PRESETS[presetKey].options.map((opt) => ({ ...opt })),
		});
		setActiveTab('options');
	};

	const save = async () => {
		if (!draft) return;
		setIsSaving(true);
		setStatus(null);
		try {
			const payload = {
				...draft,
				fieldKey: draft.fieldKey || normalizeFieldKey(draft.labelEn || draft.labelTr, 'field'),
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
			invalidateResource('/api/form-fields');
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
			const res = await fetch(`/api/settings/form-fields?id=${encodeURIComponent(draft.id)}`, {
				method: 'DELETE',
			});
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('formDeleteFailed'));
			setFields(data.fields ?? []);
			setActiveId(null);
			setDraft(null);
			setStatus({ text: t('formDeleted'), type: 'ok' });
			invalidateResource('/api/form-fields');
			if (isMobile) setMobileTab('fields');
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
			invalidateResource('/api/form-fields');
		} catch {
			void load();
		}
	};

	const toggleFieldEnabled = async (field: FormField) => {
		const updated = { ...field, enabled: !field.enabled };
		setFields((prev) => prev.map((f) => (f.id === field.id ? updated : f)));
		if (draft?.id === field.id) {
			setDraft(updated);
		}
		try {
			await fetch('/api/settings/form-fields', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updated),
			});
			invalidateResource('/api/form-fields');
		} catch {
			void load();
		}
	};

	const canSave = useMemo(
		() =>
			Boolean(draft) &&
			(draft!.labelTr.trim().length > 0 || draft!.labelEn.trim().length > 0) &&
			(draft!.type !== 'select' || draft!.options.length > 0),
		[draft]
	);

	const filteredFields = useMemo(() => {
		if (!searchQuery.trim()) return fields;
		const q = searchQuery.toLowerCase();
		return fields.filter(
			(f) =>
				f.labelTr.toLowerCase().includes(q) ||
				f.labelEn.toLowerCase().includes(q) ||
				f.fieldKey.toLowerCase().includes(q)
		);
	}, [fields, searchQuery]);

	const previewFields = useMemo(() => {
		const base = draft
			? [...fields.filter((field) => field.id !== draft.id), { ...draft, id: draft.id || 'draft' }]
			: fields;
		return base;
	}, [fields, draft]);

	if (isLoading) {
		return <div style={{ padding: 40, textAlign: 'center', opacity: 0.55 }}>{t('loading')}</div>;
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			{/* Top Header */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: '12px',
					flexWrap: 'wrap',
				}}
			>
				<div>
					<h2
						style={{
							margin: 0,
							fontSize: '18px',
							fontWeight: 700,
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
						}}
					>
						<Layers size={18} style={{ color: 'var(--accent)' }} />
						{t('formTitle')}
					</h2>
					<p style={{ margin: '4px 0 0 0', fontSize: '12.5px', opacity: 0.65 }}>
						{t('formDesc')}
					</p>
				</div>
				<button
					type="button"
					onClick={startNew}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						padding: '8px 14px',
						borderRadius: '8px',
						border: '1px solid var(--accent)',
						background: 'var(--accent)',
						color: '#fff',
						fontSize: '12px',
						fontWeight: 600,
						cursor: 'pointer',
						boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
					}}
				>
					<Plus size={14} />
					{t('formAdd')}
				</button>
			</div>

			{/* Core Fields Collapsible Bar */}
			<div
				style={{
					borderRadius: '10px',
					border: '1px solid var(--window-border)',
					background: 'var(--card-bg, rgba(255,255,255,0.03))',
					overflow: 'hidden',
				}}
			>
				<button
					type="button"
					onClick={() => setIsCoreExpanded((prev) => !prev)}
					style={{
						width: '100%',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '11px 14px',
						border: 'none',
						background: 'transparent',
						color: 'inherit',
						cursor: 'pointer',
						fontSize: '12.5px',
						fontWeight: 600,
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<Settings2 size={15} style={{ opacity: 0.7 }} />
						<span>{t('formSectionCore')}</span>
						<span
							style={{
								fontSize: '10.5px',
								padding: '2px 7px',
								borderRadius: '10px',
								background: 'rgba(255,255,255,0.08)',
								opacity: 0.7,
							}}
						>
							Bölüm, Seviye, Üye ID
						</span>
					</div>
					{isCoreExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
				</button>
				{isCoreExpanded && (
					<div
						style={{
							padding: '14px',
							borderTop: '1px solid var(--window-border)',
							background: 'rgba(0,0,0,0.12)',
						}}
					>
						<RegistrationCoreFieldsPanel />
					</div>
				)}
			</div>

			{/* Status Feedback */}
			{status && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						padding: '10px 14px',
						borderRadius: '8px',
						fontSize: '12px',
						background: status.type === 'ok' ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
						color: status.type === 'ok' ? '#30d158' : '#ff453a',
						border: `1px solid ${status.type === 'ok' ? 'rgba(48,209,88,0.3)' : 'rgba(255,69,58,0.3)'}`,
					}}
				>
					{status.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
					<span>{status.text}</span>
				</div>
			)}

			{/* Mobile Segmented Switcher (< 900px) */}
			{isMobile && (
				<div
					style={{
						display: 'flex',
						background: 'var(--fill-soft, rgba(255,255,255,0.06))',
						borderRadius: '10px',
						padding: '4px',
						gap: '4px',
						marginBottom: '14px',
						border: '1px solid var(--window-border)',
					}}
				>
					<button
						type="button"
						onClick={() => setMobileTab('fields')}
						style={{
							flex: 1,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: '6px',
							padding: '8px 12px',
							borderRadius: '7px',
							border: 'none',
							fontSize: '12.5px',
							fontWeight: mobileTab === 'fields' ? 650 : 500,
							background: mobileTab === 'fields' ? 'var(--card-bg, #222)' : 'transparent',
							color: mobileTab === 'fields' ? 'var(--text-primary)' : 'var(--text-secondary)',
							boxShadow: mobileTab === 'fields' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
							cursor: 'pointer',
							minHeight: '38px',
						}}
					>
						<Layers size={14} />
						<span>{t('formTabFields', 'Alanlar')}</span>
					</button>
					<button
						type="button"
						onClick={() => setMobileTab('edit')}
						style={{
							flex: 1,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: '6px',
							padding: '8px 12px',
							borderRadius: '7px',
							border: 'none',
							fontSize: '12.5px',
							fontWeight: mobileTab === 'edit' ? 650 : 500,
							background: mobileTab === 'edit' ? 'var(--card-bg, #222)' : 'transparent',
							color: mobileTab === 'edit' ? 'var(--text-primary)' : 'var(--text-secondary)',
							boxShadow: mobileTab === 'edit' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
							cursor: 'pointer',
							minHeight: '38px',
						}}
					>
						<Sliders size={14} />
						<span>{t('formTabEdit', 'Düzenle')}</span>
					</button>
					<button
						type="button"
						onClick={() => setMobileTab('preview')}
						style={{
							flex: 1,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: '6px',
							padding: '8px 12px',
							borderRadius: '7px',
							border: 'none',
							fontSize: '12.5px',
							fontWeight: mobileTab === 'preview' ? 650 : 500,
							background: mobileTab === 'preview' ? 'var(--card-bg, #222)' : 'transparent',
							color: mobileTab === 'preview' ? 'var(--text-primary)' : 'var(--text-secondary)',
							boxShadow: mobileTab === 'preview' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
							cursor: 'pointer',
							minHeight: '38px',
						}}
					>
						<Eye size={14} />
						<span>{t('formTabPreview', 'Önizleme')}</span>
					</button>
				</div>
			)}

			{/* Main 3-Column Studio Layout (< 900px switches to 1-column responsive layout) */}
			<div
				style={
					isMobile
						? {
								display: 'flex',
								flexDirection: 'column',
								gap: '16px',
								width: '100%',
						  }
						: {
								display: 'grid',
								gridTemplateColumns: '270px minmax(0, 1fr) 330px',
								gap: '16px',
								alignItems: 'start',
						  }
				}
			>
				{/* 1. SÜTUN: ALANLAR LİSTESİ */}
				{(!isMobile || mobileTab === 'fields') && (
					<div
						style={{
							...cardStyle,
							padding: '12px',
							display: 'flex',
							flexDirection: 'column',
							gap: '10px',
						}}
					>
					{/* Search & Header */}
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							gap: '6px',
						}}
					>
						<div style={{ fontSize: '12px', fontWeight: 700 }}>
							{t('formSectionCustom')}
						</div>
						<span style={{ fontSize: '10.5px', opacity: 0.55 }}>
							{fields.filter((f) => f.enabled).length}/{fields.length} {t('formActiveCount')}
						</span>
					</div>

					<div style={{ position: 'relative' }}>
						<Search
							size={13}
							style={{
								position: 'absolute',
								left: '9px',
								top: '50%',
								transform: 'translateY(-50%)',
								opacity: 0.5,
							}}
						/>
						<input
							style={{ ...inputStyle, paddingLeft: '28px', fontSize: '11.5px', height: '32px' }}
							placeholder={t('formQuickSearch')}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>

					{/* Field Cards */}
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: '5px',
							maxHeight: '520px',
							overflowY: 'auto',
						}}
					>
						{filteredFields.map((field, index) => {
							const active = field.id === activeId || (!field.id && activeId === null && draft);
							const isRequired = field.requiredAt !== 'none' || field.required;

							return (
								<div
									key={field.id || index}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '6px',
										padding: '6px 8px',
										borderRadius: '8px',
										border: active ? '1px solid var(--accent)' : '1px solid var(--window-border)',
										background: active
											? 'var(--accent-subtle, rgba(99,102,241,0.14))'
											: 'rgba(255,255,255,0.02)',
										transition: 'all 0.15s ease',
									}}
								>
									<GripVertical size={13} style={{ opacity: 0.35, cursor: 'grab', flexShrink: 0 }} />

									<button
										type="button"
										onClick={() => selectField(field)}
										style={{
											flex: 1,
											minWidth: 0,
											display: 'flex',
											flexDirection: 'column',
											gap: '2px',
											border: 'none',
											background: 'transparent',
											color: 'inherit',
											textAlign: 'left',
											cursor: 'pointer',
											padding: 0,
										}}
									>
										<div
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: '6px',
												fontSize: '12px',
												fontWeight: active ? 600 : 500,
											}}
										>
											<span style={{ opacity: 0.7, flexShrink: 0 }}>
												{FIELD_TYPE_ICONS[field.type] || <Type size={13} />}
											</span>
											<span
												style={{
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													whiteSpace: 'nowrap',
													flex: 1,
													opacity: field.enabled ? 1 : 0.45,
												}}
											>
												{fieldLabel(field)}
											</span>
										</div>

										<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
											<span
												style={{
													fontSize: '9.5px',
													padding: '1px 5px',
													borderRadius: '4px',
													background: isRequired ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
													color: isRequired ? '#f87171' : 'inherit',
													opacity: 0.8,
												}}
											>
												{isRequired ? t('formBadgeRequired') : t('formBadgeOptional')}
											</span>
											<span style={{ fontSize: '9.5px', opacity: 0.45, fontFamily: 'monospace' }}>
												{field.fieldKey}
											</span>
										</div>
									</button>

									{/* Toggle Switch */}
									<input
										type="checkbox"
										checked={field.enabled}
										onChange={() => void toggleFieldEnabled(field)}
										title={t('formEnabled')}
										style={{ cursor: 'pointer' }}
									/>

									{/* Move buttons */}
									<div style={{ display: 'flex', flexDirection: 'column' }}>
										<button
											type="button"
											onClick={() => void moveField(field.id, -1)}
											disabled={index === 0}
											style={{
												border: 'none',
												background: 'transparent',
												color: 'inherit',
												cursor: index === 0 ? 'default' : 'pointer',
												opacity: index === 0 ? 0.2 : 0.7,
												padding: '0 2px',
											}}
										>
											<ArrowUp size={11} />
										</button>
										<button
											type="button"
											onClick={() => void moveField(field.id, 1)}
											disabled={index === fields.length - 1}
											style={{
												border: 'none',
												background: 'transparent',
												color: 'inherit',
												cursor: index === fields.length - 1 ? 'default' : 'pointer',
												opacity: index === fields.length - 1 ? 0.2 : 0.7,
												padding: '0 2px',
											}}
										>
											<ArrowDown size={11} />
										</button>
									</div>
								</div>
							);
						})}

						{filteredFields.length === 0 && (
							<div
								style={{
									fontSize: '11.5px',
									opacity: 0.55,
									textAlign: 'center',
									padding: '24px 8px',
								}}
							>
								{t('formEmpty')}
							</div>
						)}
					</div>
				</div>
			)}

				{/* 2. SÜTUN: ALAN DÜZENLEME (INSPECTOR) */}
				{(!isMobile || mobileTab === 'edit') && (
					draft ? (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
						{/* Inspector Card */}
						<div style={cardStyle}>
							{/* Inspector Sub-Tabs */}
							<div
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									borderBottom: '1px solid var(--window-border)',
									paddingBottom: '10px',
									marginBottom: '14px',
								}}
							>
								<div style={{ display: 'flex', gap: '6px' }}>
									<button
										type="button"
										onClick={() => setActiveTab('basic')}
										style={{
											padding: '6px 12px',
											borderRadius: '6px',
											border: 'none',
											background: activeTab === 'basic' ? 'var(--accent)' : 'transparent',
											color: activeTab === 'basic' ? '#fff' : 'inherit',
											fontSize: '12px',
											fontWeight: 600,
											cursor: 'pointer',
										}}
									>
										{t('formTabBasic')}
									</button>
									<button
										type="button"
										onClick={() => setActiveTab('rules')}
										style={{
											padding: '6px 12px',
											borderRadius: '6px',
											border: 'none',
											background: activeTab === 'rules' ? 'var(--accent)' : 'transparent',
											color: activeTab === 'rules' ? '#fff' : 'inherit',
											fontSize: '12px',
											fontWeight: 600,
											cursor: 'pointer',
										}}
									>
										{t('formTabRules')}
									</button>
									{draft.type === 'select' && (
										<button
											type="button"
											onClick={() => setActiveTab('options')}
											style={{
												padding: '6px 12px',
												borderRadius: '6px',
												border: 'none',
												background: activeTab === 'options' ? 'var(--accent)' : 'transparent',
												color: activeTab === 'options' ? '#fff' : 'inherit',
												fontSize: '12px',
												fontWeight: 600,
												cursor: 'pointer',
												display: 'flex',
												alignItems: 'center',
												gap: '5px',
											}}
										>
											{t('formTabOptions')}
											<span
												style={{
													fontSize: '10px',
													padding: '1px 5px',
													borderRadius: '10px',
													background: 'rgba(255,255,255,0.2)',
												}}
											>
												{draft.options.length}
											</span>
										</button>
									)}
								</div>

								{/* Language Selector for Inputs */}
								{activeTab === 'basic' && (
									<div
										style={{
											display: 'flex',
											background: 'rgba(0,0,0,0.2)',
											padding: '2px',
											borderRadius: '6px',
											border: '1px solid var(--window-border)',
										}}
									>
										<button
											type="button"
											onClick={() => setActiveLangTab('tr')}
											style={{
												padding: '3px 8px',
												borderRadius: '4px',
												border: 'none',
												background: activeLangTab === 'tr' ? 'var(--accent)' : 'transparent',
												color: activeLangTab === 'tr' ? '#fff' : 'inherit',
												fontSize: '11px',
												cursor: 'pointer',
												fontWeight: 600,
											}}
										>
											TR
										</button>
										<button
											type="button"
											onClick={() => setActiveLangTab('en')}
											style={{
												padding: '3px 8px',
												borderRadius: '4px',
												border: 'none',
												background: activeLangTab === 'en' ? 'var(--accent)' : 'transparent',
												color: activeLangTab === 'en' ? '#fff' : 'inherit',
												fontSize: '11px',
												cursor: 'pointer',
												fontWeight: 600,
											}}
										>
											EN
										</button>
									</div>
								)}
							</div>

							{/* TAB 1: BASIC INFO */}
							{activeTab === 'basic' && (
								<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
									{/* Field Type Cards */}
									<div>
										<label style={labelStyle}>{t('formType')}</label>
										<div
											style={{
												display: 'grid',
												gridTemplateColumns: 'repeat(4, 1fr)',
												gap: '6px',
											}}
										>
											{FORM_FIELD_TYPES.map((type) => {
												const isSelected = draft.type === type;
												return (
													<button
														key={type}
														type="button"
														onClick={() => setDraft({ ...draft, type })}
														style={{
															display: 'flex',
															alignItems: 'center',
															gap: '6px',
															padding: '8px 10px',
															borderRadius: '8px',
															border: isSelected
																? '1px solid var(--accent)'
																: '1px solid var(--window-border)',
															background: isSelected
																? 'var(--accent-subtle, rgba(99,102,241,0.18))'
																: 'rgba(0,0,0,0.15)',
															color: 'inherit',
															fontSize: '11.5px',
															fontWeight: isSelected ? 600 : 500,
															cursor: 'pointer',
															textAlign: 'left',
														}}
													>
														<span style={{ color: isSelected ? 'var(--accent)' : 'inherit', opacity: 0.85 }}>
															{FIELD_TYPE_ICONS[type]}
														</span>
														<span>{typeLabel(type)}</span>
													</button>
												);
											})}
										</div>
									</div>

									{/* Label & Placeholder based on Language Tab */}
									<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
										<div>
											<label style={labelStyle}>
												{activeLangTab === 'tr' ? t('formLabelTr') : t('formLabelEn')}
											</label>
											<input
												style={inputStyle}
												value={activeLangTab === 'tr' ? draft.labelTr : draft.labelEn}
												maxLength={120}
												placeholder={activeLangTab === 'tr' ? 'örn. Tişört Bedeni' : 'e.g. T-Shirt Size'}
												onChange={(e) => {
													const val = e.target.value;
													if (activeLangTab === 'tr') {
														setDraft({
															...draft,
															labelTr: val,
															fieldKey: draft.fieldKey || normalizeFieldKey(val, 'field'),
														});
													} else {
														setDraft({
															...draft,
															labelEn: val,
															fieldKey: draft.fieldKey || normalizeFieldKey(val, 'field'),
														});
													}
												}}
											/>
										</div>

										<div>
											<label style={labelStyle}>{t('formKey')}</label>
											<input
												style={inputStyle}
												value={draft.fieldKey}
												maxLength={48}
												placeholder="e.g. shirt_size"
												onChange={(e) =>
													setDraft({ ...draft, fieldKey: normalizeFieldKey(e.target.value, '') })
												}
											/>
										</div>

										<div>
											<label style={labelStyle}>
												{activeLangTab === 'tr' ? t('formPlaceholderTr') : t('formPlaceholderEn')}
											</label>
											<input
												style={inputStyle}
												value={activeLangTab === 'tr' ? draft.placeholderTr : draft.placeholderEn}
												maxLength={160}
												placeholder={activeLangTab === 'tr' ? 'Seçiniz…' : 'Select an option…'}
												onChange={(e) => {
													if (activeLangTab === 'tr') {
														setDraft({ ...draft, placeholderTr: e.target.value });
													} else {
														setDraft({ ...draft, placeholderEn: e.target.value });
													}
												}}
											/>
										</div>

										<div>
											<label style={labelStyle}>{t('formSection')}</label>
											<input
												style={inputStyle}
												value={draft.section}
												maxLength={40}
												placeholder="custom"
												onChange={(e) => setDraft({ ...draft, section: e.target.value })}
											/>
										</div>
									</div>
								</div>
							)}

							{/* TAB 2: BEHAVIOR & RULES */}
							{activeTab === 'rules' && (
								<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
									<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
										<div>
											<label style={labelStyle}>{t('formCollectAt')}</label>
											<select
												style={inputStyle}
												value={draft.collectAt}
												onChange={(e) => {
													const collectAt = e.target.value as FormFieldCollectAt;
													setDraft({
														...draft,
														collectAt,
														scope: collectAt === 'admin' ? 'member' : collectAt,
													});
												}}
											>
												{FORM_FIELD_COLLECT_AT.map((v) => (
													<option key={v} value={v}>
														{collectLabel(v)}
													</option>
												))}
											</select>
										</div>

										<div>
											<label style={labelStyle}>{t('formRequiredAt')}</label>
											<select
												style={inputStyle}
												value={draft.requiredAt}
												onChange={(e) => {
													const requiredAt = e.target.value as FormFieldRequiredAt;
													setDraft({ ...draft, requiredAt, required: requiredAt !== 'none' });
												}}
											>
												{FORM_FIELD_REQUIRED_AT.map((v) => (
													<option key={v} value={v}>
														{requiredLabel(v)}
													</option>
												))}
											</select>
										</div>

										<div>
											<label style={labelStyle}>{t('formDirectoryVisibility')}</label>
											<select
												style={inputStyle}
												value={draft.directoryVisibility}
												onChange={(e) =>
													setDraft({
														...draft,
														directoryVisibility: e.target.value as FormFieldDirectoryVisibility,
													})
												}
											>
												{FORM_FIELD_DIRECTORY_VISIBILITY.map((v) => (
													<option key={v} value={v}>
														{directoryLabel(v)}
													</option>
												))}
											</select>
										</div>

										<div style={{ gridColumn: 'span 2' }}>
											<p style={{ margin: 0, fontSize: '11px', opacity: 0.65, lineHeight: 1.4 }}>
												{draft.directoryVisibility === 'hidden'
													? t('formDirectoryHint_hidden')
													: draft.directoryVisibility === 'managers'
													? t('formDirectoryHint_managers')
													: t('formDirectoryHint_members')}
											</p>
										</div>
									</div>

									{/* Toggles */}
									<div
										style={{
											display: 'flex',
											flexDirection: 'column',
											gap: '8px',
											padding: '12px',
											borderRadius: '8px',
											background: 'rgba(0,0,0,0.14)',
										}}
									>
										<label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
											<input
												type="checkbox"
												checked={draft.selfEditable}
												onChange={(e) => setDraft({ ...draft, selfEditable: e.target.checked })}
											/>
											<span>{t('formSelfEditable')}</span>
										</label>
										<label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
											<input
												type="checkbox"
												checked={draft.adminEditable}
												onChange={(e) => setDraft({ ...draft, adminEditable: e.target.checked })}
											/>
											<span>{t('formAdminEditable')}</span>
										</label>
										<label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
											<input
												type="checkbox"
												checked={draft.enabled}
												onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
											/>
											<span>{t('formEnabled')}</span>
										</label>
									</div>
								</div>
							)}

							{/* TAB 3: OPTIONS (For Select) */}
							{activeTab === 'options' && draft.type === 'select' && (
								<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
									{/* Presets Header */}
									<div
										style={{
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'space-between',
											flexWrap: 'wrap',
											gap: '8px',
										}}
									>
										<div style={{ fontSize: '11.5px', fontWeight: 600, opacity: 0.8 }}>
											{t('formPresetApply')}:
										</div>
										<div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
											{Object.entries(PRESETS).map(([key, preset]) => (
												<button
													key={key}
													type="button"
													onClick={() => applyPreset(key)}
													style={{
														fontSize: '10.5px',
														padding: '4px 8px',
														borderRadius: '6px',
														border: '1px solid var(--window-border)',
														background: 'rgba(255,255,255,0.06)',
														color: 'inherit',
														cursor: 'pointer',
													}}
												>
													{preset.label}
												</button>
											))}
										</div>
									</div>

									{/* Options List */}
									<div
										style={{
											display: 'flex',
											flexDirection: 'column',
											gap: '6px',
											maxHeight: '300px',
											overflowY: 'auto',
										}}
									>
										{draft.options.map((option, index) => (
											<div
												key={index}
												style={{
													display: 'grid',
													gridTemplateColumns: '1fr 1fr 1fr auto',
													gap: '6px',
													alignItems: 'center',
												}}
											>
												<input
													style={inputStyle}
													value={option.value}
													placeholder={t('formOptionValue')}
													onChange={(e) => updateOption(index, { value: e.target.value })}
												/>
												<input
													style={inputStyle}
													value={option.labelTr}
													placeholder={t('formOptionTr')}
													onChange={(e) => updateOption(index, { labelTr: e.target.value })}
												/>
												<input
													style={inputStyle}
													value={option.labelEn}
													placeholder={t('formOptionEn')}
													onChange={(e) => updateOption(index, { labelEn: e.target.value })}
												/>
												<button
													type="button"
													onClick={() => removeOption(index)}
													title={t('delete')}
													style={{
														width: '28px',
														height: '28px',
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
											<div style={{ fontSize: '11.5px', opacity: 0.55, textAlign: 'center', padding: '16px' }}>
												{t('formNoOptions')}
											</div>
										)}
									</div>

									<button
										type="button"
										onClick={addOption}
										style={{
											display: 'inline-flex',
											alignItems: 'center',
											justifyContent: 'center',
											gap: '6px',
											padding: '7px 12px',
											borderRadius: '7px',
											border: '1px dashed var(--window-border)',
											background: 'rgba(255,255,255,0.02)',
											color: 'inherit',
											fontSize: '11.5px',
											fontWeight: 600,
											cursor: 'pointer',
										}}
									>
										<Plus size={12} />
										{t('formAddOption')}
									</button>
								</div>
							)}
						</div>

						{/* Bottom Inspector Actions */}
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
							<div>
								{draft.id && (
									<button
										type="button"
										onClick={() => void removeField()}
										disabled={isSaving}
										style={{
											display: 'inline-flex',
											alignItems: 'center',
											gap: '6px',
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
								{draft.id && (
									<button
										type="button"
										onClick={() => duplicateField(draft)}
										style={{
											display: 'inline-flex',
											alignItems: 'center',
											gap: '6px',
											padding: '8px 12px',
											borderRadius: '8px',
											border: '1px solid var(--window-border)',
											background: 'rgba(255,255,255,0.06)',
											color: 'inherit',
											fontSize: '12px',
											cursor: 'pointer',
										}}
									>
										<Copy size={13} />
										{t('formDuplicate')}
									</button>
								)}

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
										border: '1px solid var(--accent)',
										background: 'var(--accent)',
										color: '#fff',
										fontSize: '12px',
										fontWeight: 600,
										cursor: !canSave || isSaving ? 'default' : 'pointer',
										opacity: !canSave || isSaving ? 0.5 : 1,
										boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
									}}
								>
									<Save size={13} />
									{t('formSave')}
								</button>
							</div>
						</div>
					</div>
				) : (
					<div
						style={{
							...cardStyle,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							padding: '60px 20px',
							textAlign: 'center',
							gap: '12px',
						}}
					>
						<Sliders size={32} style={{ opacity: 0.35 }} />
						<div style={{ fontSize: '13px', opacity: 0.65 }}>{t('formSelectPrompt')}</div>
						<button
							type="button"
							onClick={startNew}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '6px',
								padding: '7px 14px',
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
				))}

				{/* 3. SÜTUN: CANLI ÖNİZLEME (STICKY STUDIO) */}
				{(!isMobile || mobileTab === 'preview') && (
					<div
						style={{
							position: isMobile ? 'static' : 'sticky',
							top: '16px',
							display: 'flex',
							flexDirection: 'column',
							gap: '10px',
						}}
					>
					{/* Mode Switcher */}
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							padding: '6px 8px',
							borderRadius: '8px',
							background: 'var(--card-bg, rgba(255,255,255,0.03))',
							border: '1px solid var(--window-border)',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, opacity: 0.8 }}>
							<Eye size={13} />
							<span>{t('formPreview')}</span>
						</div>

						<div
							style={{
								display: 'flex',
								background: 'rgba(0,0,0,0.25)',
								borderRadius: '6px',
								padding: '2px',
							}}
						>
							<button
								type="button"
								onClick={() => setPreviewContext('registration')}
								style={{
									border: 'none',
									background: previewContext === 'registration' ? 'var(--accent)' : 'transparent',
									color: previewContext === 'registration' ? '#fff' : 'inherit',
									fontSize: '10.5px',
									fontWeight: 600,
									padding: '3px 8px',
									borderRadius: '4px',
									cursor: 'pointer',
								}}
							>
								{t('formPreviewModeReg')}
							</button>
							<button
								type="button"
								onClick={() => setPreviewContext('profile')}
								style={{
									border: 'none',
									background: previewContext === 'profile' ? 'var(--accent)' : 'transparent',
									color: previewContext === 'profile' ? '#fff' : 'inherit',
									fontSize: '10.5px',
									fontWeight: 600,
									padding: '3px 8px',
									borderRadius: '4px',
									cursor: 'pointer',
								}}
							>
								{t('formPreviewModeProfile')}
							</button>
						</div>
					</div>

					{/* Live Mock Phone/Browser Canvas */}
					<FormPreview
						fields={previewFields}
						previewMode={previewContext}
						activeDraftKey={draft?.fieldKey}
					/>
				</div>
				)}
			</div>
		</div>
	);
}
