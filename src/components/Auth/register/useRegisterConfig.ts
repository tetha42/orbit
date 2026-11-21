'use client';

import { useEffect, useState } from 'react';
import type { LegalDocumentContent } from '../LegalDocumentModal';
import { DEFAULT_LEGAL_DOCUMENTS } from '@/lib/i18n/data/legalDefaults';
import type { FormField } from '@/lib/formFields';
import {
	DEFAULT_REGISTRATION_CORE_CONFIG,
	defaultLevelValue,
	defaultTrackValue,
	normalizeRegistrationCoreConfig,
	type RegistrationCoreConfig,
} from '@/lib/i18n/data/registrationConfig';

export type WizardStep = 'account' | 'community' | 'verify';

const FALLBACK_LEGAL_DOCUMENTS: LegalDocumentContent[] = DEFAULT_LEGAL_DOCUMENTS.map((document) => ({
	id: `legal_${document.docType}`,
	docType: document.docType,
	titleTr: document.titleTr,
	titleEn: document.titleEn,
	bodyTr: document.bodyTr,
	bodyEn: document.bodyEn,
	required: document.required,
}));

export function useRegisterConfig() {
	const [coreConfig, setCoreConfig] = useState<RegistrationCoreConfig>(DEFAULT_REGISTRATION_CORE_CONFIG);
	const [track, setTrack] = useState(defaultTrackValue(DEFAULT_REGISTRATION_CORE_CONFIG));
	const [level, setLevel] = useState(defaultLevelValue(DEFAULT_REGISTRATION_CORE_CONFIG));
	const [legalDocuments, setLegalDocuments] = useState<LegalDocumentContent[]>(FALLBACK_LEGAL_DOCUMENTS);
	const [customFields, setCustomFields] = useState<FormField[]>([]);

	useEffect(() => {
		let cancelled = false;
		Promise.all([
			fetch('/api/legal?scope=registration', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
			fetch('/api/form-fields?scope=registration', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
			fetch('/api/registration-config', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
		])
			.then(([legalData, formData, coreData]) => {
				if (cancelled) return;
				if (Array.isArray(legalData?.documents)) {
					setLegalDocuments(legalData.documents);
				}
				if (Array.isArray(formData?.fields)) setCustomFields(formData.fields);
				if (coreData?.config) {
					const next = normalizeRegistrationCoreConfig(coreData.config);
					setCoreConfig(next);
					setTrack((previous) =>
						next.track.options.some((option) => option.value === previous) ? previous : defaultTrackValue(next)
					);
					setLevel((previous) =>
						next.level.options.some((option) => Number(option.value) === previous) ? previous : defaultLevelValue(next)
					);
				}
			})
			.catch(() => {});

		return () => {
			cancelled = true;
		};
	}, []);

	return {
		coreConfig,
		track,
		setTrack,
		level,
		setLevel,
		legalDocuments,
		customFields,
	};
}
