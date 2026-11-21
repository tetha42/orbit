'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveLocalizedText, useI18n } from '@/core/i18n';
import { errorMessage } from '@/lib/errors';
import { LEGAL_DOCUMENT_TYPES } from '@/lib/i18n/data/legalDefaults';
import type { LegalDocument, LegalDocumentVersion } from './types';

export function useLegalSettings() {
	const { t, language } = useI18n();
	const [documents, setDocuments] = useState<LegalDocument[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [draft, setDraft] = useState<LegalDocument | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
	const [versions, setVersions] = useState<LegalDocumentVersion[]>([]);

	useEffect(() => {
		let cancelled = false;
		fetch('/api/settings/legal', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (cancelled || !data?.documents) return;
				setDocuments(data.documents);
				const first = data.documents[0] as LegalDocument | undefined;
				if (first) {
					setActiveId(first.id);
					setDraft(first);
				}
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const activeDocument = useMemo(
		() => documents.find((document) => document.id === activeId) ?? null,
		[documents, activeId]
	);

	const loadVersions = useCallback(async (docType: string) => {
		if (!docType) {
			setVersions([]);
			return;
		}
		try {
			const res = await fetch(`/api/settings/legal/versions?docType=${encodeURIComponent(docType)}`, {
				cache: 'no-store',
			});
			const data = res.ok ? await res.json() : null;
			setVersions(Array.isArray(data?.versions) ? data.versions : []);
		} catch {
			setVersions([]);
		}
	}, []);

	useEffect(() => {
		void loadVersions(activeDocument?.docType ?? '');
	}, [activeDocument?.docType, loadVersions]);

	const selectDocument = (document: LegalDocument) => {
		setActiveId(document.id);
		setDraft({ ...document });
		setStatus(null);
	};

	const startNew = () => {
		const nextType = LEGAL_DOCUMENT_TYPES.find(
			(type) => !documents.some((document) => document.docType === type)
		);
		if (!nextType) {
			setStatus({ text: t('legalAllTypesUsed'), type: 'err' });
			return;
		}
		const blank: LegalDocument = {
			id: '',
			docType: nextType,
			scope: 'registration',
			titleTr: '',
			titleEn: '',
			bodyTr: '',
			bodyEn: '',
			required: false,
			enabled: true,
			sortOrder: documents.length,
		};
		setActiveId(null);
		setDraft(blank);
		setStatus(null);
	};

	const save = async () => {
		if (!draft) return;
		setIsSaving(true);
		setStatus(null);
		try {
			const res = await fetch('/api/settings/legal', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(draft),
			});
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('legalSaveFailed'));
			const saved = data.document as LegalDocument;
			setDocuments((previous) => {
				const exists = previous.some((document) => document.docType === saved.docType);
				const next = exists
					? previous.map((document) => (document.docType === saved.docType ? saved : document))
					: [...previous, saved];
				return next.sort((a, b) => a.sortOrder - b.sortOrder);
			});
			setActiveId(saved.id);
			setDraft(saved);
			void loadVersions(saved.docType);
			setStatus({ text: t('legalSaved'), type: 'ok' });
		} catch (error) {
			setStatus({ text: errorMessage(error) || t('legalSaveFailed'), type: 'err' });
		} finally {
			setIsSaving(false);
		}
	};

	const title = (document: { titleTr: string; titleEn: string }) =>
		resolveLocalizedText(
			{ en: document.titleEn, tr: document.titleTr },
			language,
			document.titleEn || document.titleTr
		);
	const body = (document: { bodyTr: string; bodyEn: string }) =>
		resolveLocalizedText(
			{ en: document.bodyEn, tr: document.bodyTr },
			language,
			document.bodyEn || document.bodyTr
		);

	return {
		documents,
		activeId,
		draft,
		setDraft,
		isLoading,
		isSaving,
		status,
		versions,
		activeDocument,
		selectDocument,
		startNew,
		save,
		title,
		body,
	};
}
