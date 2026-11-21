'use client';

import { useState, type FormEvent } from 'react';
import { resolveLocalizedText, useI18n } from '@/core/i18n';
import { useIdentity } from '@/core/identity';
import type { AuthFlow } from './useAuthFlow';
import { LegalDocumentModal, type LegalDocumentContent } from './LegalDocumentModal';
import styles from './AuthPortal.module.css';
import { useRegisterConfig, type WizardStep } from './register/useRegisterConfig';
import { getRegisterStepCopy, validateAccountStep, validateCommunityStep } from './register/registerHelpers';
import { RegisterAccountStep } from './register/RegisterAccountStep';
import { RegisterCommunityStep } from './register/RegisterCommunityStep';
import { RegisterVerifyStep } from './register/RegisterVerifyStep';
import { RegisterStepProgress } from './register/RegisterStepProgress';

export function RegisterForm({ flow }: { flow: AuthFlow }) {
	const { t, language } = useI18n();
	const { identity } = useIdentity();
	const { coreConfig, track, setTrack, level, setLevel, legalDocuments, customFields } = useRegisterConfig();

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
		typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('invite') ?? undefined : undefined;

	const [isTrackOpen, setIsTrackOpen] = useState(false);
	const [acceptedDocuments, setAcceptedDocuments] = useState<Record<string, boolean>>({});
	const [activeLegalDocument, setActiveLegalDocument] = useState<LegalDocumentContent | null>(null);
	const [legalError, setLegalError] = useState(false);
	const [customValues, setCustomValues] = useState<Record<string, string>>({});
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	const memberIdLabel = resolveLocalizedText(
		{ en: coreConfig.memberId.labelEn, tr: coreConfig.memberId.labelTr },
		language
	);
	const memberIdPlaceholder = resolveLocalizedText(
		{ en: coreConfig.memberId.placeholderEn, tr: coreConfig.memberId.placeholderTr },
		language
	);

	const steps: Array<{ id: WizardStep; label: string }> = [
		{ id: 'account', label: t('authWizardAccount', 'Account') },
		{ id: 'community', label: t('authWizardCommunity', 'Community') },
		{ id: 'verify', label: t('authWizardVerify', 'Verify') },
	];
	const stepIndex = steps.findIndex((step) => step.id === wizardStep);
	const stepCopy = getRegisterStepCopy(t);

	const goTo = (step: WizardStep) => {
		setWizardStep(step);
		flow.setErrorMessage(null);
		setIsTrackOpen(false);
	};

	const basePayload = () => ({
		name: firstName.trim(),
		surname: lastName.trim(),
		studentNo: memberHandle.trim(),
		department: track,
		grade: level,
		email: email.trim(),
		password,
		hp_website: hpWebsite,
		customFields: customValues,
		acceptedDocumentIds: legalDocuments.filter((document) => acceptedDocuments[document.id]).map((d) => d.id),
		inviteToken,
		preferredLanguage: language,
	});

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (wizardStep === 'account') {
			const accountError = validateAccountStep({
				memberHandle,
				memberIdRequired: coreConfig.memberId.required,
				firstName,
				lastName,
				email,
				password,
				t,
			});
			if (accountError) {
				flow.setErrorMessage(accountError);
				return;
			}
			goTo('community');
			return;
		}
		if (wizardStep === 'community') {
			const validation = validateCommunityStep({
				legalDocuments,
				acceptedDocuments,
				customFields,
				customValues,
				t,
			});
			if (!validation.ok) {
				if (validation.legalError) setLegalError(true);
				if (validation.fieldErrors) setFieldErrors(validation.fieldErrors);
				flow.setErrorMessage(validation.errorMessage);
				return;
			}
			const res = await flow.submitRegister(basePayload());
			if (res?.fieldErrors) setFieldErrors(res.fieldErrors);
			if (res?.requireVerification) {
				setVerificationQueued(Boolean(res.mailQueued));
				goTo('verify');
			}
			return;
		}
		if (verificationCode.trim().length !== 6) {
			flow.setErrorMessage(t('authVerificationCodeError', 'Please enter the full 6-digit verification code.'));
			return;
		}
		await flow.submitRegister({ ...basePayload(), verificationCode: verificationCode.trim() });
	};

	return (
		<form onSubmit={handleSubmit} className={styles.wizardPanel}>
			<RegisterStepProgress
				steps={steps}
				wizardStep={wizardStep}
				stepIndex={stepIndex}
				stepsAriaLabel={t('authWizardStepsAria', 'Registration steps')}
				eyebrow={`${identity.siteName} // ${identity.studio}`}
				title={stepCopy[wizardStep].title}
				subtitle={stepCopy[wizardStep].subtitle}
				hpWebsite={hpWebsite}
				onHpChange={setHpWebsite}
			/>

			{wizardStep === 'account' && (
				<RegisterAccountStep
					firstName={firstName}
					lastName={lastName}
					email={email}
					password={password}
					memberHandle={memberHandle}
					memberIdLabel={memberIdLabel}
					memberIdPlaceholder={memberIdPlaceholder}
					memberIdRequired={coreConfig.memberId.required}
					setupIncomplete={flow.setupIncomplete}
					onFirstNameChange={setFirstName}
					onLastNameChange={setLastName}
					onEmailChange={setEmail}
					onPasswordChange={setPassword}
					onMemberHandleChange={setMemberHandle}
				/>
			)}

			{wizardStep === 'community' && (
				<RegisterCommunityStep
					coreConfig={coreConfig}
					track={track}
					level={level}
					isTrackOpen={isTrackOpen}
					customFields={customFields}
					customValues={customValues}
					fieldErrors={fieldErrors}
					legalDocuments={legalDocuments}
					acceptedDocuments={acceptedDocuments}
					legalError={legalError}
					setupIncomplete={flow.setupIncomplete}
					loading={flow.loading}
					onTrackChange={setTrack}
					onLevelChange={setLevel}
					onToggleTrackOpen={() => setIsTrackOpen((open) => !open)}
					onCloseTrack={() => setIsTrackOpen(false)}
					onCustomValueChange={(key, next) => {
						setCustomValues((prev) => ({ ...prev, [key]: next }));
						setFieldErrors((prev) => {
							if (!prev[key]) return prev;
							const copy = { ...prev };
							delete copy[key];
							return copy;
						});
					}}
					onToggleLegalDoc={(docId, checked) => {
						setAcceptedDocuments((prev) => ({ ...prev, [docId]: checked }));
						if (checked) setLegalError(false);
					}}
					onOpenLegalDoc={setActiveLegalDocument}
					onBack={() => goTo('account')}
				/>
			)}

			{wizardStep === 'verify' && (
				<RegisterVerifyStep
					email={email}
					verificationCode={verificationCode}
					verificationQueued={verificationQueued}
					loading={flow.loading}
					onCodeChange={setVerificationCode}
					onBack={() => goTo('community')}
				/>
			)}

			<LegalDocumentModal
				document={activeLegalDocument}
				onClose={() => setActiveLegalDocument(null)}
				onAccept={
					activeLegalDocument
						? () => {
								setAcceptedDocuments((prev) => ({ ...prev, [activeLegalDocument.id]: true }));
								setLegalError(false);
								setActiveLegalDocument(null);
						  }
						: undefined
				}
			/>
		</form>
	);
}
