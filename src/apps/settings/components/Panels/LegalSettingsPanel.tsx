'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
	AlertCircle,
	CheckCircle2,
	FileText,
	Lock,
	Plus,
	Save,
	ShieldCheck,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { errorMessage } from '@/lib/errors';
import { LEGAL_DOCUMENT_SCOPES, LEGAL_DOCUMENT_TYPES, type LegalDocumentScope, type LegalDocumentType } from '@/lib/legalDefaults';

interface LegalDocument {
	id: string;
	docType: LegalDocumentType;
	scope: LegalDocumentScope;
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
	required: boolean;
	enabled: boolean;
	sortOrder: number;
	version?: number;
	updatedAt?: number;
}

interface LegalDocumentVersion {
	id: string;
	version: number;
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
	scope: string;
	required: boolean;
	archivedAt: number;
	archivedBy: string | null;
}

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 11px',
	borderRadius: '8px',
	border: '1px solid var(--window-border)',
	background: 'rgba(0, 0, 0, 0.22)',
	color: 'inherit',
	fontSize: '12.5px',
	outline: 'none',
	boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
	display: 'block',
	fontSize: '11.5px',
	fontWeight: 600,
	opacity: 0.82,
	marginBottom: '5px',
};

const cardStyle: React.CSSProperties = {
	padding: '14px',
	borderRadius: '10px',
	border: '1px solid var(--window-border)',
	background: 'var(--card-bg, rgba(255,255,255,0.03))',
};

