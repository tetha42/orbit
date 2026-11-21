import { fieldAppliesTo, fieldRequiredFor, type FormField } from '@/lib/formFields';
import type { LegalDocumentContent } from '../LegalDocumentModal';
import type { WizardStep } from './useRegisterConfig';

type TranslateFn = (key: string, fallback?: string) => string;

export function getRegisterStepCopy(t: TranslateFn): Record<WizardStep, { title: string; subtitle: string }> {
	return {
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
}

export function validateAccountStep(params: {
	memberHandle: string;
	memberIdRequired: boolean;
	firstName: string;
	lastName: string;
	email: string;
	password: string;
	t: TranslateFn;
}): string | null {
	const cleanHandle = params.memberHandle.trim();
	if (params.memberIdRequired && !cleanHandle) {
		return params.t('authMemberIdRequired', 'Please enter a member ID / handle.');
	}
	if (cleanHandle && !/^[a-zA-Z0-9_-]{3,32}$/.test(cleanHandle)) {
		return params.t(
			'authMemberIdError',
			'Member ID / Handle must be 3–32 characters using letters, numbers, hyphens (-), or underscores (_).'
		);
	}
	if (!params.firstName.trim() || !params.lastName.trim() || !params.email.trim() || !params.password) {
		return params.t('authFillRequired', 'Please fill in all required fields.');
	}
	return null;
}

export function validateCommunityStep(params: {
	legalDocuments: LegalDocumentContent[];
	acceptedDocuments: Record<string, boolean>;
	customFields: FormField[];
	customValues: Record<string, string>;
	t: TranslateFn;
}): { ok: true } | { ok: false; legalError?: boolean; fieldErrors?: Record<string, string>; errorMessage: string } {
	const missingLegal = params.legalDocuments.filter(
		(document) => document.required && !params.acceptedDocuments[document.id]
	);
	if (missingLegal.length > 0) {
		return {
			ok: false,
			legalError: true,
			errorMessage: params.t('authLegalError', 'Please accept all required agreements to continue.'),
		};
	}

	const missingCustom = params.customFields.filter(
		(field) =>
			fieldAppliesTo(field, 'registration') &&
			fieldRequiredFor(field, 'registration') &&
			!params.customValues[field.fieldKey]?.trim()
	);
	if (missingCustom.length > 0) {
		return {
			ok: false,
			fieldErrors: Object.fromEntries(
				missingCustom.map((field) => [field.fieldKey, params.t('authRequiredField', 'This field is required.')])
			),
			errorMessage: params.t('authFormFieldsError', 'Please complete the highlighted fields.'),
		};
	}

	return { ok: true };
}
