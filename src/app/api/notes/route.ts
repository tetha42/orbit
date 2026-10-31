import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { getUserNotes, saveUserNote, deleteUserNote, emptyUserNotesTrash, getPgPool } from '@/db';
import { publishEventQuiet } from '@/db/olaylar';
import { inspectJsonPayload } from '@/lib/waf';

export async function GET(request: Request) {
	try {
		const auth = await requireApp(request, 'notes', 'kullan');
		if (!auth.authorized) {
			return auth.response;
		}

		const notes = await getUserNotes(auth.user.id);
		return NextResponse.json(notes);
	} catch (error) {
		console.error('API error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}

async function handlePOST(request: Request) {
	try {
		const auth = await requireApp(request, 'notes', 'kullan');
		if (!auth.authorized) {
			return auth.response;
		}

		const body = await request.json();
		const waf = inspectJsonPayload(body);
		if (waf.matched) {
			return NextResponse.json({ error: 'Güvenlik duvarı (WAF): Zararlı içerik engellendi.' }, { status: 403 });
		}

		const { id, baslik, icerik, renk, sabitliMi, klasorId, copteMi } = body;

		if (baslik === undefined && icerik === undefined) {
			return NextResponse.json({ error: 'Başlık veya içerik girilmelidir.' }, { status: 400 });
		}

		const saved = await saveUserNote({
			id,
			userId: auth.user.id,
			baslik: baslik !== undefined ? baslik : 'Başlıksız Not',
			icerik: icerik !== undefined ? icerik : '',
			renk: renk || klasorId || 'sari',
			sabitliMi: Boolean(sabitliMi),
			klasorId: klasorId || 'quick',
			copteMi: Boolean(copteMi),
		});

		await publishEventQuiet(getPgPool(), [{ k: 'not_guncellendi', userId: auth.user.id }]);

		return NextResponse.json(saved);
	} catch (error) {
		const msg = error instanceof Error ? error.message : '';
		if (msg.includes('Yetkisiz işlem')) {
			return NextResponse.json({ error: msg }, { status: 403 });
		}
		console.error('API error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}

async function handleDELETE(request: Request) {
	try {
		const auth = await requireApp(request, 'notes', 'kullan');
		if (!auth.authorized) {
			return auth.response;
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');
		const isTrash = searchParams.get('trash') === 'true';

		if (isTrash) {
			const count = await emptyUserNotesTrash(auth.user.id);
			return NextResponse.json({ success: true, count });
		}

		if (!id) {
			return NextResponse.json({ error: 'Not ID zorunludur.' }, { status: 400 });
		}

		const success = await deleteUserNote(id, auth.user.id);
		if (success) {
			await publishEventQuiet(getPgPool(), [{ k: 'not_guncellendi', userId: auth.user.id }]);
		}
		return NextResponse.json({ success });
	} catch (error) {
		console.error('API error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'notes.create', target: 'notes' });
export const DELETE = withAudit(handleDELETE, { action: 'notes.delete', target: 'notes' });
