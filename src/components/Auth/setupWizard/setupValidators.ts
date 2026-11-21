import type { WizardStep } from './setupTypes';

export interface SetupValidationInput {
	dbConnected: boolean;
	dbUrl: string;
	studioName: string;
	communityName: string;
	domain: string;
	name: string;
	surname: string;
	email: string;
	password: string;
	passwordConfirm: string;
}

export function validateWizardStep(step: WizardStep, input: SetupValidationInput): string | null {
	if (step === 1) {
		if (!input.dbConnected && !input.dbUrl.trim()) {
			return 'Please provide a valid database connection before continuing.';
		}
		return null;
	}
	if (step === 2) {
		if (!input.studioName.trim() || !input.communityName.trim() || !input.domain.trim()) {
			return 'Please complete all studio and community identity fields.';
		}
		return null;
	}
	if (step === 3) {
		if (!input.name.trim() || !input.surname.trim()) {
			return 'Administrator first name and last name are required.';
		}
		if (!input.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
			return 'Please enter a valid administrator email address.';
		}
		if (input.password.length < 12) {
			return 'Administrator password must be at least 12 characters.';
		}
		if (input.password !== input.passwordConfirm) {
			return 'Passwords do not match.';
		}
	}
	return null;
}
