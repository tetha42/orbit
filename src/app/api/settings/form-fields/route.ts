import { NextResponse } from 'next/server';
import {
	createFormField,
	deleteFormField,
	getFormFields,
	reorderFormFields,
	updateFormField,
} from '@/db';
import { requireApp } from '@/lib/auth/access';
import { normalizeFormFieldInput } from '@/lib/formFields';
import { logSystemEvent } from '@/server/db/domains/logs.repo';

export const dynamic = 'force-dynamic';

const readOnly = () =>
	NextResponse.json({ error: 'Alumni accounts are read-only.' }, { status: 403 });

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'kullan');
	if (!auth.authorized) return auth.response;
	const fields = await getFormFields();
	return NextResponse.json({ ok: true, fields });
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') return readOnly();

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const normalized = normalizeFormFieldInput(body, 0);
	if ('error' in normalized) {
		return NextResponse.json({ error: normalized.error, code: 'INVALID_FIELD' }, { status: 400 });
	}
	try {
		const field = await createFormField(normalized.value);
		void logSystemEvent({
			servis: 'settings',
			seviye: 'INFO',
			mesaj: `Custom member field created: ${field.fieldKey}`,
			detay: { fieldId: field.id, scope: field.scope, type: field.type },
			userId: auth.user.id,
		});
		return NextResponse.json({ ok: true, field });
	} catch (error) {
		const code = (error as { code?: string }).code;
		if (code === '23505') {
			return NextResponse.json(
				{ error: 'A field with this key already exists in that scope.', code: 'DUPLICATE_FIELD_KEY' },
				{ status: 409 }
			);
		}
		console.error('API /api/settings/form-fields POST error:', error);
		return NextResponse.json({ error: 'The field could not be created.' }, { status: 500 });
	}
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') return readOnly();

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

	// Reordering is a separate, narrow operation.
	if (Array.isArray(body.order)) {
		const ids = body.order.filter((id): id is string => typeof id === 'string');
		if (ids.length !== body.order.length) {
			return NextResponse.json({ error: 'Invalid reorder payload.' }, { status: 400 });
		}
		await reorderFormFields(ids);
		return NextResponse.json({ ok: true, fields: await getFormFields() });
	}

	const id = String(body.id ?? '').trim();
	if (!id) return NextResponse.json({ error: 'Field id is required.' }, { status: 400 });
	const normalized = normalizeFormFieldInput(body, Number(body.sortOrder) || 0);
	if ('error' in normalized) {
		return NextResponse.json({ error: normalized.error, code: 'INVALID_FIELD' }, { status: 400 });
	}
	try {
		const field = await updateFormField({ id, ...normalized.value });
		if (!field) return NextResponse.json({ error: 'Field not found.' }, { status: 404 });
		return NextResponse.json({ ok: true, field });
	} catch (error) {
		const code = (error as { code?: string }).code;
		if (code === '23505') {
			return NextResponse.json(
				{ error: 'A field with this key already exists in that scope.', code: 'DUPLICATE_FIELD_KEY' },
				{ status: 409 }
			);
		}
		console.error('API /api/settings/form-fields PATCH error:', error);
		return NextResponse.json({ error: 'The field could not be updated.' }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') return readOnly();

	const id = new URL(request.url).searchParams.get('id') ?? '';
	if (!id) return NextResponse.json({ error: 'Field id is required.' }, { status: 400 });
	const removed = await deleteFormField(id);
	if (!removed) return NextResponse.json({ error: 'Field not found.' }, { status: 404 });
	return NextResponse.json({ ok: true, fields: await getFormFields() });
}
