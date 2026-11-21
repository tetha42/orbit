import { resolveLocalizedText } from '../../locales/registry.ts';
import {
	type FormField,
	type FormFieldCollectAt,
	type FormFieldDirectoryVisibility,
	type FormFieldOption,
	type FormFieldRequiredAt,
	type FormFieldScope,
	type FormFieldType,
	isFormFieldCollectAt,
	isFormFieldDirectoryVisibility,
	isFormFieldRequiredAt,
	isFormFieldScope,
	isFormFieldType,
	MAX_FIELD_OPTIONS,
} from './types.ts';

/** Maps the legacy `scope` to the new collection point. */
export function collectAtOf(field: Pick<FormField, 'scope' | 'collectAt'>): FormFieldCollectAt {
	return field.collectAt ?? (field.scope === 'member' ? 'admin' : field.scope);
}

/** Maps the legacy `scope` to the new required-at value. */
export function requiredAtOf(field: Pick<FormField, 'scope' | 'required' | 'requiredAt'>): FormFieldRequiredAt {
	if (field.requiredAt) return field.requiredAt;
	if (!field.required) return 'none';
	return field.scope === 'member' ? 'admin' : field.scope;
}

/** Stable identifier used as the key of a stored value; never the visible label. */
export function normalizeFieldKey(raw: unknown, fallback = 'field'): string {
	const input = String(raw ?? '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, '_')
		.replace(/^_+|_+$/g, '');
	const key = input || fallback;
	return key.slice(0, 48);
}

/** Shown in a form when the field is enabled and its collection point includes it. */
export function fieldAppliesTo(field: FormField, scope: 'registration' | 'member'): boolean {
	const target: FormFieldCollectAt = scope === 'member' ? 'admin' : 'registration';
	const collectAt = collectAtOf(field);
	return field.enabled && (collectAt === target || collectAt === 'both');
}

/** Whether the field must be filled for the given form. */
export function fieldRequiredFor(field: FormField, scope: 'registration' | 'member'): boolean {
	const target: FormFieldRequiredAt = scope === 'member' ? 'admin' : 'registration';
	const requiredAt = requiredAtOf(field);
	return requiredAt === target || requiredAt === 'both';
}

/** Whether the field must be filled in the member's own account form. */
export function fieldRequiredForSelf(field: FormField): boolean {
	const requiredAt = requiredAtOf(field);
	return requiredAt === 'registration' || requiredAt === 'both';
}

/** Whether the value appears in the member directory. */
export function fieldInDirectory(field: Pick<FormField, 'enabled' | 'directoryVisibility'>): boolean {
	return field.enabled && field.directoryVisibility === 'members';
}

export function fieldLabel(field: FormField, language: string): string {
	return resolveLocalizedText(
		{ en: field.labelEn, tr: field.labelTr },
		language,
		field.labelEn || field.labelTr
	);
}

export function fieldPlaceholder(field: FormField, language: string): string {
	return resolveLocalizedText(
		{ en: field.placeholderEn, tr: field.placeholderTr },
		language,
		field.placeholderEn || field.placeholderTr
	);
}

export function optionLabel(option: FormFieldOption, language: string): string {
	return resolveLocalizedText(
		{ en: option.labelEn, tr: option.labelTr },
		language,
		option.labelEn || option.labelTr
	);
}

function normalizeOptions(raw: unknown): FormFieldOption[] {
	const list = Array.isArray(raw) ? raw : [];
	const seen = new Set<string>();
	const options: FormFieldOption[] = [];
	for (const item of list.slice(0, MAX_FIELD_OPTIONS)) {
		if (!item || typeof item !== 'object') continue;
		const record = item as Record<string, unknown>;
		const value = String(record.value ?? '').trim().slice(0, 80);
		if (!value || seen.has(value)) continue;
		seen.add(value);
		options.push({
			value,
			labelTr: String(record.labelTr ?? record.label_tr ?? value).trim().slice(0, 120),
			labelEn: String(record.labelEn ?? record.label_en ?? value).trim().slice(0, 120),
		});
	}
	return options;
}

export interface NormalizedFormFieldInput {
	scope: FormFieldScope;
	collectAt: FormFieldCollectAt;
	requiredAt: FormFieldRequiredAt;
	directoryVisibility: FormFieldDirectoryVisibility;
	selfEditable: boolean;
	adminEditable: boolean;
	fieldKey: string;
	type: FormFieldType;
	section: string;
	labelTr: string;
	labelEn: string;
	placeholderTr: string;
	placeholderEn: string;
	options: FormFieldOption[];
	required: boolean;
	enabled: boolean;
	sortOrder: number;
}

function bool(raw: unknown, fallback: boolean): boolean {
	if (raw === undefined) return fallback;
	return raw === true || raw === 1 || raw === '1';
}

/** Validates and normalises a create/update body from the settings panel. */
export function normalizeFormFieldInput(
	raw: Record<string, unknown>,
	index = 0
): { ok: true; value: NormalizedFormFieldInput } | { ok: false; error: string } {
	const type: FormFieldType = isFormFieldType(raw.type) ? raw.type : 'text';
	const scope: FormFieldScope = isFormFieldScope(raw.scope) ? raw.scope : 'registration';
	const labelEn = String(raw.labelEn ?? '').trim().slice(0, 120);
	const labelTr = String(raw.labelTr ?? '').trim().slice(0, 120) || labelEn;
	if (!labelEn) return { ok: false, error: 'English label is required.' };

	const fieldKey = normalizeFieldKey(raw.fieldKey ?? labelEn, 'field');
	const options = normalizeOptions(raw.options);
	if (type === 'select' && options.length === 0) {
		return { ok: false, error: 'A selection field needs at least one option.' };
	}

	const collectAt: FormFieldCollectAt = isFormFieldCollectAt(raw.collectAt)
		? raw.collectAt
		: scope === 'member'
			? 'admin'
			: scope;
	const legacyScope: FormFieldScope = collectAt === 'admin' ? 'member' : collectAt;
	const requiredAt: FormFieldRequiredAt = isFormFieldRequiredAt(raw.requiredAt)
		? raw.requiredAt
		: raw.required === true || raw.required === 1 || raw.required === '1'
			? collectAt === 'both'
				? 'both'
				: collectAt
			: 'none';
	const directoryVisibility: FormFieldDirectoryVisibility = isFormFieldDirectoryVisibility(
		raw.directoryVisibility
	)
		? raw.directoryVisibility
		: collectAt === 'registration'
			? 'hidden'
			: 'members';

	return {
		ok: true,
		value: {
			scope: legacyScope,
			collectAt,
			requiredAt,
			directoryVisibility,
			selfEditable: bool(raw.selfEditable, collectAt === 'both'),
			adminEditable: bool(raw.adminEditable, true),
			fieldKey,
			type,
			section: String(raw.section ?? 'custom').trim().slice(0, 40) || 'custom',
			labelTr,
			labelEn,
			placeholderTr: String(raw.placeholderTr ?? '').trim().slice(0, 160),
			placeholderEn: String(raw.placeholderEn ?? '').trim().slice(0, 160),
			options,
			required: requiredAt !== 'none',
			enabled: bool(raw.enabled, true),
			sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : index,
		},
	};
}
