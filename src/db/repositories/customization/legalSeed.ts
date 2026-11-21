import { getPgPool } from '@/db';
import { DEFAULT_LEGAL_DOCUMENTS } from '@/lib/i18n/data/legalDefaults';
import { serializeLegalTranslations } from './legalDocumentHelpers';

export async function seedLegalDocuments(): Promise<void> {
	const now = Date.now();
	for (const [index, doc] of DEFAULT_LEGAL_DOCUMENTS.entries()) {
		await getPgPool().query(
			`INSERT INTO legal_documents
				(id, doc_type, scope, translations, versions, required, enabled, sort_order, version, updated_at)
			 VALUES ($1, $2, $3, $4::jsonb, '[]'::jsonb, $5, 1, $6, 1, $7)
			 ON CONFLICT (doc_type) DO NOTHING`,
			[
				`legal_${doc.docType}`,
				doc.docType,
				doc.scope,
				serializeLegalTranslations({
					titleTr: doc.titleTr,
					titleEn: doc.titleEn,
					bodyTr: doc.bodyTr,
					bodyEn: doc.bodyEn,
				}),
				doc.required ? 1 : 0,
				index,
				now,
			]
		);
	}
}
