'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CompactField, Field, PasswordInput, TextInput } from './AuthControls';
import { PasswordStrengthMeter } from '@/components/Common/PasswordStrengthMeter';
import type { AuthFlow } from './useAuthFlow';
import { useI18n } from '@/core/i18n';
import { useIdentity } from '@/core/identity';
import styles from './AuthPortal.module.css';
import { ChevronDown, Search, KeyRound, Check } from 'lucide-react';
import { LegalDocumentModal, type LegalDocumentContent } from './LegalDocumentModal';
import { DEFAULT_LEGAL_DOCUMENTS } from '@/lib/legalDefaults';
import {
	fieldAppliesTo,
	fieldLabel,
	fieldPlaceholder,
	fieldRequiredFor,
	optionLabel,
	type FormField,
} from '@/lib/formFields';
import {
	DEFAULT_REGISTRATION_CORE_CONFIG,
	defaultLevelValue,
	defaultTrackValue,
	normalizeRegistrationCoreConfig,
	type RegistrationCoreConfig,
} from '@/lib/registrationConfig';

const FALLBACK_LEGAL_DOCUMENTS: LegalDocumentContent[] = DEFAULT_LEGAL_DOCUMENTS.map(
	(document) => ({
		id: `legal_${document.docType}`,
		docType: document.docType,
		titleTr: document.titleTr,
		titleEn: document.titleEn,
		bodyTr: document.bodyTr,
		bodyEn: document.bodyEn,
		required: document.required,
	})
);

type WizardStep = 'account' | 'community' | 'verify';

