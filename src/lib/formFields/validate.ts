import type { FormField, FormFieldValueMap } from './types.ts';
import { fieldAppliesTo, fieldRequiredFor, fieldRequiredForSelf } from './normalize.ts';

export interface FormValidationResult {
	ok: boolean;
	errors: Record<string, string>;
	clean: FormFieldValueMap;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateValues(
	fields: readonly FormField[],
	values: unknown,
	include: (field: FormField) => boolean,
	mustFill: (field: FormField) => boolean
): FormValidationResult {
	const input = values && typeof values === 'object' ? (values as Record<string, unknown>) : {};
	const errors: Record<string, string> = {};
	const clean: FormFieldValueMap = {};

	for (const field of fields) {
		if (!include(field)) continue;
		const raw = input[field.fieldKey];
		const value = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';

		if (!value) {
			if (mustFill(field)) errors[field.fieldKey] = `${field.labelEn} is required.`;
			continue;
		}
		if (value.length > (field.type === 'textarea' ? 5000 : 500)) {
			errors[field.fieldKey] = `${field.labelEn} is too long.`;
			continue;
		}

		if (field.type === 'email' && !EMAIL_RE.test(value)) {
			errors[field.fieldKey] = `${field.labelEn} must be a valid e-mail address.`;
			continue;
		}
		if (field.type === 'password' && value.length < 8) {
			errors[field.fieldKey] = `${field.labelEn} must be at least 8 characters.`;
			continue;
		}
		if (field.type === 'number' && !Number.isFinite(Number(value))) {
			errors[field.fieldKey] = `${field.labelEn} must be a number.`;
			continue;
		}
		if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			errors[field.fieldKey] = `${field.labelEn} must be a valid date.`;
			continue;
		}
		if (field.type === 'select' && !field.options.some((option) => option.value === value)) {
			errors[field.fieldKey] = `${field.labelEn} has an invalid selection.`;
			continue;
		}

		clean[field.fieldKey] = value;
	}

	return { ok: Object.keys(errors).length === 0, errors, clean };
}

/**
 * Validates submitted custom values against their field definitions.
 * Unknown keys are dropped and disabled fields are ignored entirely.
 */
export function validateFormValues(
	fields: readonly FormField[],
	values: unknown,
	scope: 'registration' | 'member'
): FormValidationResult {
	return validateValues(
		fields,
		values,
		(field) => fieldAppliesTo(field, scope),
		(field) => fieldRequiredFor(field, scope)
	);
}

/**
 * Admin edit form: every field the manager may edit, regardless of where it was
 * originally collected.
 */
export function validateAdminEditValues(
	fields: readonly FormField[],
	values: unknown
): FormValidationResult {
	return validateValues(
		fields,
		values,
		(field) => field.enabled && field.adminEditable,
		(field) => fieldRequiredFor(field, 'member')
	);
}

/**
 * Member self-service form: only fields marked `selfEditable`.
 * Registration-required fields stay mandatory here as well.
 */
export function validateSelfEditValues(
	fields: readonly FormField[],
	values: unknown
): FormValidationResult {
	return validateValues(
		fields,
		values,
		(field) => field.enabled && field.selfEditable,
		(field) => fieldRequiredForSelf(field)
	);
}
