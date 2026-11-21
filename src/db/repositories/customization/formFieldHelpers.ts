import {
	type FormField,
	type FormFieldOption,
	type FormFieldScope,
	type FormFieldType,
} from '@/lib/formFields';

export interface FormFieldRow {
	id: string;
	scope: string;
	collectAt: string;
	requiredAt: string;
	directoryVisibility: string;
	selfEditable: number;
	adminEditable: number;
	fieldKey: string;
	type: string;
	translations?: unknown;
	options: string;
	required: number;
	enabled: number;
	sortOrder: number;
	archivedAt: number | null;
}

export interface FormFieldTranslations {
	tr?: { label?: string; placeholder?: string };
	en?: { label?: string; placeholder?: string };
	section?: string;
	labelTr?: string;
	labelEn?: string;
	placeholderTr?: string;
	placeholderEn?: string;
}

export function parseFieldTranslations(raw: unknown): {
	section: string;
	labelTr: string;
	labelEn: string;
	placeholderTr: string;
	placeholderEn: string;
} {
	let obj: FormFieldTranslations = {};
	if (typeof raw === 'string') {
		try {
			obj = JSON.parse(raw) as FormFieldTranslations;
		} catch {
			obj = {};
		}
	} else if (raw && typeof raw === 'object') {
		obj = raw as FormFieldTranslations;
	}
	return {
		section: String(obj.section ?? 'custom'),
		labelTr: String(obj.tr?.label ?? obj.labelTr ?? ''),
		labelEn: String(obj.en?.label ?? obj.labelEn ?? ''),
		placeholderTr: String(obj.tr?.placeholder ?? obj.placeholderTr ?? ''),
		placeholderEn: String(obj.en?.placeholder ?? obj.placeholderEn ?? ''),
	};
}

export function serializeFieldTranslations(input: {
	section: string;
	labelTr: string;
	labelEn: string;
	placeholderTr: string;
	placeholderEn: string;
}): string {
	return JSON.stringify({
		section: input.section || 'custom',
		tr: { label: input.labelTr, placeholder: input.placeholderTr },
		en: { label: input.labelEn, placeholder: input.placeholderEn },
	});
}

export function parseOptions(raw: string): FormFieldOption[] {
	try {
		const parsed = JSON.parse(raw || '[]');
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export function toFormField(row: FormFieldRow): FormField {
	const t = parseFieldTranslations(row.translations);
	return {
		id: row.id,
		scope: row.scope as FormFieldScope,
		collectAt: row.collectAt as FormField['collectAt'],
		requiredAt: row.requiredAt as FormField['requiredAt'],
		directoryVisibility: row.directoryVisibility as FormField['directoryVisibility'],
		selfEditable: Number(row.selfEditable) === 1,
		adminEditable: Number(row.adminEditable) === 1,
		fieldKey: row.fieldKey,
		type: row.type as FormFieldType,
		section: t.section,
		labelTr: t.labelTr,
		labelEn: t.labelEn,
		placeholderTr: t.placeholderTr,
		placeholderEn: t.placeholderEn,
		options: parseOptions(row.options),
		required: Number(row.required) === 1,
		enabled: Number(row.enabled) === 1,
		sortOrder: Number(row.sortOrder) || 0,
		archivedAt: row.archivedAt ? Number(row.archivedAt) : null,
	};
}
