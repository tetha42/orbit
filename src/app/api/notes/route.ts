import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { getUserNotes, saveUserNote, deleteUserNote, emptyUserNotesTrash, getPgPool } from '@/db';
import { publishEventQuiet } from '@/db/events';
import { inspectJsonPayload } from '@/lib/waf';
import notesContract from '@/apps/notes/notes.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

export async function GET(request: Request) {
	try {
		const auth = await requireApp(request, 'notes', 'use');
		if (!auth.authorized) {
			return auth.response;
		}

		const notes = await getUserNotes(auth.user.id);
		return NextResponse.json(notes);
	} catch (error) {
		console.error('API error:', error);
		return NextResponse.json({ error: 'Operation failed.' }, { status: 500 });
	}
}

async function handlePOST(request: Request) {
	try {
		const auth = await requireApp(request, 'notes', 'use');
		if (!auth.authorized) {
			return auth.response;
		}

		const body = await request.json();
		const waf = inspectJsonPayload(body);
		if (waf.matched) {
			return NextResponse.json({ error: 'Web Application Firewall (WAF): Malicious payload blocked.' }, { status: 403 });
		}

		const { id, title, content, color, isPinned, folderId, isTrashed } = body;

		if (title === undefined && content === undefined) {
			return NextResponse.json({ error: 'Title or content must be provided.' }, { status: 400 });
		}
		if (typeof content === 'string' && content.length > notesContract.limits.maxNoteLength) {
			return NextResponse.json(
				{ error: `Note content cannot exceed ${notesContract.limits.maxNoteLength} characters.` },
				{ status: 400 }
			);
		}

		if (Boolean(isPinned) && !Boolean(isTrashed)) {
			const existingNotes = await getUserNotes(auth.user.id);
			const otherPinnedCount = existingNotes.filter(
				(n) => Boolean(n.isPinned) && !Boolean(n.isTrashed) && n.id !== id
			).length;
			if (otherPinnedCount >= notesContract.limits.maxPinnedNotes) {
				return NextResponse.json(
					{ error: `You can pin at most ${notesContract.limits.maxPinnedNotes} notes.` },
					{ status: 400 }
				);
			}
		}

		const saved = await saveUserNote({
			id,
			userId: auth.user.id,
			title: title !== undefined ? title : 'Untitled Note',
			content: content !== undefined ? content : '',
			color: color || folderId || 'yellow',
			isPinned: Boolean(isPinned),
			folderId: folderId || 'quick',
			isTrashed: Boolean(isTrashed),
		});

		await publishEventQuiet(getPgPool(), [{ k: 'note_updated', userId: auth.user.id }]);

		return NextResponse.json(saved);
	} catch (error) {
		const msg = error instanceof Error ? error.message : '';
		if (msg.includes('Unauthorized') || msg.includes('not authorized')) {
			return NextResponse.json({ error: msg }, { status: 403 });
		}
		console.error('API error:', error);
		return NextResponse.json({ error: 'Operation failed.' }, { status: 500 });
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
		const isTrash = searchParams.get('trash') === 'true';

		if (isTrash) {
			const count = await emptyUserNotesTrash(auth.user.id);
			return NextResponse.json({ success: true, count });
		}

		if (!id) {
			return NextResponse.json({ error: 'Note ID is required.' }, { status: 400 });
		}

		const success = await deleteUserNote(id, auth.user.id);
		if (!success) {
			return contractErrorResponse(notesContract, 'NOTE_NOT_FOUND');
		}
		await publishEventQuiet(getPgPool(), [{ k: 'note_updated', userId: auth.user.id }]);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('API error:', error);
		return NextResponse.json({ error: 'Operation failed.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'notes.create', target: 'notes' });
export const DELETE = withAudit(handleDELETE, { action: 'notes.delete', target: 'notes' });
