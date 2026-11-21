import { invalidateResource } from '@/core/data/useJsonResource';
import type { FormField } from '@/lib/formFields';
import { normalizeFieldKey } from '@/lib/formFields';

export async function fetchFormFieldsApi(): Promise<FormField[] | null> {
	const res = await fetch('/api/settings/form-fields', { cache: 'no-store' });
	const data = await res.json();
	return res.ok && data.ok ? (data.fields ?? []) : null;
}

export async function saveFormFieldApi(draft: FormField, fallbackErr: string): Promise<FormField> {
	const payload = {
		...draft,
		fieldKey: draft.fieldKey || normalizeFieldKey(draft.labelEn || draft.labelTr, 'field'),
	};
	const res = await fetch('/api/settings/form-fields', {
		method: draft.id ? 'PATCH' : 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const data = await res.json();
	if (!res.ok || !data.ok) throw new Error(data.error || fallbackErr);
	invalidateResource('/api/form-fields');
	return data.field as FormField;
}

export async function deleteFormFieldApi(id: string, fallbackErr: string): Promise<FormField[]> {
	const res = await fetch(`/api/settings/form-fields?id=${encodeURIComponent(id)}`, {
		method: 'DELETE',
	});
	const data = await res.json();
	if (!res.ok || !data.ok) throw new Error(data.error || fallbackErr);
	invalidateResource('/api/form-fields');
	return data.fields ?? [];
}

export async function reorderFormFieldsApi(order: string[]): Promise<void> {
	await fetch('/api/settings/form-fields', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ order }),
	});
	invalidateResource('/api/form-fields');
}

export function createEmptyFormField(sortOrder: number): FormField {
	return {
		id: '',
		scope: 'registration',
		collectAt: 'registration',
		requiredAt: 'none',
		directoryVisibility: 'members',
		selfEditable: false,
		adminEditable: true,
		fieldKey: '',
		type: 'text',
		section: 'custom',
		labelTr: '',
		labelEn: '',
		placeholderTr: '',
		placeholderEn: '',
		options: [],
		required: false,
		enabled: true,
		sortOrder,
		archivedAt: null,
	};
}

export async function toggleFormFieldApi(updated: FormField): Promise<void> {
	await fetch('/api/settings/form-fields', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(updated),
	});
	invalidateResource('/api/form-fields');
}