export function RegisterForm({ flow }: { flow: AuthFlow }) {
	const { t, language } = useI18n();
	const { identity } = useIdentity();
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [memberHandle, setMemberHandle] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [wizardStep, setWizardStep] = useState<WizardStep>('account');
	const [verificationCode, setVerificationCode] = useState('');
	const [verificationQueued, setVerificationQueued] = useState(false);
	const [hpWebsite, setHpWebsite] = useState('');
	const inviteToken =
		typeof window !== 'undefined'
			? new URLSearchParams(window.location.search).get('invite') ?? undefined
			: undefined;

	const [coreConfig, setCoreConfig] = useState<RegistrationCoreConfig>(
		DEFAULT_REGISTRATION_CORE_CONFIG
	);
	const [track, setTrack] = useState(defaultTrackValue(DEFAULT_REGISTRATION_CORE_CONFIG));
	const [level, setLevel] = useState(defaultLevelValue(DEFAULT_REGISTRATION_CORE_CONFIG));
	const [trackSearch, setTrackSearch] = useState('');
	const [isTrackOpen, setIsTrackOpen] = useState(false);

	const [legalDocuments, setLegalDocuments] =
		useState<LegalDocumentContent[]>(FALLBACK_LEGAL_DOCUMENTS);
	const [acceptedDocuments, setAcceptedDocuments] = useState<Record<string, boolean>>({});
	const [activeLegalDocument, setActiveLegalDocument] =
		useState<LegalDocumentContent | null>(null);
	const [legalError, setLegalError] = useState(false);
	const [customFields, setCustomFields] = useState<FormField[]>([]);
	const [customValues, setCustomValues] = useState<Record<string, string>>({});
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		let cancelled = false;
		Promise.all([
			fetch('/api/legal?scope=registration', { cache: 'no-store' }).then((res) =>
				res.ok ? res.json() : null
			),
			fetch('/api/form-fields?scope=registration', { cache: 'no-store' }).then((res) =>
				res.ok ? res.json() : null
			),
			fetch('/api/registration-config', { cache: 'no-store' }).then((res) =>
				res.ok ? res.json() : null
			),
		])
			.then(([legalData, formData, coreData]) => {
				if (cancelled) return;
				if (Array.isArray(legalData?.documents)) {
					// An empty list is a real configuration: the community disabled every
					// registration document. Only a failed request keeps the bundled fallback.
					setLegalDocuments(legalData.documents);
				}
				if (Array.isArray(formData?.fields)) setCustomFields(formData.fields);
				if (coreData?.config) {
					const next = normalizeRegistrationCoreConfig(coreData.config);
					setCoreConfig(next);
					setTrack((previous) =>
						next.track.options.some((option) => option.value === previous)
							? previous
							: defaultTrackValue(next)
					);
					setLevel((previous) =>
						next.level.options.some((option) => Number(option.value) === previous)
							? previous
							: defaultLevelValue(next)
					);
				}
			})
			.catch(() => {
				// Bundled defaults keep the form usable if configuration is unreachable.
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const trackLabel = language === 'tr' ? coreConfig.track.labelTr : coreConfig.track.labelEn;
	const levelLabel = language === 'tr' ? coreConfig.level.labelTr : coreConfig.level.labelEn;
	const trackPlaceholder =
		language === 'tr'
			? coreConfig.track.placeholderTr
			: coreConfig.track.placeholderEn;
	const memberIdLabel =
		language === 'tr' ? coreConfig.memberId.labelTr : coreConfig.memberId.labelEn;
	const memberIdPlaceholder =
		language === 'tr'
			? coreConfig.memberId.placeholderTr
			: coreConfig.memberId.placeholderEn;
	const selectedTrack = coreConfig.track.options.find((option) => option.value === track);
	const filteredTrackOptions = coreConfig.track.options.filter((option) => {
		const query = trackSearch.trim().toLowerCase();
		if (!query) return true;
		return (
			option.labelTr.toLowerCase().includes(query) ||
			option.labelEn.toLowerCase().includes(query) ||
			option.value.toLowerCase().includes(query)
		);
	});

	const steps: Array<{ id: WizardStep; label: string }> = [
		{ id: 'account', label: t('authWizardAccount', 'Account') },
		{ id: 'community', label: t('authWizardCommunity', 'Community') },
		{ id: 'verify', label: t('authWizardVerify', 'Verify') },
	];
	const stepIndex = steps.findIndex((step) => step.id === wizardStep);

	const stepCopy: Record<WizardStep, { title: string; subtitle: string }> = {
		account: {
			title: t('authWizardAccountTitle', 'Set up your account'),
			subtitle: t(
				'authWizardAccountDesc',
				'Start with the credentials you will use to sign in. You can change the rest later.'
			),
		},
		community: {
			title: t('authWizardCommunityTitle', 'Your community profile'),
			subtitle: t(
				'authWizardCommunityDesc',
				'Choose your track and share what the community should know. Required agreements are at the bottom.'
			),
		},
		verify: {
			title: t('authVerifyEmailTitle', 'Verify Your Email'),
			subtitle: t('authWizardVerifyDesc', 'Enter the 6-digit code we sent to your e-mail address.'),
		},
	};

	const openLegal = (document: LegalDocumentContent) => {
		setActiveLegalDocument(document);
	};

	const currentDocumentTitle = (document: LegalDocumentContent) =>
		language === 'tr' ? document.titleTr : document.titleEn;

	const goTo = (step: WizardStep) => {
		setWizardStep(step);
		flow.setErrorMessage(null);
		setIsTrackOpen(false);
	};

	const validateAccount = (): boolean => {
		const cleanHandle = memberHandle.trim();
		if (coreConfig.memberId.required && !cleanHandle) {
			flow.setErrorMessage(t('authMemberIdRequired', 'Please enter a member ID / handle.'));
			return false;
		}
		if (cleanHandle && !/^[a-zA-Z0-9_-]{3,32}$/.test(cleanHandle)) {
			flow.setErrorMessage(
				t(
					'authMemberIdError',
					'Member ID / Handle must be 3–32 characters using letters, numbers, hyphens (-), or underscores (_).'
				)
			);
			return false;
		}
		if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
			flow.setErrorMessage(t('authFillRequired', 'Please fill in all required fields.'));
			return false;
		}
		return true;
	};

	const validateCommunity = (): boolean => {
		const missingLegal = legalDocuments.filter(
			(document) => document.required && !acceptedDocuments[document.id]
		);
		if (missingLegal.length > 0) {
			setLegalError(true);
			flow.setErrorMessage(t('authLegalError', 'Please accept all required agreements to continue.'));
			return false;
		}
		const missingCustom = customFields.filter(
			(field) =>
				fieldAppliesTo(field, 'registration') &&
				fieldRequiredFor(field, 'registration') &&
				!customValues[field.fieldKey]?.trim()
		);
		if (missingCustom.length > 0) {
			setFieldErrors(
				Object.fromEntries(
					missingCustom.map((field) => [
						field.fieldKey,
						t('authRequiredField', 'This field is required.'),
					])
				)
			);
			flow.setErrorMessage(t('authFormFieldsError', 'Please complete the highlighted fields.'));
			return false;
		}
		return true;
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();

		if (wizardStep === 'account') {
			if (!validateAccount()) return;
			goTo('community');
			return;
		}

		if (wizardStep === 'community') {
			if (!validateCommunity()) return;
			const res = await flow.submitRegister({
				ad: firstName.trim(),
				soyad: lastName.trim(),
				ogrenciNo: memberHandle.trim(),
				bolum: track,
				sinif: level,
				email: email.trim(),
				password,
				hp_website: hpWebsite,
				customFields: customValues,
				acceptedDocumentIds: legalDocuments
					.filter((document) => acceptedDocuments[document.id])
					.map((document) => document.id),
				inviteToken,
				preferredLanguage: language === 'tr' ? 'tr' : 'en',
			});
			if (res?.fieldErrors) setFieldErrors(res.fieldErrors);
			if (res?.requireVerification) {
				setVerificationQueued(Boolean(res.mailQueued));
				goTo('verify');
			}
			return;
		}

		if (verificationCode.trim().length !== 6) {
			flow.setErrorMessage(
				t('authVerificationCodeError', 'Please enter the full 6-digit verification code.')
			);
			return;
		}
		await flow.submitRegister({
			ad: firstName.trim(),
			soyad: lastName.trim(),
			ogrenciNo: memberHandle.trim(),
			bolum: track,
			sinif: level,
			email: email.trim(),
			password,
			verificationCode: verificationCode.trim(),
			hp_website: hpWebsite,
			customFields: customValues,
			acceptedDocumentIds: legalDocuments
				.filter((document) => acceptedDocuments[document.id])
				.map((document) => document.id),
			inviteToken,
			preferredLanguage: language === 'tr' ? 'tr' : 'en',
		});
	};

	return (
		<form onSubmit={handleSubmit} className={styles.wizardPanel}>
			{/* Invisible Bot Honeypot Trap */}
			<div
				style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, overflow: 'hidden' }}
				aria-hidden="true"
			>
				<input
					type="text"
					name="hp_website"
					tabIndex={-1}
					autoComplete="off"
					value={hpWebsite}
					onChange={(e) => setHpWebsite(e.target.value)}
				/>
			</div>

			<ol className={styles.wizardSteps} aria-label={t('authWizardStepsAria', 'Registration steps')}>
				{steps.map((step, index) => (
					<li
						key={step.id}
						className={`${styles.wizardStep} ${
							step.id === wizardStep ? styles.wizardStepActive : ''
						} ${index < stepIndex ? styles.wizardStepDone : ''}`}
					>
						<span className={styles.wizardStepNumber}>
							{index < stepIndex ? <Check size={12} strokeWidth={3} /> : index + 1}
						</span>
						<span className={styles.wizardStepLabel}>{step.label}</span>
					</li>
				))}
			</ol>

			<div className={styles.wizardHeader}>
				<div className={styles.wizardEyebrow}>{`${identity.siteName} // ${identity.studio}`}</div>
				<h3 className={styles.wizardTitle}>{stepCopy[wizardStep].title}</h3>
				<p className={styles.wizardSubtitle}>{stepCopy[wizardStep].subtitle}</p>
			</div>

			{wizardStep === 'account' && (
				<div className={styles.wizardPanel}>
					<div className={styles.fieldRow}>
						<CompactField label={t('authFirstNameLabel', 'First Name')}>
							<TextInput
								required
								compact
								autoComplete="given-name"
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								placeholder={t('authFirstNamePh', 'First name')}
							/>
						</CompactField>
						<CompactField label={t('authLastNameLabel', 'Last Name')}>
							<TextInput
								required
								compact
								autoComplete="family-name"
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								placeholder={t('authLastNamePh', 'Last name')}
							/>
						</CompactField>
					</div>

					<Field label={t('authEmailAddressLabel', 'Email Address')} compact>
						<TextInput
							type="email"
							required
							compact
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder={t('authEmailAddressPh', 'member@orbit.local or name@example.com')}
						/>
					</Field>

					<Field label={t('authPasswordMinLabel', 'Password (Min 8 characters)')} compact>
						<PasswordInput
							required
							compact
							minLength={8}
							autoComplete="new-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
						/>
					</Field>
					<PasswordStrengthMeter password={password} />

					<Field
						label={`${memberIdLabel}${coreConfig.memberId.required ? ' *' : ` (${t('authOptional', 'optional')})`}`}
						compact
					>
						<TextInput
							compact
							required={coreConfig.memberId.required}
							maxLength={32}
							value={memberHandle}
							onChange={(e) =>
								setMemberHandle(
									e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)
								)
							}
							placeholder={memberIdPlaceholder}
						/>
					</Field>

					<div className={styles.wizardActions}>
						<button type="submit" className={styles.wizardPrimary} disabled={flow.setupIncomplete}>
							{t('authWizardContinue', 'Continue')}
						</button>
					</div>
					<div className={styles.hint}>
						{t('authRegApprovalHint', 'Your account will be activated once approved by community administrators.')}
					</div>
				</div>
			)}

			{wizardStep === 'community' && (
				<div className={styles.wizardPanel}>
					{(coreConfig.track.visible || coreConfig.level.visible) && (
						<div className={styles.fieldRow}>
							{coreConfig.track.visible && (
								<div className={styles.fieldGrow}>
									<CompactField label={trackLabel}>
										<div style={{ position: 'relative', width: '100%' }}>
											<button
												type="button"
												onClick={() => setIsTrackOpen((open) => !open)}
												className={styles.select}
												style={{
													width: '100%',
													minHeight: '38px',
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'space-between',
													textAlign: 'left',
													cursor: 'pointer',
												}}
											>
												<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
													{selectedTrack ? optionLabel(selectedTrack, language) : trackPlaceholder}
												</span>
												<ChevronDown size={14} style={{ marginLeft: '8px', flexShrink: 0 }} />
											</button>

											{isTrackOpen && (
												<>
													<div
														onClick={() => setIsTrackOpen(false)}
														style={{ position: 'fixed', inset: 0, zIndex: 998 }}
													/>
													<div
														tabIndex={0}
														onWheel={(e) => {
															const target = e.currentTarget as HTMLElement;
															target.scrollTop += e.deltaY;
														}}
														style={{
															position: 'absolute',
															top: 'calc(100% + 4px)',
															left: 0,
															right: 0,
															zIndex: 999,
															backgroundColor: '#111113',
															borderRadius: '8px',
															border: '1px solid #27272a',
															padding: '6px',
															display: 'flex',
															flexDirection: 'column',
															gap: '6px',
															maxHeight: '260px',
															overflowY: 'auto',
														}}
													>
														<div
															style={{
																display: 'flex',
																alignItems: 'center',
																padding: '6px 8px',
																backgroundColor: '#09090b',
																borderRadius: '6px',
																border: '1px solid #27272a',
															}}
														>
															<Search size={13} style={{ color: '#a1a1aa', marginRight: '6px', flexShrink: 0 }} />
															<input
																type="text"
																placeholder={t('authTrackSearchPh', 'Search track...')}
																value={trackSearch}
																onChange={(e) => setTrackSearch(e.target.value)}
																style={{
																	width: '100%',
																	backgroundColor: 'transparent',
																	fontSize: '11.5px',
																	color: '#fafafa',
																	outline: 'none',
																	border: 'none',
																}}
																autoFocus
															/>
														</div>
														<div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
															{filteredTrackOptions.map((option) => (
																<button
																	key={option.value}
																	type="button"
																	onClick={() => {
																		setTrack(option.value);
																		setIsTrackOpen(false);
																		setTrackSearch('');
																	}}
																	style={{
																		width: '100%',
																		textAlign: 'left',
																		padding: '6px 8px',
																		borderRadius: '6px',
																		fontSize: '11.5px',
																		border: 'none',
																		cursor: 'pointer',
																		display: 'flex',
																		flexDirection: 'column',
																		gap: '1px',
																		backgroundColor:
																			track === option.value ? '#fafafa' : 'transparent',
																		color: track === option.value ? '#09090b' : '#d4d4d8',
																	}}
																>
																	<span
																		style={{
																			fontWeight: 600,
																			overflow: 'hidden',
																			textOverflow: 'ellipsis',
																			whiteSpace: 'nowrap',
																		}}
																	>
																		{optionLabel(option, language)}
																	</span>
																</button>
															))}
														</div>
													</div>
												</>
											)}
										</div>
									</CompactField>
								</div>
							)}
							{coreConfig.level.visible && (
								<CompactField label={levelLabel}>
									<select
										className={styles.select}
										value={level}
										onChange={(e) => setLevel(Number(e.target.value))}
									>
										{coreConfig.level.options.map((option) => (
											<option key={option.value} value={Number(option.value)}>
												{optionLabel(option, language)}
											</option>
										))}
									</select>
								</CompactField>
							)}
						</div>
					)}

					{customFields.filter((field) => fieldAppliesTo(field, 'registration')).length > 0 && (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
							<div className={styles.wizardSectionLabel}>
								{t('authCustomFieldsSection', 'Additional Member Information')}
							</div>
							{customFields
								.filter((field) => fieldAppliesTo(field, 'registration'))
								.map((field) => {
									const label = fieldLabel(field, language);
									const placeholder = fieldPlaceholder(field, language);
									const value = customValues[field.fieldKey] ?? '';
									const setValue = (next: string) => {
										setCustomValues((previous) => ({ ...previous, [field.fieldKey]: next }));
										setFieldErrors((previous) => {
											if (!previous[field.fieldKey]) return previous;
											const nextErrors = { ...previous };
											delete nextErrors[field.fieldKey];
											return nextErrors;
										});
									};
									const inputId = `reg-field-${field.fieldKey}`;
									const common = {
										id: inputId,
										name: field.fieldKey,
										required: fieldRequiredFor(field, 'registration'),
										value,
										placeholder,
										'aria-invalid': Boolean(fieldErrors[field.fieldKey]),
									};
									return (
										<div key={field.id}>
											<label htmlFor={inputId} className={`${styles.label} ${styles.labelCompact}`}>
												{label}
												{fieldRequiredFor(field, 'registration') ? ' *' : ''}
											</label>
											{field.type === 'textarea' ? (
												<textarea
													{...common}
													rows={3}
													onChange={(event) => setValue(event.target.value)}
													style={{
														width: '100%',
														padding: '9px 12px',
														borderRadius: '8px',
														border: '1px solid rgba(255,255,255,0.14)',
														background: 'rgba(9,9,11,0.56)',
														color: '#fafafa',
														fontSize: '12.5px',
														outline: 'none',
														resize: 'vertical',
														boxSizing: 'border-box',
													}}
												/>
											) : field.type === 'select' ? (
												<select
													{...common}
													onChange={(event) => setValue(event.target.value)}
													className={styles.select}
												>
													<option value="">{t('authSelectOption', 'Select…')}</option>
													{field.options.map((option) => (
														<option key={option.value} value={option.value}>
															{optionLabel(option, language)}
														</option>
													))}
												</select>
											) : field.type === 'password' ? (
												<PasswordInput
													{...common}
													compact
													autoComplete="new-password"
													onChange={(event) => setValue(event.target.value)}
												/>
											) : (
												<TextInput
													{...common}
													compact
													type={field.type === 'email' ? 'email' : field.type}
													onChange={(event) => setValue(event.target.value)}
												/>
											)}
											{fieldErrors[field.fieldKey] && (
												<p role="alert" style={{ margin: '4px 0 0', fontSize: '11px', color: '#f87171' }}>
													{fieldErrors[field.fieldKey]}
												</p>
											)}
										</div>
									);
								})}
						</div>
					)}

					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
						{legalDocuments.map((document) => {
							const accepted = Boolean(acceptedDocuments[document.id]);
							return (
								<label
									key={document.id}
									style={{
										display: 'flex',
										alignItems: 'flex-start',
										gap: '8px',
										fontSize: '11.5px',
										cursor: 'pointer',
										color: '#d4d4d8',
										lineHeight: 1.4,
									}}
								>
									<input
										type="checkbox"
										checked={accepted}
										aria-invalid={legalError && document.required && !accepted}
										onChange={(event) => {
											setAcceptedDocuments((previous) => ({
												...previous,
												[document.id]: event.target.checked,
											}));
											if (event.target.checked) setLegalError(false);
										}}
										style={{ cursor: 'pointer', marginTop: '2px', accentColor: '#fafafa', flexShrink: 0 }}
									/>
									<span>
										{t('authLegalReadPrefix', 'I have read and accept')}{' '}
										<button
											type="button"
											onClick={(event) => {
												event.preventDefault();
												openLegal(document);
											}}
											style={{
												background: 'none',
												border: 'none',
												color: '#fafafa',
												textDecoration: 'underline',
												cursor: 'pointer',
												padding: 0,
												font: 'inherit',
												fontWeight: 600,
											}}
										>
											{currentDocumentTitle(document)}
										</button>
										{!document.required && (
											<span style={{ opacity: 0.55 }}> ({t('authOptional', 'optional')})</span>
										)}
									</span>
								</label>
							);
						})}
					</div>

					{legalError && (
						<p role="alert" style={{ marginTop: 6, fontSize: 11.5, color: '#f87171' }}>
							{t('authLegalError', 'Please accept all required agreements to continue.')}
						</p>
					)}

					<div className={styles.wizardActions}>
						<button type="button" className={styles.wizardBack} onClick={() => goTo('account')}>
							{t('authWizardBack', 'Back')}
						</button>
						<button type="submit" className={styles.wizardPrimary} disabled={flow.setupIncomplete || flow.loading}>
							{flow.loading
								? t('authSendingCode', 'Sending Code...')
								: t('authWizardCreate', 'Create Account & Send Code')}
						</button>
					</div>
					<div className={styles.hint}>
						{t('authRegApprovalHint', 'Your account will be activated once approved by community administrators.')}
					</div>
				</div>
			)}

			{wizardStep === 'verify' && (
				<div className={styles.wizardPanel} style={{ textAlign: 'center' }}>
					<div className={styles.wizardVerifyIcon}>
						<KeyRound size={20} />
					</div>
					<p style={{ fontSize: '12.5px', color: '#a1a1aa', margin: '0 0 16px', lineHeight: 1.5 }}>
						{verificationQueued
							? t(
									'authVerifyMailQueued',
									'E-posta servisi şu anda kullanılamıyor. Doğrulama kodunuz yönetici onayına alındı; onaylandığında {email} adresine gönderilecek.'
								).replace('{email}', email)
							: t('authVerifyEmailSent', 'We sent a 6-digit verification code to {email}.').replace(
									'{email}',
									email
								)}
					</p>
					<input
						type="text"
						required
						maxLength={6}
						autoFocus
						value={verificationCode}
						onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
						placeholder="••••••"
						className={styles.wizardVerifyCode}
					/>
					<div className={styles.wizardActions}>
						<button type="button" className={styles.wizardBack} onClick={() => goTo('community')}>
							{t('authWizardBack', 'Back')}
						</button>
						<button
							type="submit"
							className={styles.wizardPrimary}
							disabled={verificationCode.trim().length !== 6 || flow.loading}
						>
							{flow.loading
								? t('authVerifying', 'Verifying...')
								: t('authVerifyCompleteBtn', 'Verify & Complete')}
						</button>
					</div>
					<div className={styles.wizardHint}>
						{t('authVerifyHint', 'Check your spam folder if the code does not arrive within a minute.')}
					</div>
				</div>
			)}

			<LegalDocumentModal
				document={activeLegalDocument}
				onClose={() => setActiveLegalDocument(null)}
				onAccept={
					activeLegalDocument
						? () => {
								setAcceptedDocuments((previous) => ({
									...previous,
									[activeLegalDocument.id]: true,
								}));
								setLegalError(false);
								setActiveLegalDocument(null);
						  }
						: undefined
				}
			/>
		</form>
	);
}
