import { NextResponse } from 'next/server';
import { getLegalDocumentVersions } from '@/db';
import { requireApp } from '@/lib/auth/access';
import { LEGAL_DOCUMENT_TYPES, type LegalDocumentType } from '@/lib/i18n/data/legalDefaults';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'use');
	if (!auth.authorized) return auth.response;
	const docType = new URL(request.url).searchParams.get('docType') ?? '';
	if (!LEGAL_DOCUMENT_TYPES.includes(docType as LegalDocumentType)) {
		return NextResponse.json({ error: 'Invalid document type.' }, { status: 400 });
	}
	return NextResponse.json(
		{ ok: true, versions: await getLegalDocumentVersions(docType) },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
