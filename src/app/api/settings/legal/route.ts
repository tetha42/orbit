import { NextResponse } from 'next/server';
import { getLegalDocuments, upsertLegalDocument } from '@/db';
import { requireApp } from '@/lib/auth/access';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import {
	LEGAL_DOCUMENT_SCOPES,
	LEGAL_DOCUMENT_TYPES,
	type LegalDocumentScope,
	type LegalDocumentType,
} from '@/lib/legalDefaults';

export const dynamic = 'force-dynamic';

const MAX_TITLE = 160;
const MAX_BODY = 40_000;

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'kullan');
	if (!auth.authorized) return auth.response;
	const documents = await getLegalDocuments();
	return NextResponse.json({ ok: true, documents });
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Alumni accounts are read-only.' }, { status: 403 });
	}

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const docType = String(body.docType ?? '') as LegalDocumentType;
	const scope = String(body.scope ?? 'registration') as LegalDocumentScope;
	if (!LEGAL_DOCUMENT_TYPES.includes(docType)) {
		return NextResponse.json({ error: 'Unknown document type.', code: 'INVALID_DOC_TYPE' }, { status: 400 });
	}
	if (!LEGAL_DOCUMENT_SCOPES.includes(scope)) {
		return NextResponse.json({ error: 'Unknown document scope.', code: 'INVALID_SCOPE' }, { status: 400 });
	}

	const titleTr = String(body.titleTr ?? '').trim().slice(0, MAX_TITLE);
	const titleEn = String(body.titleEn ?? '').trim().slice(0, MAX_TITLE);
	const bodyTr = String(body.bodyTr ?? '').trim().slice(0, MAX_BODY);
	const bodyEn = String(body.bodyEn ?? '').trim().slice(0, MAX_BODY);
	if (!titleTr || !titleEn || !bodyTr || !bodyEn) {
		return NextResponse.json(
			{ error: 'Turkish and English title and body are all required.', code: 'LEGAL_CONTENT_REQUIRED' },
			{ status: 400 }
		);
	}

	const previous = (await getLegalDocuments()).find((doc) => doc.docType === docType);
	const saved = await upsertLegalDocument({
		id: previous?.id,
		docType,
		scope,
		titleTr,
		titleEn,
		bodyTr,
		bodyEn,
		required: body.required === true,
		enabled: body.enabled !== false,
		sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : previous?.sortOrder ?? 0,
		updatedBy: auth.user.id,
	});

	void logSystemEvent({
		servis: 'settings',
		seviye: 'INFO',
		mesaj: `Legal document updated: ${saved.docType} (${auth.user.ad} ${auth.user.soyad})`,
		detay: {
			documentId: saved.id,
			scope: saved.scope,
			required: saved.required,
			enabled: saved.enabled,
		},
		userId: auth.user.id,
	});

	return NextResponse.json({ ok: true, document: saved });
}
