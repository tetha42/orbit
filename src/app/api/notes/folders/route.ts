import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { getUserNoteFolders, saveUserNoteFolder, deleteUserNoteFolder } from '@/db';

export async function GET(request: Request) {
	try {
		const auth = await requireApp(request, 'notes', 'kullan');
		if (!auth.authorized) {
			return auth.response;
		}

		const folders = await getUserNoteFolders(auth.user.id);
		return NextResponse.json(folders);
	} catch (error) {
		console.error('Folders API error:', error);
		return NextResponse.json({ error: 'Klasörler yüklenemedi.' }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const auth = await requireApp(request, 'notes', 'kullan');
		if (!auth.authorized) {
			return auth.response;
		}

		const body = await request.json();
		const { id, ad, renk, sira } = body;

		if (!ad || typeof ad !== 'string' || !ad.trim()) {
			return NextResponse.json({ error: 'Klasör adı zorunludur.' }, { status: 400 });
		}

		const saved = await saveUserNoteFolder({
			id,
			userId: auth.user.id,
			ad: ad.trim(),
			renk,
			sira,
		});

		return NextResponse.json(saved);
	} catch (error) {
		const msg = error instanceof Error ? error.message : '';
		if (msg.includes('Yetkisiz işlem')) {
			return NextResponse.json({ error: msg }, { status: 403 });
		}
		console.error('Folders API error:', error);
		return NextResponse.json({ error: 'Klasör kaydedilemedi.' }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	try {
		const auth = await requireApp(request, 'notes', 'kullan');
		if (!auth.authorized) {
			return auth.response;
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'Klasör ID zorunludur.' }, { status: 400 });
		}

		const success = await deleteUserNoteFolder(id, auth.user.id);
		return NextResponse.json({ success });
	} catch (error) {
		console.error('Folders API error:', error);
		return NextResponse.json({ error: 'Klasör silinemedi.' }, { status: 500 });
	}
}
