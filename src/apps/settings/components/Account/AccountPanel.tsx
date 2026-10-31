'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useJsonResource } from '@/core/data/useJsonResource';
import { BIO_MAX } from '@/lib/profile';
import { DEFAULT_REGISTRATION_CORE_CONFIG } from '@/lib/registrationConfig';
import {
	fieldLabel,
	fieldPlaceholder,
	fieldRequiredForSelf,
	optionLabel,
	type FormField,
	type FormFieldOption,
} from '@/lib/formFields';
import type { UserSummary } from '@/db';
import ui from '@/core/ui/ui.module.css';
import styles from './Account.module.css';
import { AccountProfileHero } from './AccountProfileHero';
import { AccountStatsCards } from './AccountStatsCards';
import { AccountPasswordForm } from './AccountPasswordForm';
import {
	LegalDocumentModal,
	type LegalDocumentContent,
} from '@/components/Auth/LegalDocumentModal';

interface ProfileResponse {
	user: {
		id: string;
		ad: string;
		soyad: string;
		email: string;
		ogrenciNo: string | null;
		bolum: string;
		sinif: number;
		rolBilgi: { id: string; ad: string; renk: string } | null;
		profilFoto?: string | null;
		bio?: string | null;
		xp: number;
		olusturma: number;
	};
	seviye: { seviye: number; ilerleme: number; sonraki: number };
	ozet: UserSummary;
	fields?: FormField[];
	customFields?: Record<string, string>;
}

