import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { createDecision, deleteDecision, getPgPool, getDecisionById, getDecisions, getCommitteeDetail, setDecisionLock, updateDecision } from '@/db';
import { can, requireApp } from '@/lib/auth/access';
import { documentSummary } from '@/server/documentDigest';
import { notificationEvents, publishEventQuiet } from '@/db/events';

const DOCUMENT_TYPES = ['resolution', 'hall_allocation', 'event_permission', 'material_request', 'cover_letter'];
const DECISION_TYPES = ['resolution', 'motion', 'minutes', 'appointment', 'budget'];
const bad = (error: string, status = 400) => jsonError(error, status);

export async function GET(request: Request) {
	// Kararlar, uygulamayı kullanan üyelere salt okunur açıktır (şeffaf kulüp ilkesi) — yalnızca
	// `kamuyaAcikMi = 0` ile işaretlenenler hariç: onları yalnız kararları yönetenler görür.
	const auth = await requireApp(request, 'decisions', 'use');
	if (!auth.authorized) return auth.response;

	try {
		const decisions = await getDecisions();
		const management = can(auth.user, 'decisions', 'manage');
		const visible = management ? decisions : decisions.filter((k) => Number(k.isPublicOpen) === 1);
		// The digest is printed on the document and shown on the verification page.
		return jsonSuccess(visible.map((k) => ({ ...k, summary: documentSummary(k) })));
	} catch (error) {
		console.error('API /api/decisions GET error:', error);
		return bad('Kararlar okunamadı.', 500);
	}
}

/** Validates the editable fields; `partial` leaves absent ones out. */
function parse(body: Record<string, unknown>, partial: boolean) {
	const v: {
		title?: string;
		agenda?: string;
		content?: string;
		documentType?: string;
		isPublicOpen?: boolean;
		bodyId?: string | null;
		decisionType?: string;
		quorumMet?: boolean;
		votesFor?: number;
		votesAgainst?: number;
		votesAbstain?: number;
	} = {};
	if (!partial || body.title !== undefined) {
		const title = typeof body.title === 'string' ? body.title.trim() : '';
		if (title.length < 3 || title.length > 200) return { error: 'Başlık 3-200 karakter olmalıdır.' };
		v.title = title;
	}
	if (!partial || body.content !== undefined) {
		const content = typeof body.content === 'string' ? body.content.trim() : '';
		if (content.length < 10 || content.length > 20000) return { error: 'İçerik 10-20000 karakter olmalıdır.' };
		v.content = content;
	}
	if (!partial || body.agenda !== undefined) {
		const agenda = typeof body.agenda === 'string' ? body.agenda.trim() : '';
		if (agenda.length > 2000) return { error: 'Gündem en fazla 2000 karakter olabilir.' };
		v.agenda = agenda;
	}
	if (body.documentType !== undefined || !partial) {
		const typeValue = body.documentType ?? 'resolution';
		if (typeof typeValue !== 'string' || !DOCUMENT_TYPES.includes(typeValue)) return { error: 'Geçersiz belge türü.' };
		v.documentType = typeValue;
	}
	if (body.isPublicOpen !== undefined) v.isPublicOpen = Boolean(body.isPublicOpen);
	if (body.bodyId !== undefined) {
		if (body.bodyId === null || body.bodyId === '') v.bodyId = null;
		else if (typeof body.bodyId === 'string' && body.bodyId.length <= 100) v.bodyId = body.bodyId;
		else return { error: 'Geçersiz komite.' };
	}
	if (body.decisionType !== undefined || !partial) {
		const type = body.decisionType ?? 'resolution';
		if (typeof type !== 'string' || !DECISION_TYPES.includes(type)) return { error: 'Geçersiz karar türü.' };
		v.decisionType = type;
	}
	if (body.quorumMet !== undefined) v.quorumMet = Boolean(body.quorumMet);
	for (const key of ['votesFor', 'votesAgainst', 'votesAbstain'] as const) {
		if (body[key] === undefined) continue;
		const value = Number(body[key]);
		if (!Number.isInteger(value) || value < 0 || value > 100000) return { error: 'Oy sayıları geçersiz.' };
		v[key] = value;
	}
	return { value: v };
}

