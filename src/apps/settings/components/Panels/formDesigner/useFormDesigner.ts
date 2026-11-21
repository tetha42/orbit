'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useIsMobile } from '@/lib/client/useClientValue';
import { errorMessage } from '@/lib/errors';
import type { FormField, FormFieldOption } from '@/lib/formFields';
import { buildPresets } from './styles';
import {
	createEmptyFormField,
	deleteFormFieldApi,
	fetchFormFieldsApi,
	reorderFormFieldsApi,
	saveFormFieldApi,
	toggleFormFieldApi,
} from './formFieldActions';

export function useFormDesigner() {
	const { t, language } = useI18n();
	const dialog = useDialog();
	const isMobile = useIsMobile(900);
	const [mobileTab, setMobileTab] = useState<'fields' | 'edit' | 'preview'>('fields');
	const [fields, setFields] = useState<FormField[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [draft, setDraft] = useState<FormField | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [previewContext, setPreviewContext] = useState<'registration' | 'profile'>('registration');
	const [activeTab, setActiveTab] = useState<'basic' | 'rules' | 'options'>('basic');
	const [activeLangTab, setActiveLangTab] = useState<'tr' | 'en'>('tr');
	const [isCoreExpanded, setIsCoreExpanded] = useState(false);

	const presets = useMemo(() => buildPresets(t), [t]);

	const load = React.useCallback(async () => {
		try {
			const loaded = await fetchFormFieldsApi();
			if (loaded) setFields(loaded);
		} catch {
			// Fallback
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const selectField = (field: FormField) => {
		setActiveId(field.id);
		setDraft({ ...field, options: field.options.map((option) => ({ ...option })) });
		setStatus(null);
		setActiveTab(field.type === 'select' && activeTab === 'options' ? 'options' : 'basic');
		if (isMobile) setMobileTab('edit');
	};

	const startNew = () => {
		setActiveId(null);
		setDraft(createEmptyFormField(fields.length));
		setStatus(null);
		setActiveTab('basic');
		if (isMobile) setMobileTab('edit');
	};

	const duplicateField = (field: FormField) => {
		const newField: FormField = {
			...field,
			id: '',
			fieldKey: `${field.fieldKey}_copy`,
			labelTr: `${field.labelTr} (${t('formCopySuffixTr')})`,
			labelEn: `${field.labelEn} (${t('formCopySuffixEn')})`,
			options: field.options.map((opt) => ({ ...opt })),
			sortOrder: fields.length,
		};
		setActiveId(null);
		setDraft(newField);
		setStatus({ text: t('formDuplicate'), type: 'ok' });
		setActiveTab('basic');
		if (isMobile) setMobileTab('edit');
	};

	const updateOption = (index: number, patch: Partial<FormFieldOption>) => {
		if (!draft) return;
		setDraft({
			...draft,
			options: draft.options.map((option, optionIndex) =>
				optionIndex === index ? { ...option, ...patch } : option
			),
		});
	};

	const addOption = () => {
		if (!draft) return;
		const index = draft.options.length + 1;
		setDraft({
			...draft,
			options: [
				...draft.options,
				{ value: `option_${index}`, labelTr: t('formOptionLabelTr').replace('{n}', String(index)), labelEn: t('formOptionLabelEn').replace('{n}', String(index)) },
			],
		});
	};

	const removeOption = (index: number) => {
		if (!draft) return;
		setDraft({ ...draft, options: draft.options.filter((_, optionIndex) => optionIndex !== index) });
	};

	const applyPreset = (presetKey: string) => {
		if (!draft || !presets[presetKey]) return;
		setDraft({
			...draft,
			type: 'select',
			options: presets[presetKey].options.map((opt) => ({ ...opt })),
		});
		setActiveTab('options');
	};

	const save = async () => {
		if (!draft) return;
		setIsSaving(true);
		setStatus(null);
		try {
			const saved = await saveFormFieldApi(draft, t('formSaveFailed'));
			setFields((previous) => {
				const exists = previous.some((field) => field.id === saved.id);
				const next = exists
					? previous.map((field) => (field.id === saved.id ? saved : field))
					: [...previous, saved];
				return next.sort((a, b) => a.sortOrder - b.sortOrder);
			});
			setActiveId(saved.id);
			setDraft({ ...saved, options: saved.options.map((option) => ({ ...option })) });
			setStatus({ text: t('formSaved'), type: 'ok' });
		} catch (error) {
			setStatus({ text: errorMessage(error) || t('formSaveFailed'), type: 'err' });
		} finally {
			setIsSaving(false);
		}
	};

	const removeField = async () => {
		if (!draft?.id) return;
		const confirmed = await dialog.confirm({
			title: t('formDeleteTitle'),
			message: t('formDeleteConfirm'),
			tone: 'danger',
		});
		if (!confirmed) return;
		setIsSaving(true);
		try {
			const nextFields = await deleteFormFieldApi(draft.id, t('formDeleteFailed'));
			setFields(nextFields);
			setActiveId(null);
			setDraft(null);
			setStatus({ text: t('formDeleted'), type: 'ok' });
			if (isMobile) setMobileTab('fields');
		} catch (error) {
			setStatus({ text: errorMessage(error) || t('formDeleteFailed'), type: 'err' });
		} finally {
			setIsSaving(false);
		}
	};

	const moveField = async (fieldId: string, direction: -1 | 1) => {
		const index = fields.findIndex((field) => field.id === fieldId);
		const target = index + direction;
		if (index < 0 || target < 0 || target >= fields.length) return;
		const next = [...fields];
		const [removed] = next.splice(index, 1);
		next.splice(target, 0, removed);
		setFields(next);
		try {
			await reorderFormFieldsApi(next.map((field) => field.id));
		} catch {
			void load();
		}
	};

	const toggleFieldEnabled = async (field: FormField) => {
		const updated = { ...field, enabled: !field.enabled };
		setFields((prev) => prev.map((f) => (f.id === field.id ? updated : f)));
		if (draft?.id === field.id) setDraft(updated);
		try {
			await toggleFormFieldApi(updated);
		} catch {
			void load();
		}
	};

	const canSave = useMemo(
		() =>
			Boolean(draft) &&
			(draft!.labelTr.trim().length > 0 || draft!.labelEn.trim().length > 0) &&
			(draft!.type !== 'select' || draft!.options.length > 0),
		[draft]
	);

	const filteredFields = useMemo(() => {
		if (!searchQuery.trim()) return fields;
		const q = searchQuery.toLowerCase();
		return fields.filter(
			(f) =>
				f.labelTr.toLowerCase().includes(q) ||
				f.labelEn.toLowerCase().includes(q) ||
				f.fieldKey.toLowerCase().includes(q)
		);
	}, [fields, searchQuery]);

	const previewFields = useMemo(
		() =>
			draft
				? [...fields.filter((field) => field.id !== draft.id), { ...draft, id: draft.id || 'draft' }]
				: fields,
		[fields, draft]
	);

	return {
		t, language, isMobile, mobileTab, setMobileTab, fields, activeId, draft, setDraft,
		isLoading, isSaving, status, searchQuery, setSearchQuery, previewContext, setPreviewContext,
		activeTab, setActiveTab, activeLangTab, setActiveLangTab, isCoreExpanded, setIsCoreExpanded,
		presets, selectField, startNew, duplicateField, updateOption, addOption, removeOption,
		applyPreset, save, removeField, moveField, toggleFieldEnabled, canSave, filteredFields, previewFields,
	};
}