export function AccountPanel() {
	const { refreshSession } = useSession();
	const { t, language } = useI18n();
	const { playSystemSound } = useSound();
	const { data, refetch } = useJsonResource<ProfileResponse>('/api/profile');

	const [bolum, setBolum] = useState<string | null>(null);
	const [sinif, setSinif] = useState<number | null>(null);
	const [bio, setBio] = useState<string | null>(null);
	const [levelOptions, setLevelOptions] = useState<FormFieldOption[]>(
		DEFAULT_REGISTRATION_CORE_CONFIG.level.options
	);
	const [trackOptions, setTrackOptions] = useState<FormFieldOption[]>(
		DEFAULT_REGISTRATION_CORE_CONFIG.track.options
	);
	const [busy, setBusy] = useState<'' | 'profile' | 'photo' | 'password'>('');
	const [msg, setMsg] = useState<{ area: 'profile' | 'photo' | 'password'; text: string; tone: 'ok' | 'err' } | null>(null);
	const [customValues, setCustomValues] = useState<Record<string, string>>({});
	const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
	const [emailOpen, setEmailOpen] = useState(false);
	const [emailStep, setEmailStep] = useState<'request' | 'verify'>('request');
	const [newEmail, setNewEmail] = useState('');
	const [emailCode, setEmailCode] = useState('');
	const [emailBusy, setEmailBusy] = useState(false);
	const [emailMsg, setEmailMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
	const [missingLegal, setMissingLegal] = useState<LegalDocumentContent[]>([]);
	const [activeLegal, setActiveLegal] = useState<LegalDocumentContent | null>(null);
	const [legalBusy, setLegalBusy] = useState(false);

	useEffect(() => {
		if (!msg || msg.tone === 'err') return;
		const id = setTimeout(() => setMsg(null), 3500);
		return () => clearTimeout(id);
	}, [msg]);

	useEffect(() => {
		let cancelled = false;
		fetch('/api/registration-config', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (cancelled) return;
				if (Array.isArray(data?.config?.level?.options)) {
					setLevelOptions(data.config.level.options);
				}
				if (Array.isArray(data?.config?.track?.options)) {
					setTrackOptions(data.config.track.options);
				}
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (data?.customFields) setCustomValues(data.customFields);
	}, [data]);

	useEffect(() => {
		if (!emailOpen) return;
		let cancelled = false;
		fetch('/api/profile/email', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((payload) => {
				if (cancelled || !payload?.pending) return;
				setEmailStep('verify');
				setNewEmail(payload.pending.newEmail ?? '');
				setEmailMsg({ text: t('acEmailPending'), tone: 'ok' });
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [emailOpen, t]);

	useEffect(() => {
		let cancelled = false;
		fetch('/api/legal/status', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((payload) => {
				if (!cancelled && Array.isArray(payload?.documents)) setMissingLegal(payload.documents);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);

	if (!data) return <div className={ui.muted}>…</div>;
	const { user, seviye, ozet } = data;
	const selfFields = data.fields ?? [];
	const values = { bolum: bolum ?? user.bolum, sinif: sinif ?? user.sinif, bio: bio ?? user.bio ?? '' };
	const customDirty = selfFields.some(
		(field) => (customValues[field.fieldKey] ?? '') !== (data.customFields?.[field.fieldKey] ?? '')
	);
	const dirty =
		values.bolum !== user.bolum ||
		values.sinif !== user.sinif ||
		values.bio !== (user.bio ?? '') ||
		customDirty;
	const trackOptionsForUser = trackOptions.some((option) => option.value === values.bolum)
		? trackOptions
		: [
				...trackOptions,
				{ value: values.bolum, labelTr: values.bolum, labelEn: values.bolum },
		  ];
	const levelOptionsForUser = levelOptions.some((option) => Number(option.value) === values.sinif)
		? levelOptions
		: [
				...levelOptions,
				{ value: String(values.sinif), labelTr: `${values.sinif}`, labelEn: `${values.sinif}` },
		  ];

	const done = async (area: 'profile' | 'photo' | 'password', ok: boolean, text: string) => {
		setBusy('');
		setMsg({ area, text, tone: ok ? 'ok' : 'err' });
		if (ok) {
			playSystemSound();
			await Promise.all([refetch(), refreshSession()]);
		}
	};

	const saveProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy('profile');
		setCustomErrors({});
		let ok = false;
		let message = t('kbActionFailed');
		try {
			const res = await fetch('/api/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...values, customFields: customValues }),
			});
			const payload = await res.json().catch(() => null);
			ok = res.ok;
			message = payload?.error || message;
			if (!ok && payload?.fieldErrors) setCustomErrors(payload.fieldErrors);
			if (ok) {
				setBolum(null);
				setSinif(null);
				setBio(null);
			}
		} catch {
			ok = false;
		}
		await done('profile', ok, ok ? t('acSaved') : message);
	};

	const closeEmailChange = () => {
		setEmailOpen(false);
		setEmailStep('request');
		setNewEmail('');
		setEmailCode('');
		setEmailMsg(null);
	};

	const requestEmailCode = async () => {
		if (!newEmail.trim()) {
			setEmailMsg({ text: t('acEmailChangeFailed'), tone: 'err' });
			return;
		}
		setEmailBusy(true);
		setEmailMsg(null);
		try {
			const res = await fetch('/api/profile/email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ newEmail: newEmail.trim() }),
			});
			const payload = await res.json().catch(() => null);
			if (!res.ok) throw new Error(payload?.error || t('acEmailChangeFailed'));
			setEmailStep('verify');
			setEmailCode('');
			setEmailMsg({ text: t('acEmailCodeSent'), tone: 'ok' });
		} catch (error) {
			setEmailMsg({
				text: error instanceof Error ? error.message : t('acEmailChangeFailed'),
				tone: 'err',
			});
		} finally {
			setEmailBusy(false);
		}
	};

	const confirmEmailCode = async () => {
		if (!/^\d{6}$/.test(emailCode.trim())) {
			setEmailMsg({ text: t('acVerificationCode'), tone: 'err' });
			return;
		}
		setEmailBusy(true);
		setEmailMsg(null);
		try {
			const res = await fetch('/api/profile/email/confirm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: emailCode.trim() }),
			});
			const payload = await res.json().catch(() => null);
			if (!res.ok) throw new Error(payload?.error || t('acEmailChangeFailed'));
			closeEmailChange();
			setMsg({ area: 'profile', text: t('acEmailChanged'), tone: 'ok' });
			playSystemSound();
			await Promise.all([refetch(), refreshSession()]);
		} catch (error) {
			setEmailMsg({
				text: error instanceof Error ? error.message : t('acEmailChangeFailed'),
				tone: 'err',
			});
		} finally {
			setEmailBusy(false);
		}
	};

	const acceptLegalDocument = async () => {
		if (!activeLegal || legalBusy) return;
		setLegalBusy(true);
		try {
			const res = await fetch('/api/legal/accept', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ documentIds: [activeLegal.id] }),
			});
			const payload = await res.json().catch(() => null);
			if (!res.ok) throw new Error(payload?.error || t('acConsentFailed'));
			setMissingLegal(Array.isArray(payload?.documents) ? payload.documents : []);
			setActiveLegal(null);
			playSystemSound();
			setMsg({ area: 'profile', text: t('acConsentAccepted'), tone: 'ok' });
		} catch (error) {
			setMsg({
				area: 'profile',
				text: error instanceof Error ? error.message : t('acConsentFailed'),
				tone: 'err',
			});
		} finally {
			setLegalBusy(false);
		}
	};

	const note = (area: 'profile' | 'photo' | 'password') =>
		msg?.area === area ? (
			<div className={msg.tone === 'ok' ? styles.ok : ui.error} role={msg.tone === 'ok' ? 'status' : 'alert'}>
				{msg.text}
			</div>
		) : null;

	return (
		<div className={styles.root} data-focus-section="account">
			<AccountProfileHero
				user={user}
				seviye={seviye}
				busy={busy}
				onPhotoDone={(ok, text) => done('photo', ok, text)}
				onSetBusy={setBusy}
				note={note('photo')}
			/>

			<AccountStatsCards ozet={ozet} />

			<form className={styles.card} onSubmit={saveProfile} aria-label={t('acProfile')}>
				<h4 className={styles.cardTitle}>{t('acProfile')}</h4>
				<div className={styles.grid2}>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('acEmail')}</span>
						<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
							<input className={ui.input} value={user.email} disabled style={{ flex: 1, minWidth: 0 }} />
							<button
								type="button"
								className={ui.btn}
								onClick={() => setEmailOpen((open) => !open)}
								disabled={emailBusy}
							>
								{t('acChangeEmail')}
							</button>
						</div>
					</label>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('acStudentNo')}</span>
						<input className={ui.input} value={user.ogrenciNo ?? '—'} disabled />
					</label>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('acDepartment')}</span>
						<select className={ui.select} style={{ maxWidth: 'none' }} value={values.bolum} onChange={(e) => setBolum(e.target.value)}>
							{trackOptionsForUser.map((option) => (
								<option key={option.value} value={option.value}>
									{optionLabel(option, language)}
								</option>
							))}
						</select>
					</label>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('acYear')}</span>
						<select className={ui.select} style={{ maxWidth: 'none' }} value={values.sinif} onChange={(e) => setSinif(Number(e.target.value))}>
							{levelOptionsForUser.map((option) => (
								<option key={option.value} value={Number(option.value)}>
									{optionLabel(option, language)}
								</option>
							))}
						</select>
					</label>
				</div>

				{emailOpen && (
					<div
						style={{
							border: '1px solid var(--window-border)',
							borderRadius: '10px',
							padding: '12px',
							display: 'flex',
							flexDirection: 'column',
							gap: '10px',
							background: 'var(--fill-soft, rgba(255,255,255,0.04))',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
							<div style={{ fontSize: '12.5px', fontWeight: 700 }}>{t('acChangeEmail')}</div>
							<button type="button" className={ui.btn} onClick={closeEmailChange} disabled={emailBusy}>
								{t('acEmailChangeCancel')}
							</button>
						</div>
						{emailMsg && (
							<div className={emailMsg.tone === 'ok' ? styles.ok : ui.error} role={emailMsg.tone === 'ok' ? 'status' : 'alert'}>
								{emailMsg.text}
							</div>
						)}
						{emailStep === 'request' ? (
							<div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
								<label className={ui.field} style={{ flex: 1, minWidth: '200px' }}>
									<span className={ui.fieldLabel}>{t('acNewEmail')}</span>
									<input
										className={ui.input}
										type="email"
										autoComplete="email"
										value={newEmail}
										onChange={(event) => setNewEmail(event.target.value)}
										placeholder="yeni@ornek.com"
									/>
								</label>
								<button type="button" className={ui.primaryBtn} onClick={() => void requestEmailCode()} disabled={emailBusy}>
									{emailBusy ? t('saving') : t('acSendCode')}
								</button>
							</div>
						) : (
							<div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
								<label className={ui.field} style={{ flex: 1, minWidth: '200px' }}>
									<span className={ui.fieldLabel}>{t('acVerificationCode')}</span>
									<input
										className={ui.input}
										inputMode="numeric"
										maxLength={6}
										value={emailCode}
										onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
										placeholder="123456"
									/>
								</label>
								<button type="button" className={ui.primaryBtn} onClick={() => void confirmEmailCode()} disabled={emailBusy}>
									{emailBusy ? t('saving') : t('acVerifyCode')}
								</button>
							</div>
						)}
						<div style={{ fontSize: '11px', opacity: 0.6 }}>{newEmail || user.email}</div>
					</div>
				)}

				<label className={ui.field}>
					<span className={ui.fieldLabel} style={{ display: 'flex' }}>
						{t('acBio')}
						<span style={{ marginLeft: 'auto', fontWeight: 500 }}>
							{values.bio.length}/{BIO_MAX}
						</span>
					</span>
					<textarea className={ui.textarea} rows={3} maxLength={BIO_MAX} value={values.bio} placeholder={t('acBioPh')} onChange={(e) => setBio(e.target.value)} />
				</label>

				{selfFields.length > 0 && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
						<h4 className={styles.cardTitle}>{t('membersAdditionalFields')}</h4>
						{selfFields.map((field) => {
							const value = customValues[field.fieldKey] ?? '';
							const setValue = (next: string) =>
								setCustomValues((previous) => ({ ...previous, [field.fieldKey]: next }));
							const errorText = customErrors[field.fieldKey];
							const required = fieldRequiredForSelf(field);
							return (
								<label key={field.id} className={ui.field}>
									<span className={ui.fieldLabel}>
										{fieldLabel(field, language)}
										{required ? ' *' : ''}
									</span>
									{field.type === 'textarea' ? (
										<textarea
											className={ui.textarea}
											rows={3}
											value={value}
											placeholder={fieldPlaceholder(field, language)}
											onChange={(event) => setValue(event.target.value)}
											aria-invalid={Boolean(errorText)}
										/>
									) : field.type === 'select' ? (
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
											placeholder={fieldPlaceholder(field, language)}
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

				<div className={ui.btnRow} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
					<span className={ui.hint}>{t('acIdentityHint')}</span>
					<button type="submit" className={ui.primaryBtn} disabled={!dirty || busy === 'profile'}>
						{t('acSave')}
					</button>
				</div>
				{note('profile')}
			</form>

			<AccountPasswordForm
				userEmail={user.email}
				busy={busy}
				onPasswordDone={(ok, text) => done('password', ok, text)}
				onSetBusy={setBusy}
				note={note('password')}
			/>

			{missingLegal.length > 0 && (
				<div className={styles.card}>
					<h4 className={styles.cardTitle}>{t('acConsentsTitle')}</h4>
					<p style={{ margin: 0, fontSize: '12px', opacity: 0.65 }}>{t('acConsentsDesc')}</p>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						{missingLegal.map((document) => (
							<div
								key={document.id}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '10px',
									padding: '8px 10px',
									borderRadius: '8px',
									border: '1px solid var(--window-border)',
								}}
							>
								<div style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 600 }}>
									{language === 'tr' ? document.titleTr : document.titleEn}
								</div>
								<button
									type="button"
									className={ui.btn}
									onClick={() => setActiveLegal(document)}
									disabled={legalBusy}
								>
									{t('acConsentReview')}
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			<LegalDocumentModal
				document={activeLegal}
				onClose={() => setActiveLegal(null)}
				onAccept={() => void acceptLegalDocument()}
			/>
		</div>
	);
}
