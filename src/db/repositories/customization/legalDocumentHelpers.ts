import { createHash } from 'crypto';
import {
	type LegalDocumentScope,
	type LegalDocumentType,
} from '@/lib/i18n/data/legalDefaults';

export interface LegalDocument {
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
	version: number;
	updatedAt: number;
	updatedBy: string | null;
}

export interface LegalDocumentTranslations {
	tr?: { title?: string; body?: string };
	en?: { title?: string; body?: string };
	titleTr?: string;
	titleEn?: string;
	bodyTr?: string;
	bodyEn?: string;
}

export interface LegalDocumentVersion {
	id: string;
	documentId: string;
	docType: string;
	version: number;
	scope: string;
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
	required: boolean;
	contentHash: string;
	archivedAt: number;
	archivedBy: string | null;
}

export interface LegalDocumentInput {
	id?: string;
	docType: LegalDocumentType;
	scope: LegalDocumentScope;
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
	required: boolean;
	enabled: boolean;
	sortOrder: number;
	updatedBy?: string | null;
}

export function parseLegalTranslations(raw: unknown): {
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
} {
	let obj: LegalDocumentTranslations = {};
	if (typeof raw === 'string') {
		try {
			obj = JSON.parse(raw) as LegalDocumentTranslations;
		} catch {
			obj = {};
		}
	} else if (raw && typeof raw === 'object') {
		obj = raw as LegalDocumentTranslations;
	}
	return {
		titleTr: String(obj.tr?.title ?? obj.titleTr ?? ''),
		titleEn: String(obj.en?.title ?? obj.titleEn ?? ''),
		bodyTr: String(obj.tr?.body ?? obj.bodyTr ?? ''),
		bodyEn: String(obj.en?.body ?? obj.bodyEn ?? ''),
	};
}

export function serializeLegalTranslations(input: {
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
}): string {
	return JSON.stringify({
		tr: { title: input.titleTr, body: input.bodyTr },
		en: { title: input.titleEn, body: input.bodyEn },
	});
}

export function toLegalDocument(row: Record<string, unknown>): LegalDocument {
	const t = parseLegalTranslations(row.translations);
	return {
		id: String(row.id),
		docType: String(row.docType ?? row.doc_type) as LegalDocumentType,
		scope: String(row.scope) as LegalDocumentScope,
		titleTr: t.titleTr,
		titleEn: t.titleEn,
		bodyTr: t.bodyTr,
		bodyEn: t.bodyEn,
		required: Number(row.required) === 1,
		enabled: Number(row.enabled) === 1,
		sortOrder: Number(row.sortOrder ?? row.sort_order) || 0,
		version: Number(row.version) || 1,
		updatedAt: Number(row.updatedAt ?? row.updated_at) || 0,
		updatedBy: row.updatedBy ? String(row.updatedBy) : (row.updated_by ? String(row.updated_by) : null),
	};
}

export function parseVersionsJson(raw: unknown): LegalDocumentVersion[] {
	let arr: unknown = raw;
	if (typeof raw === 'string') {
		try {
			arr = JSON.parse(raw);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(arr)) return [];
	return arr
		.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
		.map((row) => ({
			id: String(row.id ?? ''),
			documentId: String(row.documentId ?? ''),
			docType: String(row.docType ?? ''),
			version: Number(row.version) || 1,
			scope: String(row.scope ?? 'registration'),
			titleTr: String(row.titleTr ?? ''),
			titleEn: String(row.titleEn ?? ''),
			bodyTr: String(row.bodyTr ?? ''),
			bodyEn: String(row.bodyEn ?? ''),
			required: Boolean(row.required),
			contentHash: String(row.contentHash ?? ''),
			archivedAt: Number(row.archivedAt) || 0,
			archivedBy: row.archivedBy ? String(row.archivedBy) : null,
		}));
}

export function legalDocumentContentHash(
	doc: Pick<LegalDocument, 'docType' | 'scope' | 'titleTr' | 'titleEn' | 'bodyTr' | 'bodyEn' | 'required' | 'version'>
): string {
	return createHash('sha256')
		.update(
			[
				doc.docType,
				doc.scope,
				doc.titleTr,
				doc.titleEn,
				doc.bodyTr,
				doc.bodyEn,
				doc.required ? '1' : '0',
				String(doc.version),
			].join('\u0000')
		)
		.digest('hex');
}
