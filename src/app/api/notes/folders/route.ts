import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { getUserNoteFolders, saveUserNoteFolder, deleteUserNoteFolder } from '@/db';

export async function GET(request: Request) {
	try {
		const auth = await requireApp(request, 'notes', 'use');
		if (!auth.authorized) {
			return auth.response;
		}

		const folders = await getUserNoteFolders(auth.user.id);
		return NextResponse.json(folders);
	} catch (error) {
		console.error('Folders API error:', error);
		return NextResponse.json({ error: 'Failed to load folders.' }, { status: 500 });
	}
}

async function handlePOST(request: Request) {
	try {
		const auth = await requireApp(request, 'notes', 'use');
		if (!auth.authorized) {
			return auth.response;
		}

		const body = await request.json();
		const { id, name, color, order } = body;

		if (!name || typeof name !== 'string' || !name.trim()) {
			return NextResponse.json({ error: 'Folder name is required.' }, { status: 400 });
		}

		const saved = await saveUserNoteFolder({
			id,
			userId: auth.user.id,
			name: name.trim(),
			color,
			order,
		});

		return NextResponse.json(saved);
	} catch (error) {
		const msg = error instanceof Error ? error.message : '';
		if (msg.includes('Unauthorized')) {
			return NextResponse.json({ error: msg }, { status: 403 });
		}
		console.error('Folders API error:', error);
		return NextResponse.json({ error: 'Failed to save folder.' }, { status: 500 });
	}
}

async function handleDELETE(request: Request) {
	try {
		const auth = await requireApp(request, 'notes', 'use');
		if (!auth.authorized) {
			return auth.response;
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'Folder ID is required.' }, { status: 400 });
		}

		const success = await deleteUserNoteFolder(id, auth.user.id);
		return NextResponse.json({ success });
	} catch (error) {
		console.error('Folders API error:', error);
		return NextResponse.json({ error: 'Failed to delete folder.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'notes.folders.create', target: 'notes.folders' });
export const DELETE = withAudit(handleDELETE, { action: 'notes.folders.delete', target: 'notes.folders' });
