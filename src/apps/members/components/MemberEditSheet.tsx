'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import { resolveLocalizedText, useI18n } from '@/core/i18n';
import { errorMessage } from '@/lib/errors';
import { optionLabel } from '@/lib/formFields';
import ui from '@/core/ui/ui.module.css';
import { MemberCustomFieldsGroup } from './MemberCustomFieldsGroup';
import { MEMBER_MAX_BIO_LENGTH } from '../utils/memberContracts';
import {
	fetchMemberEditDetail,
	patchMemberEditDetail,
	type MemberAdminDetail,
	type MemberEditValues,
} from '../utils/memberEditApi';

interface MemberEditSheetProps {
	memberId: string | null;
	onClose: () => void;
	onSaved: () => void;
}

export function MemberEditSheet({ memberId, onClose, onSaved }: MemberEditSheetProps) {
	const { t, language } = useI18n();
	const [detail, setDetail] = useState<MemberAdminDetail | null>(null);
	const [values, setValues] = useState<MemberEditValues | null>(null);
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
		fetchMemberEditDetail(memberId, t, t('membersEditLoadFailed'))
			.then((next) => {
				if (cancelled) return;
				setDetail(next);
				setValues({
					name: next.member.firstName || next.member.name,
					surname: next.member.lastName || next.member.surname,
					email: next.member.email,
					studentNo: next.member.handle || next.member.studentNo,
					department: next.member.department ?? '',
					grade: next.member.grade ?? 1,
					bio: next.member.bio ?? '',
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
		if (!options.some((option) => option.value === values.department)) {
			options.unshift({ value: values.department, labelTr: values.department, labelEn: values.department });
		}
		return options;
	}, [detail, values]);

	const levelOptions = useMemo(() => {
		if (!detail || !values) return [];
		const options = [...detail.core.level.options];
		if (!options.some((option) => Number(option.value) === values.grade)) {
			options.unshift({ value: String(values.grade), labelTr: String(values.grade), labelEn: String(values.grade) });
		}
		return options;
	}, [detail, values]);

	if (!memberId) return null;

	const update = <K extends keyof MemberEditValues>(key: K, value: MemberEditValues[K]) => {
		setValues((previous) => (previous ? { ...previous, [key]: value } : previous));
	};

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!values) return;
		setSaving(true);
		setError(null);
		setFieldErrors({});
		try {
			const res = await patchMemberEditDetail(memberId, values, customValues, t, t('membersEditFailed'));
			if (res.error) {
				if (res.fieldErrors) setFieldErrors(res.fieldErrors);
				throw new Error(res.error);
			}
			onSaved();
			onClose();
		} catch (err) {
			setError(errorMessage(err) || t('membersEditFailed'));
		} finally {
			setSaving(false);
		}
	};

	const coreLabel = (item: { labelTr: string; labelEn: string }) =>
		resolveLocalizedText({ en: item.labelEn, tr: item.labelTr }, language, item.labelEn || item.labelTr);

	return (
		<Sheet
			title={t('membersEditTitle')}
			icon={<Pencil size={20} color="var(--accent)" />}
			onClose={onClose}
			onSubmit={submit}
			closeLabel={t('close')}
			maxWidth={520}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose} disabled={saving}>{t('btnCancel')}</button>
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
							<input className={ui.input} value={values.name} onChange={(e) => update('name', e.target.value)} maxLength={60} required />
						</label>
						<label className={ui.field}>
							<span className={ui.fieldLabel}>{t('membersLastName')}</span>
							<input className={ui.input} value={values.surname} onChange={(e) => update('surname', e.target.value)} maxLength={60} required />
						</label>
					</div>

					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('membersEmailLabel')}</span>
						<input className={ui.input} type="email" value={values.email} onChange={(e) => update('email', e.target.value)} required />
					</label>

					<label className={ui.field}>
						<span className={ui.fieldLabel}>{coreLabel(detail.core.memberId)}</span>
						<input className={ui.input} value={values.studentNo} onChange={(e) => update('studentNo', e.target.value)} maxLength={32} required />
					</label>

					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
						<label className={ui.field}>
							<span className={ui.fieldLabel}>{coreLabel(detail.core.track)}</span>
							<select className={ui.select} style={{ maxWidth: 'none' }} value={values.department} onChange={(e) => update('department', e.target.value)}>
								{trackOptions.map((option) => (
									<option key={option.value} value={option.value}>{optionLabel(option, language)}</option>
								))}
							</select>
						</label>
						<label className={ui.field}>
							<span className={ui.fieldLabel}>{coreLabel(detail.core.level)}</span>
							<select className={ui.select} style={{ maxWidth: 'none' }} value={values.grade} onChange={(e) => update('grade', Number(e.target.value))}>
								{levelOptions.map((option) => (
									<option key={option.value} value={Number(option.value)}>{optionLabel(option, language)}</option>
								))}
							</select>
						</label>
					</div>

					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('membersAboutLabel')}</span>
						<textarea
							className={ui.textarea}
							rows={3}
							maxLength={MEMBER_MAX_BIO_LENGTH}
							value={values.bio}
							onChange={(e) => update('bio', e.target.value)}
						/>
					</label>

					<MemberCustomFieldsGroup
						fields={detail.fields}
						customValues={customValues}
						fieldErrors={fieldErrors}
						onChange={(key, next) => setCustomValues((prev) => ({ ...prev, [key]: next }))}
					/>
				</div>
			)}
		</Sheet>
	);
}
