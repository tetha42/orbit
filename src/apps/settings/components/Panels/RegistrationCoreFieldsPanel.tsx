'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, Plus, Save, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { invalidateResource } from '@/core/data/useJsonResource';
import { errorMessage } from '@/lib/errors';
import type {
	RegistrationCoreConfig,
	RegistrationCoreField,
	RegistrationCoreFieldKey,
} from '@/lib/registrationConfig';
import { DEFAULT_REGISTRATION_CORE_CONFIG } from '@/lib/registrationConfig';
import type { FormFieldOption } from '@/lib/formFields';

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

const copy = (field: RegistrationCoreField): RegistrationCoreField => ({
	...field,
	options: field.options.map((option) => ({ ...option })),
});

const copyConfig = (config: RegistrationCoreConfig): RegistrationCoreConfig => ({
	track: copy(config.track),
	level: copy(config.level),
	memberId: { ...config.memberId },
});

export function RegistrationCoreFieldsPanel() {
	const { t } = useI18n();
	const [draft, setDraft] = useState<RegistrationCoreConfig>(
		DEFAULT_REGISTRATION_CORE_CONFIG
	);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch('/api/settings/registration-fields', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (cancelled || !data?.config) return;
				setDraft(copyConfig(data.config));
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const updateField = <K extends RegistrationCoreFieldKey>(
		key: K,
		patch: Partial<RegistrationCoreConfig[K]>
	) => {
		setDraft((previous) => ({
			...previous,
			[key]: { ...previous[key], ...patch },
		}));
	};

	const updateOption = (
		key: RegistrationCoreFieldKey,
		index: number,
		patch: Partial<FormFieldOption>
	) => {
		setDraft((previous) => ({
			...previous,
			[key]: {
				...previous[key],
				options: previous[key].options.map((option, optionIndex) =>
					optionIndex === index ? { ...option, ...patch } : option
				),
			},
		}));
	};

	const addOption = (key: RegistrationCoreFieldKey) => {
		setDraft((previous) => {
			const field = previous[key];
			const nextIndex = field.options.length + 1;
			const nextLevel = key === 'level'
				? Math.max(0, ...field.options.map((option) => Number(option.value) || 0)) + 1
				: nextIndex;
			const option: FormFieldOption =
				key === 'level'
					? {
							value: String(nextLevel),
							labelTr: `Seviye ${nextLevel}`,
							labelEn: `Level ${nextLevel}`,
						}
					: {
							value: `track_${nextIndex}`,
							labelTr: `Topluluk Alanı ${nextIndex}`,
							labelEn: `Community Track ${nextIndex}`,
						};
			return {
				...previous,
				[key]: { ...field, options: [...field.options, option] },
			};
		});
	};

	const removeOption = (key: RegistrationCoreFieldKey, index: number) => {
		setDraft((previous) => ({
			...previous,
			[key]: {
				...previous[key],
				options: previous[key].options.filter((_, optionIndex) => optionIndex !== index),
			},
		}));
	};

	const save = async () => {
		setIsSaving(true);
		setStatus(null);
		try {
			const res = await fetch('/api/settings/registration-fields', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(draft),
			});
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('regCoreSaveFailed'));
			setDraft(copyConfig(data.config));
			setStatus({ text: t('regCoreSaved'), type: 'ok' });
			invalidateResource('/api/registration-config');
		} catch (error) {
			setStatus({ text: errorMessage(error) || t('regCoreSaveFailed'), type: 'err' });
		} finally {
			setIsSaving(false);
		}
	};

	const renderField = (key: RegistrationCoreFieldKey) => {
		const field = draft[key];
		const title = key === 'track' ? t('regCoreTrack') : t('regCoreLevel');
		return (
			<div style={cardStyle} key={key}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: '10px',
						marginBottom: '10px',
					}}
				>
					<div>
						<div style={{ fontSize: '12.5px', fontWeight: 700 }}>{title}</div>
						<div style={{ fontSize: '11px', opacity: 0.55, marginTop: '2px' }}>
							{key === 'track' ? t('regCoreTrackHint') : t('regCoreLevelHint')}
						</div>
					</div>
					<button
						type="button"
						onClick={() => updateField(key, { visible: !field.visible })}
						aria-pressed={field.visible}
						title={field.visible ? t('regCoreHide') : t('regCoreShow')}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '5px',
							padding: '5px 9px',
							borderRadius: '7px',
							border: `1px solid ${field.visible ? 'rgba(48,209,88,0.35)' : 'var(--window-border)'}`,
							background: field.visible ? 'rgba(48,209,88,0.1)' : 'transparent',
							color: field.visible ? '#30d158' : 'inherit',
							fontSize: '11px',
							fontWeight: 600,
							cursor: 'pointer',
							whiteSpace: 'nowrap',
						}}
					>
						{field.visible ? <Eye size={12} /> : <EyeOff size={12} />}
						{field.visible ? t('regCoreVisible') : t('regCoreHidden')}
					</button>
				</div>

				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
					<div>
						<label style={labelStyle}>{t('formLabelTr')}</label>
						<input
							style={inputStyle}
							value={field.labelTr}
							onChange={(event) => updateField(key, { labelTr: event.target.value })}
						/>
					</div>
					<div>
						<label style={labelStyle}>{t('formLabelEn')}</label>
						<input
							style={inputStyle}
							value={field.labelEn}
							onChange={(event) => updateField(key, { labelEn: event.target.value })}
						/>
					</div>
					<div>
						<label style={labelStyle}>{t('formPlaceholderTr')}</label>
						<input
							style={inputStyle}
							value={field.placeholderTr}
							onChange={(event) => updateField(key, { placeholderTr: event.target.value })}
						/>
					</div>
					<div>
						<label style={labelStyle}>{t('formPlaceholderEn')}</label>
						<input
							style={inputStyle}
							value={field.placeholderEn}
							onChange={(event) => updateField(key, { placeholderEn: event.target.value })}
						/>
					</div>
				</div>

				<div style={{ marginTop: '10px' }}>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							marginBottom: '6px',
						}}
					>
						<label style={{ ...labelStyle, marginBottom: 0 }}>{t('regCoreOptions')}</label>
						<button
							type="button"
							onClick={() => addOption(key)}
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
							{t('regCoreAddOption')}
						</button>
					</div>
					<div
						style={{
							display: 'flex',
							alignItems: 'flex-start',
							gap: '5px',
							fontSize: '10.5px',
							lineHeight: 1.45,
							opacity: 0.55,
							marginBottom: '7px',
						}}
					>
						<Info size={12} style={{ marginTop: '1px', flexShrink: 0 }} />
						<span>
							{t('regCoreOptionsHint')}
							{key === 'level' ? ` ${t('regCoreLevelValueHint')}` : ''}
						</span>
					</div>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: '0.8fr 1fr 1fr auto',
							gap: '6px',
							padding: '0 2px',
							marginBottom: '4px',
							fontSize: '9.5px',
							fontWeight: 700,
							letterSpacing: '0.045em',
							textTransform: 'uppercase',
							opacity: 0.48,
						}}
						aria-hidden="true"
					>
						<span title={t('regCoreValue')}>{t('regCoreValue')}</span>
						<span title={t('regCoreOptionTr')}>{t('regCoreOptionTr')}</span>
						<span title={t('regCoreOptionEn')}>{t('regCoreOptionEn')}</span>
						<span />
					</div>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
						{field.options.map((option, index) => (
							<div
								key={index}
								style={{
									display: 'grid',
									gridTemplateColumns: '0.8fr 1fr 1fr auto',
									gap: '6px',
									alignItems: 'center',
								}}
							>
								<input
									style={inputStyle}
									value={option.value}
									aria-label={`${t('regCoreValue')} ${index + 1}`}
									inputMode={key === 'level' ? 'numeric' : undefined}
									onChange={(event) =>
										updateOption(key, index, { value: event.target.value })
									}
									placeholder={t('regCoreValue')}
								/>
								<input
									style={inputStyle}
									value={option.labelTr}
									aria-label={`${t('regCoreOptionTr')} ${index + 1}`}
									onChange={(event) =>
										updateOption(key, index, { labelTr: event.target.value })
									}
									placeholder={t('regCoreOptionTr')}
								/>
								<input
									style={inputStyle}
									value={option.labelEn}
									aria-label={`${t('regCoreOptionEn')} ${index + 1}`}
									onChange={(event) =>
										updateOption(key, index, { labelEn: event.target.value })
									}
									placeholder={t('regCoreOptionEn')}
								/>
								<button
									type="button"
									onClick={() => removeOption(key, index)}
									disabled={field.options.length <= 1}
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
										cursor: field.options.length <= 1 ? 'not-allowed' : 'pointer',
										opacity: field.options.length <= 1 ? 0.4 : 1,
									}}
								>
									<Trash2 size={12} />
								</button>
							</div>
						))}
					</div>
					{!field.visible && (
						<div style={{ fontSize: '10.5px', opacity: 0.55, marginTop: '6px' }}>
							{t('regCoreHiddenHint')}
						</div>
					)}
				</div>
			</div>
		);
	};

	if (isLoading) {
		return <div style={{ padding: 20, textAlign: 'center', opacity: 0.55 }}>{t('loading')}</div>;
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
			<div>
				<h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{t('regCoreTitle')}</h3>
				<p style={{ margin: '3px 0 0', fontSize: '11.5px', opacity: 0.6 }}>{t('regCoreDesc')}</p>
			</div>

			{status && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '7px',
						padding: '8px 10px',
						borderRadius: '8px',
						fontSize: '11.5px',
						background: status.type === 'ok' ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
						color: status.type === 'ok' ? '#30d158' : '#ff453a',
						border: `1px solid ${status.type === 'ok' ? 'rgba(48,209,88,0.3)' : 'rgba(255,69,58,0.3)'}`,
					}}
				>
					{status.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
					{status.text}
				</div>
			)}

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
				{renderField('track')}
				{renderField('level')}
			</div>

			<div style={cardStyle}>
				<div
					style={{
						display: 'flex',
						alignItems: 'flex-start',
						justifyContent: 'space-between',
						gap: '12px',
						marginBottom: '10px',
					}}
				>
					<div>
						<div style={{ fontSize: '12.5px', fontWeight: 700 }}>{t('regCoreMemberId')}</div>
						<div style={{ fontSize: '11px', opacity: 0.55, marginTop: '2px' }}>
							{t('regCoreMemberIdHint')}
						</div>
					</div>
					<label
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '7px',
							fontSize: '11.5px',
							fontWeight: 600,
							cursor: 'pointer',
							whiteSpace: 'nowrap',
						}}
					>
						<input
							type="checkbox"
							checked={draft.memberId.required}
							onChange={(event) =>
								setDraft((previous) => ({
									...previous,
									memberId: { ...previous.memberId, required: event.target.checked },
								}))
							}
							style={{ accentColor: 'var(--accent)' }}
						/>
						{t('regCoreRequired')}
					</label>
				</div>

				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
					<div>
						<label style={labelStyle}>{t('formLabelTr')}</label>
						<input
							style={inputStyle}
							value={draft.memberId.labelTr}
							onChange={(event) =>
								setDraft((previous) => ({
									...previous,
									memberId: { ...previous.memberId, labelTr: event.target.value },
								}))
							}
						/>
					</div>
					<div>
						<label style={labelStyle}>{t('formLabelEn')}</label>
						<input
							style={inputStyle}
							value={draft.memberId.labelEn}
							onChange={(event) =>
								setDraft((previous) => ({
									...previous,
									memberId: { ...previous.memberId, labelEn: event.target.value },
								}))
							}
						/>
					</div>
					<div>
						<label style={labelStyle}>{t('formPlaceholderTr')}</label>
						<input
							style={inputStyle}
							value={draft.memberId.placeholderTr}
							onChange={(event) =>
								setDraft((previous) => ({
									...previous,
									memberId: { ...previous.memberId, placeholderTr: event.target.value },
								}))
							}
						/>
					</div>
					<div>
						<label style={labelStyle}>{t('formPlaceholderEn')}</label>
						<input
							style={inputStyle}
							value={draft.memberId.placeholderEn}
							onChange={(event) =>
								setDraft((previous) => ({
									...previous,
									memberId: { ...previous.memberId, placeholderEn: event.target.value },
								}))
							}
						/>
					</div>
				</div>
				<div style={{ fontSize: '10.5px', opacity: 0.55, marginTop: '6px' }}>
					{draft.memberId.required ? t('regCoreRequiredOn') : t('regCoreRequiredOff')}
				</div>
			</div>

			<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
				<button
					type="button"
					onClick={() => void save()}
					disabled={isSaving}
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
						cursor: isSaving ? 'wait' : 'pointer',
						opacity: isSaving ? 0.7 : 1,
					}}
				>
					<Save size={13} />
					{isSaving ? t('saving') : t('regCoreSave')}
				</button>
			</div>
		</div>
	);
}