export function LegalSettingsPanel() {
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

	const loadVersions = async (docType: string) => {
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
	};

	useEffect(() => {
		void loadVersions(activeDocument?.docType ?? '');
		// `loadVersions` is intentionally read at the time the active document changes.
	}, [activeDocument?.docType]);

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

	const title = (document: LegalDocument) => (language === 'tr' ? document.titleTr : document.titleEn);

	if (isLoading) {
		return <div style={{ padding: 30, textAlign: 'center', opacity: 0.55 }}>{t('loading')}</div>;
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
				<div>
					<h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{t('legalTitle')}</h2>
					<p style={{ margin: '3px 0 0 0', fontSize: '12.5px', opacity: 0.65 }}>{t('legalDesc')}</p>
				</div>
				<button
					type="button"
					onClick={startNew}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						padding: '7px 12px',
						borderRadius: '8px',
						border: '1px solid var(--accent)',
						background: 'var(--accent)',
						color: '#fff',
						fontSize: '12px',
						fontWeight: 600,
						cursor: 'pointer',
					}}
				>
					<Plus size={13} />
					{t('legalAdd')}
				</button>
			</div>

			{status && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						padding: '10px 12px',
						borderRadius: '8px',
						fontSize: '12px',
						background: status.type === 'ok' ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
						color: status.type === 'ok' ? '#30d158' : '#ff453a',
						border: `1px solid ${status.type === 'ok' ? 'rgba(48,209,88,0.3)' : 'rgba(255,69,58,0.3)'}`,
					}}
				>
					{status.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
					{status.text}
				</div>
			)}

			<div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '16px', alignItems: 'start' }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
					{documents.map((document) => {
						const active = document.id === activeId;
						return (
							<button
								key={document.id}
								type="button"
								onClick={() => selectDocument(document)}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '7px',
									padding: '8px 9px',
									borderRadius: '8px',
									border: active ? '1px solid var(--accent)' : '1px solid transparent',
									background: active ? 'var(--accent-subtle, rgba(99,102,241,0.16))' : 'transparent',
									color: 'inherit',
									fontSize: '12px',
									fontWeight: active ? 600 : 500,
									textAlign: 'left',
									cursor: 'pointer',
								}}
							>
								<FileText size={13} style={{ opacity: 0.7, flexShrink: 0 }} />
								<span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
									{title(document)}
								</span>
								{!document.enabled && <Lock size={11} style={{ opacity: 0.5 }} />}
							</button>
						);
					})}
					{documents.length === 0 && <div style={{ fontSize: '11.5px', opacity: 0.6 }}>{t('legalEmpty')}</div>}
				</div>

				{draft ? (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
						<div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
							<div>
								<label style={labelStyle}>{t('legalDocType')}</label>
								<select
									style={inputStyle}
									value={draft.docType}
									disabled={Boolean(draft.id)}
									onChange={(event) =>
										setDraft({ ...draft, docType: event.target.value as LegalDocumentType })
									}
								>
									{LEGAL_DOCUMENT_TYPES.map((type) => (
										<option key={type} value={type}>
											{t(`legalType_${type}`)}
										</option>
									))}
								</select>
							</div>
							<div>
								<label style={labelStyle}>{t('legalScope')}</label>
								<select
									style={inputStyle}
									value={draft.scope}
									onChange={(event) =>
										setDraft({ ...draft, scope: event.target.value as LegalDocumentScope })
									}
								>
									{LEGAL_DOCUMENT_SCOPES.map((scope) => (
										<option key={scope} value={scope}>
											{t(`legalScope_${scope}`)}
										</option>
									))}
								</select>
							</div>
							<div>
								<label style={labelStyle}>{t('legalTitleTr')}</label>
								<input
									style={inputStyle}
									value={draft.titleTr}
									maxLength={160}
									onChange={(event) => setDraft({ ...draft, titleTr: event.target.value })}
								/>
							</div>
							<div>
								<label style={labelStyle}>{t('legalTitleEn')}</label>
								<input
									style={inputStyle}
									value={draft.titleEn}
									maxLength={160}
									onChange={(event) => setDraft({ ...draft, titleEn: event.target.value })}
								/>
							</div>
							<label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px' }}>
								<input
									type="checkbox"
									checked={draft.required}
									onChange={(event) => setDraft({ ...draft, required: event.target.checked })}
								/>
								{t('legalRequired')}
							</label>
							<label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px' }}>
								<input
									type="checkbox"
									checked={draft.enabled}
									onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
								/>
								{t('legalEnabled')}
							</label>
						</div>

						<div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
							<div>
								<label style={labelStyle}>{t('legalBodyTr')}</label>
								<textarea
									style={{ ...inputStyle, minHeight: '260px', fontFamily: 'ui-monospace, monospace', lineHeight: 1.55, resize: 'vertical' }}
									value={draft.bodyTr}
									onChange={(event) => setDraft({ ...draft, bodyTr: event.target.value })}
								/>
							</div>
							<div>
								<label style={labelStyle}>{t('legalBodyEn')}</label>
								<textarea
									style={{ ...inputStyle, minHeight: '260px', fontFamily: 'ui-monospace, monospace', lineHeight: 1.55, resize: 'vertical' }}
									value={draft.bodyEn}
									onChange={(event) => setDraft({ ...draft, bodyEn: event.target.value })}
								/>
							</div>
						</div>
						<div style={{ fontSize: '11px', opacity: 0.55, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<ShieldCheck size={12} />
							{t('legalMarkdownHint')}
						</div>

						<div style={{ borderTop: '1px solid var(--window-border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
							<div style={{ fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
								<FileText size={13} />
								{t('legalVersionHistory')}
								<span style={{ opacity: 0.55, fontWeight: 500 }}>
									{t('legalCurrentVersion')}: v{draft.version ?? 1}
								</span>
							</div>
							{versions.length === 0 ? (
								<div style={{ fontSize: '11.5px', opacity: 0.55 }}>{t('legalNoVersions')}</div>
							) : (
								versions.map((version) => (
									<details key={version.id} style={{ fontSize: '11.5px' }}>
										<summary style={{ cursor: 'pointer', opacity: 0.8 }}>
											v{version.version} · {language === 'tr' ? version.titleTr : version.titleEn} ·{' '}
											{new Date(version.archivedAt).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}
										</summary>
										<pre
											style={{
												whiteSpace: 'pre-wrap',
												fontFamily: 'ui-monospace, monospace',
												fontSize: '11px',
												lineHeight: 1.5,
												maxHeight: '180px',
												overflowY: 'auto',
												padding: '8px',
												borderRadius: '6px',
												background: 'rgba(0,0,0,0.18)',
												marginTop: '5px',
											}}
										>
											{language === 'tr' ? version.bodyTr : version.bodyEn}
										</pre>
									</details>
								))
							)}
						</div>

						<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
							<button
								type="button"
								onClick={() => activeDocument && selectDocument(activeDocument)}
								disabled={isSaving}
								style={{
									padding: '8px 14px',
									borderRadius: '8px',
									border: '1px solid var(--window-border)',
									background: 'transparent',
									color: 'inherit',
									fontSize: '12px',
									fontWeight: 600,
									cursor: 'pointer',
								}}
							>
								{t('cancel')}
							</button>
							<button
								type="button"
								onClick={() => void save()}
								disabled={isSaving}
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '6px',
									padding: '8px 16px',
									borderRadius: '8px',
									border: 'none',
									background: 'var(--accent)',
									color: '#fff',
									fontSize: '12px',
									fontWeight: 600,
									cursor: isSaving ? 'wait' : 'pointer',
									opacity: isSaving ? 0.7 : 1,
								}}
							>
								<Save size={13} />
								{isSaving ? t('saving') : t('legalSave')}
							</button>
						</div>
					</div>
				) : (
					<div style={{ ...cardStyle, fontSize: '12.5px', opacity: 0.6 }}>{t('legalSelectPrompt')}</div>
				)}
			</div>
		</div>
	);
}
