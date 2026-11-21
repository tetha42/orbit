'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { invalidateResource } from '@/core/data/useJsonResource';
import { errorMessage } from '@/lib/errors';
import type {
	RegistrationCoreConfig,
	RegistrationCoreFieldKey,
	RegistrationCoreTextField,
} from '@/lib/i18n/data/registrationConfig';
import { DEFAULT_REGISTRATION_CORE_CONFIG } from '@/lib/i18n/data/registrationConfig';
import type { FormFieldOption } from '@/lib/formFields';
import { copyCoreConfig } from './styles';

export function useRegistrationCore() {
	const { t } = useI18n();
	const [draft, setDraft] = useState<RegistrationCoreConfig>(DEFAULT_REGISTRATION_CORE_CONFIG);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch('/api/settings/registration-fields', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (cancelled || !data?.config) return;
				setDraft(copyCoreConfig(data.config));
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const updateField = <K extends RegistrationCoreFieldKey>(
		key: K,
		patch: Partial<RegistrationCoreConfig[K]>
	) => {
		setDraft((previous) => ({
			...previous,
			[key]: { ...previous[key], ...patch },
		}));
	};

	const updateMemberId = (patch: Partial<RegistrationCoreTextField>) => {
		setDraft((previous) => ({
			...previous,
			memberId: { ...previous.memberId, ...patch },
		}));
	};

	const updateOption = (
		key: RegistrationCoreFieldKey,
		index: number,
		patch: Partial<FormFieldOption>
	) => {
		setDraft((previous) => ({
			...previous,
			[key]: {
				...previous[key],
				options: previous[key].options.map((option, optionIndex) =>
					optionIndex === index ? { ...option, ...patch } : option
				),
			},
		}));
	};

	const addOption = (key: RegistrationCoreFieldKey) => {
		setDraft((previous) => {
			const field = previous[key];
			const nextIndex = field.options.length + 1;
			const nextLevel =
				key === 'level'
					? Math.max(0, ...field.options.map((option) => Number(option.value) || 0)) + 1
					: nextIndex;
			const option: FormFieldOption =
				key === 'level'
					? {
							value: String(nextLevel),
							labelTr: t('regCoreLevelLabelTr').replace('{n}', String(nextLevel)),
							labelEn: t('regCoreLevelLabelEn').replace('{n}', String(nextLevel)),
						}
					: {
							value: `track_${nextIndex}`,
							labelTr: t('regCoreTrackLabelTr').replace('{n}', String(nextIndex)),
							labelEn: t('regCoreTrackLabelEn').replace('{n}', String(nextIndex)),
						};
			return {
				...previous,
				[key]: { ...field, options: [...field.options, option] },
			};
		});
	};

	const removeOption = (key: RegistrationCoreFieldKey, index: number) => {
		setDraft((previous) => ({
			...previous,
			[key]: {
				...previous[key],
				options: previous[key].options.filter((_, optionIndex) => optionIndex !== index),
			},
		}));
	};

	const save = async () => {
		setIsSaving(true);
		setStatus(null);
		try {
			const res = await fetch('/api/settings/registration-fields', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(draft),
			});
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('regCoreSaveFailed'));
			setDraft(copyCoreConfig(data.config));
			setStatus({ text: t('regCoreSaved'), type: 'ok' });
			invalidateResource('/api/registration-config');
		} catch (error) {
			setStatus({ text: errorMessage(error) || t('regCoreSaveFailed'), type: 'err' });
		} finally {
			setIsSaving(false);
		}
	};

	return {
		draft,
		isLoading,
		isSaving,
		status,
		updateField,
		updateMemberId,
		updateOption,
		addOption,
		removeOption,
		save,
	};
}
