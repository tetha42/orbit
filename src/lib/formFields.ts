/**
 * The global member-form schema.
 *
 * Core identity fields (name, e-mail, password, member handle, track, level)
 * stay fixed because authentication depends on them. Everything here is a
 * *custom* field a community can add to registration, the member directory, or
 * both. The same definitions drive the register form, the “Add Member” sheet,
 * and the member detail view, so a field is never defined twice.
 */

export type FormFieldType =
	| 'text'
	| 'password'
	| 'email'
	| 'tel'
	| 'number'
	| 'date'
	| 'textarea'
	| 'select';

export type FormFieldScope = 'registration' | 'member' | 'both';
export type FormFieldCollectAt = 'registration' | 'admin' | 'both';
export type FormFieldRequiredAt = 'none' | 'registration' | 'admin' | 'both';
export type FormFieldDirectoryVisibility = 'hidden' | 'members' | 'managers';

export interface FormFieldOption {
	value: string;
	labelTr: string;
	labelEn: string;
}

export interface FormField {
	id: string;
	/** Legacy placement. Kept in sync with `collectAt` for older clients. */
	scope: FormFieldScope;
	/** Where the field is collected. `admin` means the member-management form. */
	collectAt: FormFieldCollectAt;
	/** Where a value is mandatory. */
	requiredAt: FormFieldRequiredAt;
	/** Who may see the value in the member directory. */
	directoryVisibility: FormFieldDirectoryVisibility;
	/** May the member edit this value from their own account? */
	selfEditable: boolean;
	/** May a member manager edit this value? */
	adminEditable: boolean;
	fieldKey: string;
	type: FormFieldType;
	section: string;
	labelTr: string;
	labelEn: string;
	placeholderTr: string;
	placeholderEn: string;
	options: FormFieldOption[];
	/** Legacy mirror of `requiredAt !== 'none'`. */
	required: boolean;
	enabled: boolean;
	sortOrder: number;
	archivedAt: number | null;
}

export type FormFieldValueMap = Record<string, string>;

export const FORM_FIELD_TYPES: readonly FormFieldType[] = [
	'text',
	'password',
	'email',
	'tel',
	'number',
	'date',
	'textarea',
	'select',
];

export const FORM_FIELD_SCOPES: readonly FormFieldScope[] = ['registration', 'member', 'both'];
export const FORM_FIELD_COLLECT_AT: readonly FormFieldCollectAt[] = ['registration', 'admin', 'both'];
export const FORM_FIELD_REQUIRED_AT: readonly FormFieldRequiredAt[] = ['none', 'registration', 'admin', 'both'];
export const FORM_FIELD_DIRECTORY_VISIBILITY: readonly FormFieldDirectoryVisibility[] = ['hidden', 'members', 'managers'];

export const MAX_FORM_FIELDS = 40;
export const MAX_FIELD_OPTIONS = 30;

export function isFormFieldType(value: unknown): value is FormFieldType {
	return typeof value === 'string' && (FORM_FIELD_TYPES as readonly string[]).includes(value);
}

export function isFormFieldScope(value: unknown): value is FormFieldScope {
	return typeof value === 'string' && (FORM_FIELD_SCOPES as readonly string[]).includes(value);
}

export function isFormFieldCollectAt(value: unknown): value is FormFieldCollectAt {
	return typeof value === 'string' && (FORM_FIELD_COLLECT_AT as readonly string[]).includes(value);
}

export function isFormFieldRequiredAt(value: unknown): value is FormFieldRequiredAt {
	return typeof value === 'string' && (FORM_FIELD_REQUIRED_AT as readonly string[]).includes(value);
}

export function isFormFieldDirectoryVisibility(value: unknown): value is FormFieldDirectoryVisibility {
	return typeof value === 'string' && (FORM_FIELD_DIRECTORY_VISIBILITY as readonly string[]).includes(value);
}

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

export function fieldLabel(field: FormField, language: 'tr' | 'en'): string {
	return language === 'tr' ? field.labelTr || field.labelEn : field.labelEn || field.labelTr;
}

export function fieldPlaceholder(field: FormField, language: 'tr' | 'en'): string {
	return language === 'tr'
		? field.placeholderTr || field.placeholderEn
		: field.placeholderEn || field.placeholderTr;
}

export function optionLabel(option: FormFieldOption, language: 'tr' | 'en'): string {
	return language === 'tr' ? option.labelTr || option.labelEn : option.labelEn || option.labelTr;
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
	const labelTr = String(raw.labelTr ?? '').trim().slice(0, 120);
	const labelEn = String(raw.labelEn ?? '').trim().slice(0, 120);
	if (!labelTr || !labelEn) return { ok: false, error: 'Both Turkish and English labels are required.' };

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
	const legacyScope: FormFieldScope =
		collectAt === 'admin' ? 'member' : collectAt;
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
 *
 * Unknown keys are dropped: a client cannot smuggle values for fields the
 * community no longer offers (or never offered), and disabled fields are
 * ignored entirely. `member` means the member-management form (`admin`).
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
 * originally collected. Only `adminEditable` fields are accepted, and a field is
 * mandatory here only when its `requiredAt` includes the admin context.
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
 * Member self-service form: only fields the community marked `selfEditable`.
 * Registration-required fields stay mandatory here as well, so a member cannot
 * erase a value the application required.
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
