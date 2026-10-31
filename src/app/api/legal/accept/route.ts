import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { acceptLegalDocuments, getLegalDocuments, getMissingLegalAcceptances } from '@/db';
import { verifyAuth } from '@/lib/auth/authGuard';
import { clientAddress } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** Records explicit re-consent for the current document versions. */
async function handlePOST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const ids = Array.isArray(body?.documentIds)
		? body.documentIds.filter((id): id is string => typeof id === 'string')
		: [];
	const unique = [...new Set(ids)];
	if (unique.length === 0) {
		return NextResponse.json({ error: 'Kabul edilecek belge seçilmedi.' }, { status: 400 });
	}

	const current = await getLegalDocuments({ enabledOnly: true });
	const byId = new Map(current.map((doc) => [doc.id, doc]));
	const documents = unique.map((id) => byId.get(id)).filter((doc): doc is NonNullable<typeof doc> => Boolean(doc));
	if (documents.length !== unique.length) {
		return NextResponse.json({ error: 'Belgelerden biri artık geçerli değil.' }, { status: 400 });
	}

	await acceptLegalDocuments(auth.user.id, documents, {
		ip: clientAddress(request),
		userAgent: request.headers.get('user-agent'),
		source: 'reconsent',
	});
	return NextResponse.json({
		ok: true,
		documents: await getMissingLegalAcceptances(auth.user.id),
	});
}

export const POST = withAudit(handlePOST, { action: 'legal.accept.create', target: 'legal.accept' });
