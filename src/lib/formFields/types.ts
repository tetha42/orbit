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
