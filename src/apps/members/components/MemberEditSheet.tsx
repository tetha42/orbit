'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import { useI18n } from '@/core/i18n';
import { errorMessage } from '@/lib/errors';
import { optionLabel, type FormField } from '@/lib/formFields';
import type { RegistrationCoreConfig } from '@/lib/registrationConfig';
import ui from '@/core/ui/ui.module.css';

interface MemberAdminDetail {
	member: {
		id: string;
		ad: string;
		soyad: string;
		email: string;
		ogrenciNo: string;
		bolum: string;
		sinif: number;
		bio: string;
		status: string;
		roleId: string | null;
		rolBilgi: { id: string; ad: string; renk: string } | null;
	};
	fields: FormField[];
	customFields: Record<string, string>;
	core: RegistrationCoreConfig;
}

interface MemberEditSheetProps {
	memberId: string | null;
	onClose: () => void;
	onSaved: () => void;
}

interface Values {
	ad: string;
	soyad: string;
	email: string;
	ogrenciNo: string;
	bolum: string;
	sinif: number;
	bio: string;
}

const textareaTypes = new Set(['textarea']);
const selectTypes = new Set(['select']);

export function MemberEditSheet({ memberId, onClose, onSaved }: MemberEditSheetProps) {
	const { t, language } = useI18n();
	const [detail, setDetail] = useState<MemberAdminDetail | null>(null);
	const [values, setValues] = useState<Values | null>(null);
	const [customValues, setCustomValues] = useState<Record<string, string>>({});
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		if (!memberId) {
			setDetail(null);
			setValues(null);
			setCustomValues({});
			setError(null);
			setFieldErrors({});
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		fetch(`/api/members/${encodeURIComponent(memberId)}`, { cache: 'no-store' })
			.then(async (res) => {
				const data = await res.json().catch(() => null);
				if (!res.ok) throw new Error(data?.error || t('membersEditLoadFailed'));
				if (cancelled) return;
				const next = data as MemberAdminDetail;
				setDetail(next);
				setValues({
					ad: next.member.ad,
					soyad: next.member.soyad,
					email: next.member.email,
					ogrenciNo: next.member.ogrenciNo,
					bolum: next.member.bolum,
					sinif: next.member.sinif,
					bio: next.member.bio,
				});
				setCustomValues(next.customFields ?? {});
			})
			.catch((err) => {
				if (!cancelled) setError(errorMessage(err) || t('membersEditLoadFailed'));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [memberId, t]);

	const trackOptions = useMemo(() => {
		if (!detail || !values) return [];
		const options = [...detail.core.track.options];
		if (!options.some((option) => option.value === values.bolum)) {
			options.unshift({
				value: values.bolum,
				labelTr: values.bolum,
				labelEn: values.bolum,
			});
		}
		return options;
	}, [detail, values]);

	const levelOptions = useMemo(() => {
		if (!detail || !values) return [];
		const options = [...detail.core.level.options];
		if (!options.some((option) => Number(option.value) === values.sinif)) {
			options.unshift({
				value: String(values.sinif),
				labelTr: String(values.sinif),
				labelEn: String(values.sinif),
			});
		}
		return options;
	}, [detail, values]);

	if (!memberId) return null;

	const update = <K extends keyof Values>(key: K, value: Values[K]) => {
		setValues((previous) => (previous ? { ...previous, [key]: value } : previous));
	};

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!values) return;
		setSaving(true);
		setError(null);
		setFieldErrors({});
		try {
			const res = await fetch(`/api/members/${encodeURIComponent(memberId)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...values, customFields: customValues }),
			});
			const data = await res.json().catch(() => null);
			if (!res.ok) {
				if (data?.fieldErrors) setFieldErrors(data.fieldErrors);
				throw new Error(data?.error || t('membersEditFailed'));
			}
			onSaved();
			onClose();
		} catch (err) {
			setError(errorMessage(err) || t('membersEditFailed'));
		} finally {
			setSaving(false);
		}
	};

	const fieldLabel = (field: FormField) =>
		language === 'tr' ? field.labelTr || field.labelEn : field.labelEn || field.labelTr;

	return (
		<Sheet
			title={t('membersEditTitle')}
			icon={<Pencil size={20} color="#0a84ff" />}
			onClose={onClose}
			onSubmit={submit}
			closeLabel={t('close')}
			maxWidth={520}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose} disabled={saving}>
						{t('btnCancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={saving || loading || !values}>
						{saving ? t('saving') : t('save')}
					</button>
				</>
			}
		>
			{loading && <div className={ui.muted}>{t('loading')}</div>}
			{error && <div className={ui.error}>{error}</div>}
			{values && detail && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
						<label className={ui.field}>
							<span className={ui.fieldLabel}>{t('membersFirstName')}</span>
							<input
								className={ui.input}
								value={values.ad}
								onChange={(event) => update('ad', event.target.value)}
								maxLength={60}
								required
							/>
						</label>
						<label className={ui.field}>
							<span className={ui.fieldLabel}>{t('membersLastName')}</span>
							<input
								className={ui.input}
								value={values.soyad}
								onChange={(event) => update('soyad', event.target.value)}
								maxLength={60}
								required
							/>
						</label>
					</div>

					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('membersEmailLabel')}</span>
						<input
							className={ui.input}
							type="email"
							value={values.email}
							onChange={(event) => update('email', event.target.value)}
							required
						/>
					</label>

					<label className={ui.field}>
						<span className={ui.fieldLabel}>
							{language === 'tr'
								? detail.core.memberId.labelTr
								: detail.core.memberId.labelEn}
						</span>
						<input
							className={ui.input}
							value={values.ogrenciNo}
							onChange={(event) => update('ogrenciNo', event.target.value)}
							maxLength={32}
							required
						/>
					</label>

					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
						<label className={ui.field}>
							<span className={ui.fieldLabel}>
								{language === 'tr' ? detail.core.track.labelTr : detail.core.track.labelEn}
							</span>
							<select
								className={ui.select}
								style={{ maxWidth: 'none' }}
								value={values.bolum}
								onChange={(event) => update('bolum', event.target.value)}
							>
								{trackOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{optionLabel(option, language)}
									</option>
								))}
							</select>
						</label>
						<label className={ui.field}>
							<span className={ui.fieldLabel}>
								{language === 'tr' ? detail.core.level.labelTr : detail.core.level.labelEn}
							</span>
							<select
								className={ui.select}
								style={{ maxWidth: 'none' }}
								value={values.sinif}
								onChange={(event) => update('sinif', Number(event.target.value))}
							>
								{levelOptions.map((option) => (
									<option key={option.value} value={Number(option.value)}>
										{optionLabel(option, language)}
									</option>
								))}
							</select>
						</label>
					</div>

					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('membersAboutLabel')}</span>
						<textarea
							className={ui.textarea}
							rows={3}
							value={values.bio}
							onChange={(event) => update('bio', event.target.value)}
						/>
					</label>

					{detail.fields.length > 0 && (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
							<div style={{ fontSize: 11, fontWeight: 700, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
								{t('membersAdditionalFields')}
							</div>
							{detail.fields.map((field) => {
								const value = customValues[field.fieldKey] ?? '';
								const setValue = (next: string) =>
									setCustomValues((previous) => ({ ...previous, [field.fieldKey]: next }));
								const errorText = fieldErrors[field.fieldKey];
								return (
									<label key={field.id} className={ui.field}>
										<span className={ui.fieldLabel}>
											{fieldLabel(field)}
											{field.requiredAt === 'admin' || field.requiredAt === 'both' ? ' *' : ''}
										</span>
										{selectTypes.has(field.type) ? (
											<select
												className={ui.select}
												style={{ maxWidth: 'none' }}
												value={value}
												onChange={(event) => setValue(event.target.value)}
												aria-invalid={Boolean(errorText)}
											>
												<option value="">{t('authSelectOption')}</option>
												{field.options.map((option) => (
													<option key={option.value} value={option.value}>
														{optionLabel(option, language)}
													</option>
												))}
											</select>
										) : textareaTypes.has(field.type) ? (
											<textarea
												className={ui.textarea}
												rows={3}
												value={value}
												placeholder={
													language === 'tr'
														? field.placeholderTr || field.placeholderEn
														: field.placeholderEn || field.placeholderTr
												}
												onChange={(event) => setValue(event.target.value)}
												aria-invalid={Boolean(errorText)}
											/>
										) : (
											<input
												className={ui.input}
												type={
													field.type === 'email'
														? 'email'
														: field.type === 'tel'
															? 'tel'
															: field.type === 'number'
																? 'number'
																: field.type === 'date'
																	? 'date'
																	: 'text'
												}
												value={value}
												placeholder={
													language === 'tr'
														? field.placeholderTr || field.placeholderEn
														: field.placeholderEn || field.placeholderTr
												}
												onChange={(event) => setValue(event.target.value)}
												aria-invalid={Boolean(errorText)}
											/>
										)}
										{errorText && <span style={{ fontSize: 11, color: '#ff453a' }}>{errorText}</span>}
									</label>
								);
							})}
						</div>
					)}
				</div>
			)}
		</Sheet>
	);
}
