'use client';

import { useState, type FormEvent } from 'react';
import { CompactField, Field, PasswordInput, SubmitButton, TextInput } from './AuthControls';
import { PasswordStrengthMeter } from '@/components/Common/PasswordStrengthMeter';
import type { AuthFlow } from './useAuthFlow';
import { useI18n } from '@/core/i18n';
import styles from './AuthPortal.module.css';
import { DEPARTMENTS, BOLUMLER, EXPERIENCE_LEVELS } from '@/data/departments';
import { ChevronDown, Search, KeyRound } from 'lucide-react';
import { LegalModal, type LegalTab } from './LegalModal';

export function RegisterForm({ flow }: { flow: AuthFlow }) {
	const { t } = useI18n();
	const [ad, setAd] = useState('');
	const [soyad, setSoyad] = useState('');
	const [ogrenciNo, setOgrenciNo] = useState('');
	const [termsAccepted, setTermsAccepted] = useState(false);
	const [privacyAccepted, setPrivacyAccepted] = useState(false);
	const [legalError, setLegalError] = useState(false);
	const [legalModalOpen, setLegalModalOpen] = useState(false);
	const [legalModalTab, setLegalModalTab] = useState<LegalTab>('terms');
	const [deptSearch, setDeptSearch] = useState('');
	const [isDeptOpen, setIsDeptOpen] = useState(false);
	const [bolum, setBolum] = useState(BOLUMLER[0]);
	const [sinif, setSinif] = useState(1);
	const [email, setEposta] = useState('');
	const [password, setSifre] = useState('');
	const [regStep, setRegStep] = useState<'form' | 'verify'>('form');
	const [verificationCode, setDogrulamaKodu] = useState('');
	const [hpWebsite, setHpWebsite] = useState('');

	const openLegal = (tab: LegalTab) => {
		setLegalModalTab(tab);
		setLegalModalOpen(true);
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (regStep === 'form') {
			const cleanHandle = ogrenciNo.trim();
			if (cleanHandle && !/^[a-zA-Z0-9_-]{3,32}$/.test(cleanHandle)) {
				flow.setErrorMessage(
					t(
						'authMemberIdError',
						'Member ID / Handle must be 3–32 characters using letters, numbers, hyphens (-), or underscores (_).'
					)
				);
				return;
			}
			if (!termsAccepted || !privacyAccepted) {
				setLegalError(true);
				return;
			}
			const res = await flow.submitRegister({
				ad: ad.trim(),
				soyad: soyad.trim(),
				ogrenciNo: cleanHandle,
				bolum,
				sinif,
				email: email.trim(),
				password,
				hp_website: hpWebsite,
			});
			if (res?.requireVerification) {
				setRegStep('verify');
			}
		} else {
			if (verificationCode.trim().length !== 6) {
				flow.setErrorMessage(
					t('authVerificationCodeError', 'Please enter the full 6-digit verification code.')
				);
				return;
			}
			await flow.submitRegister({
				ad: ad.trim(),
				soyad: soyad.trim(),
				ogrenciNo: ogrenciNo.trim(),
				bolum,
				sinif,
				email: email.trim(),
				password,
				verificationCode: verificationCode.trim(),
				hp_website: hpWebsite,
			});
		}
	};

	return (
		<form onSubmit={handleSubmit}>
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
			{regStep === 'verify' ? (
				<div style={{ padding: '8px 0', textAlign: 'center' }}>
					<div
						style={{
							width: '44px',
							height: '44px',
							borderRadius: '8px',
							background: '#18181b',
							border: '1px solid #27272a',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							margin: '0 auto 12px',
							color: '#fafafa',
						}}
					>
						<KeyRound size={20} />
					</div>
					<h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px 0', color: '#fafafa' }}>
						{t('authVerifyEmailTitle', 'Verify Your Email')}
					</h3>
					<p style={{ fontSize: '12.5px', color: '#a1a1aa', margin: '0 0 16px 0', lineHeight: 1.5 }}>
						{t('authVerifyEmailSent', 'We sent a 6-digit verification code to {email}.').replace('{email}', email)}
					</p>

					<div style={{ marginBottom: '16px' }}>
						<input
							type="text"
							required
							maxLength={6}
							autoFocus
							value={verificationCode}
							onChange={(e) => setDogrulamaKodu(e.target.value.replace(/[^0-9]/g, ''))}
							placeholder="••••••"
							style={{
								width: '100%',
								padding: '10px 12px',
								borderRadius: '8px',
								border: '1px solid #27272a',
								background: '#09090b',
								color: '#fafafa',
								fontSize: '22px',
								fontWeight: 700,
								letterSpacing: '8px',
								textAlign: 'center',
								outline: 'none',
								fontFamily: 'monospace',
							}}
						/>
					</div>

					<div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
						<button
							type="button"
							onClick={() => setRegStep('form')}
							style={{
								flex: 1,
								minHeight: '42px',
								padding: '10px',
								borderRadius: '8px',
								border: '1px solid #27272a',
								background: '#09090b',
								color: '#a1a1aa',
								fontSize: '12.5px',
								fontWeight: 600,
								cursor: 'pointer',
							}}
						>
							{t('authEditDetails', 'Edit Details')}
						</button>
						<div style={{ flex: 1.5 }}>
							<SubmitButton
								compact
								loading={flow.loading}
								disabled={verificationCode.trim().length !== 6}
								label={t('authVerifyCompleteBtn', 'Verify & Complete')}
								loadingLabel={t('authVerifying', 'Verifying...')}
							/>
						</div>
					</div>
				</div>
			) : (
				<>
					<div className={styles.fieldRow}>
						<CompactField label={t('authFirstNameLabel', 'First Name')}>
							<TextInput
								required
								compact
								autoComplete="given-name"
								value={ad}
								onChange={(e) => setAd(e.target.value)}
								placeholder={t('authFirstNamePh', 'First name')}
							/>
						</CompactField>
						<CompactField label={t('authLastNameLabel', 'Last Name')}>
							<TextInput
								required
								compact
								autoComplete="family-name"
								value={soyad}
								onChange={(e) => setSoyad(e.target.value)}
								placeholder={t('authLastNamePh', 'Last name')}
							/>
						</CompactField>
					</div>

					<div className={styles.fieldRow}>
						<div className={styles.fieldGrow}>
							<CompactField label={t('authTrackLabel', 'Community Track')}>
								<div style={{ position: 'relative', width: '100%' }}>
									<button
										type="button"
										onClick={() => setIsDeptOpen(!isDeptOpen)}
										style={{
											width: '100%',
											minHeight: '38px',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'space-between',
											padding: '8px 12px',
											fontSize: '12.5px',
											borderRadius: '8px',
											backgroundColor: '#09090b',
											border: '1px solid #27272a',
											color: '#fafafa',
											textAlign: 'left',
											cursor: 'pointer',
											outline: 'none',
										}}
									>
										<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
											{bolum || t('authTrackPh', 'Select Track')}
										</span>
										<ChevronDown size={14} style={{ color: '#a1a1aa', marginLeft: '8px', flexShrink: 0 }} />
									</button>

									{isDeptOpen && (
										<>
											<div
												onClick={() => setIsDeptOpen(false)}
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
														placeholder={t('authTrackSearchPh', 'Search track or division...')}
														value={deptSearch}
														onChange={(e) => setDeptSearch(e.target.value)}
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
													{DEPARTMENTS.filter(
														(d) =>
															d.name.toLowerCase().includes(deptSearch.toLowerCase()) ||
															d.faculty.toLowerCase().includes(deptSearch.toLowerCase())
													).map((d) => (
														<button
															key={d.id}
															type="button"
															onClick={() => {
																setBolum(d.name);
																setIsDeptOpen(false);
																setDeptSearch('');
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
																backgroundColor: bolum === d.name ? '#fafafa' : 'transparent',
																color: bolum === d.name ? '#09090b' : '#d4d4d8',
															}}
														>
															<span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
																{d.name}
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
						<CompactField label={t('authLevelLabel', 'Experience Level')}>
							<select
								className={styles.select}
								value={sinif}
								onChange={(e) => setSinif(Number(e.target.value))}
							>
								{EXPERIENCE_LEVELS.map((lvl) => (
									<option key={lvl.value} value={lvl.value}>
										{lvl.label}
									</option>
								))}
							</select>
						</CompactField>
					</div>

					<Field label={t('authMemberIdLabel', 'Member ID / Handle (Optional)')} compact>
						<TextInput
							compact
							maxLength={32}
							value={ogrenciNo}
							onChange={(e) => setOgrenciNo(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32))}
							placeholder={t('authMemberIdPh', 'e.g. alex_dev or leave blank (ORB-XXXXXX)')}
						/>
					</Field>

					<Field label={t('authEmailAddressLabel', 'Email Address')} compact>
						<TextInput
							type="email"
							required
							compact
							autoComplete="email"
							value={email}
							onChange={(e) => setEposta(e.target.value)}
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
							onChange={(e) => setSifre(e.target.value)}
							placeholder="••••••••"
						/>
					</Field>
					<PasswordStrengthMeter password={password} />

					{/* Worldwide Legal Compliance Checkboxes */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
						<label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', cursor: 'pointer', color: '#d4d4d8', lineHeight: 1.4 }}>
							<input
								type="checkbox"
								checked={termsAccepted}
								aria-invalid={legalError && !termsAccepted}
								onChange={(e) => {
									setTermsAccepted(e.target.checked);
									if (e.target.checked && privacyAccepted) setLegalError(false);
								}}
								style={{ cursor: 'pointer', marginTop: '2px', accentColor: '#fafafa' }}
							/>
							<span>
								{t('authTermsAgreePrefix', 'I agree to the')}{' '}
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										openLegal('terms');
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
									{t('authTermsLink', 'Terms of Service and Community Guidelines')}
								</button>
							</span>
						</label>

						<label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', cursor: 'pointer', color: '#d4d4d8', lineHeight: 1.4 }}>
							<input
								type="checkbox"
								checked={privacyAccepted}
								aria-invalid={legalError && !privacyAccepted}
								onChange={(e) => {
									setPrivacyAccepted(e.target.checked);
									if (e.target.checked && termsAccepted) setLegalError(false);
								}}
								style={{ cursor: 'pointer', marginTop: '2px', accentColor: '#fafafa' }}
							/>
							<span>
								{t('authPrivacyAckPrefix', 'I acknowledge the')}{' '}
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										openLegal('privacy');
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
									{t('authPrivacyLink', 'Privacy Policy')}
								</button>{' '}
								{t('authAnd', 'and')}{' '}
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										openLegal('cookies');
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
									{t('authCookieLink', 'Cookie & Session Policy')}
								</button>
							</span>
						</label>
					</div>

					{legalError && (
						<p role="alert" style={{ marginTop: 6, fontSize: 11.5, color: '#f87171' }}>
							{t('authLegalError', 'Please accept both the Terms of Service and the Privacy & Cookie Policy.')}
						</p>
					)}

					<div style={{ marginTop: 16 }}>
						<SubmitButton
							compact
							loading={flow.loading}
							disabled={flow.kurulumEksik}
							label={t('authContinueCodeBtn', 'Continue (Get Verification Code)')}
							loadingLabel={t('authSendingCode', 'Sending Code...')}
						/>
					</div>

					<div className={styles.hint}>
						{t('authRegApprovalHint', 'Your account will be activated once approved by community administrators.')}
					</div>
				</>
			)}

			<LegalModal
				isOpen={legalModalOpen}
				initialTab={legalModalTab}
				onClose={() => setLegalModalOpen(false)}
				onAccept={() => {
					setLegalModalOpen(false);
					setTermsAccepted(true);
					setPrivacyAccepted(true);
					setLegalError(false);
				}}
			/>
		</form>
	);
}