async function validateBody(bodyId: string | null | undefined): Promise<string | null> {
	if (!bodyId) return null;
	return (await getCommitteeDetail(bodyId)) ? null : 'Komite bulunamadı.';
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'decisions', 'manage');
	if (!auth.authorized) return auth.response;

	try {
		const body = (await request.json()) as Record<string, unknown>;

		// Locking freezes a document once it is signed: no edits, no deletion.
		// Unlocking is an admin's call alone.
		if (body.action === 'lock' || body.action === 'unlock') {
			const id = typeof body.id === 'string' ? body.id : '';
			if (!(await getDecisionById(id))) return bad('Belge bulunamadı.', 404);
			if (body.action === 'unlock' && !auth.user.permission.admin) return bad('Kilidi yalnızca bir admin açabilir.', 403);
			await setDecisionLock(id, body.action === 'lock');
			await publishEventQuiet(getPgPool(), [{ k: 'decision_updated' }]);
			return NextResponse.json({ success: true, isLocked: body.action === 'lock' ? 1 : 0 });
		}

		const parsed = parse(body, false);
		if ('error' in parsed) return bad(parsed.error as string);
		const v = parsed.value;
		const bodyProblem = await validateBody(v.bodyId);
		if (bodyProblem) return bad(bodyProblem, 404);
		const result = await createDecision({
			title: v.title!,
			agenda: v.agenda ?? '',
			content: v.content!,
			documentType: v.documentType,
			isPublicOpen: v.isPublicOpen ?? true,
			creatorId: auth.user.id,
			bodyId: v.bodyId ?? null,
			decisionType: v.decisionType,
			quorumMet: v.quorumMet,
			votesFor: v.votesFor,
			votesAgainst: v.votesAgainst,
			votesAbstain: v.votesAbstain,
		});
		await publishEventQuiet(getPgPool(), [{ k: 'decision_updated' }, ...notificationEvents()]);
		return NextResponse.json({ ...result, summary: documentSummary(result) }, { status: 201 });
	} catch (error) {
		console.error('API /api/decisions POST error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}

/** Edits an unlocked document. */
async function handlePATCH(request: Request) {
	const auth = await requireApp(request, 'decisions', 'manage');
	if (!auth.authorized) return auth.response;
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const id = typeof body.id === 'string' ? body.id : '';
		const parsed = parse(body, true);
		if ('error' in parsed) return bad(parsed.error as string);
		const bodyProblem = await validateBody(parsed.value.bodyId);
		if (bodyProblem) return bad(bodyProblem, 404);
		const r = await updateDecision(id, parsed.value);
		if (r === 'none') return bad('Belge bulunamadı.', 404);
		if (r === 'locked') return bad('Kilitli belge düzenlenemez.', 409);
		await publishEventQuiet(getPgPool(), [{ k: 'decision_updated' }]);
		return jsonSuccess({ success: true });
	} catch (error) {
		console.error('API /api/decisions PATCH error:', error);
		return bad('Belge güncellenemedi.', 500);
	}
}

/** Deletes an unlocked document. */
async function handleDELETE(request: Request) {
	const auth = await requireApp(request, 'decisions', 'manage');
	if (!auth.authorized) return auth.response;
	const id = new URL(request.url).searchParams.get('id') ?? '';
	const r = await deleteDecision(id);
	if (r === 'none') return bad('Belge bulunamadı.', 404);
	if (r === 'locked') return bad('Kilitli belge silinemez; önce başkanın kilidi açması gerekir.', 409);
	await publishEventQuiet(getPgPool(), [{ k: 'decision_updated' }]);
	return jsonSuccess({ success: true });
}

export const POST = withAudit(handlePOST, { action: 'decisions.create', target: 'decisions' });
export const PATCH = withAudit(handlePATCH, { action: 'decisions.update', target: 'decisions' });
export const DELETE = withAudit(handleDELETE, { action: 'decisions.delete', target: 'decisions' });
