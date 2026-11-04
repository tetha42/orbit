import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/access';
import {
	createOAuthClient,
	deleteOAuthClient,
	getOAuthClients,
	regenerateOAuthClientSecret,
	updateOAuthClient,
} from '@/db/oauth';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';

export async function GET(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;

	try {
		const clients = await getOAuthClients();
		return NextResponse.json({ clients });
	} catch (error) {
		console.error('API /api/oauth/clients GET error:', error);
		return NextResponse.json({ error: 'Uygulamalar listelenemedi.' }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);

	try {
		const body = await request.json();
		const name = typeof body.name === 'string' ? body.name.trim() : '';
		const description = typeof body.description === 'string' ? body.description.trim() : '';
		const logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : undefined;
		const trusted = body.trusted === true;

		let redirectUris: string[] = [];
		if (Array.isArray(body.redirectUris)) {
			redirectUris = body.redirectUris.map(String).map((u) => u.trim()).filter(Boolean);
		} else if (typeof body.redirectUris === 'string') {
			redirectUris = body.redirectUris.split('\n').map((u) => u.trim()).filter(Boolean);
		}

		let allowedScopes: string[] | undefined = undefined;
		if (Array.isArray(body.allowedScopes)) {
			allowedScopes = body.allowedScopes.map(String).map((s) => s.trim()).filter(Boolean);
		}

		if (!name) {
			return NextResponse.json({ error: 'Uygulama adı zorunludur.' }, { status: 400 });
		}
		if (redirectUris.length === 0) {
			return NextResponse.json({ error: 'En az bir geçerli Yönlendirme URL (redirect_uri) girilmelidir.' }, { status: 400 });
		}

		const result = await createOAuthClient(
			{ name, description: description, logoUrl, redirectUris, allowedScopes, trusted },
			auth.user.id
		);

		await logSystemEvent({
			service: 'oauth',
			level: 'INFO',
			message: `Yeni OAuth istemcisi oluşturuldu: ${name} (${result.client.id})`,
			detail: { clientId: result.client.id, name, redirectUris, trusted },
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json({
			success: true,
			client: result.client,
			plainSecret: result.plainSecret,
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : '';
		if (msg.includes('Geçersiz Yönlendirme URL')) {
			return NextResponse.json({ error: msg }, { status: 400 });
		}
		console.error('API /api/oauth/clients POST error:', error);
		return NextResponse.json({ error: 'Uygulama oluşturulamadı.' }, { status: 500 });
	}
}

export async function PATCH(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);

	try {
		const body = await request.json();
		const id = typeof body.id === 'string' ? body.id : '';

		if (!id) {
			return NextResponse.json({ error: 'İstemci kimliği zorunludur.' }, { status: 400 });
		}

		if (body.action === 'regenerate_secret') {
			const regen = await regenerateOAuthClientSecret(id);
			if (!regen) return NextResponse.json({ error: 'Uygulama bulunamadı.' }, { status: 404 });
			await logSystemEvent({
				service: 'oauth',
				level: 'WARN',
				message: `OAuth istemci gizli anahtarı (client_secret) yenilendi: ${id}`,
				detail: { clientId: id },
				userId: auth.user.id,
				ip,
			});
			return NextResponse.json({ success: true, plainSecret: regen.plainSecret });
		}

		const updateData: Parameters<typeof updateOAuthClient>[1] = {};
		if (typeof body.name === 'string') updateData.name = body.name.trim();
		if (typeof body.description === 'string') updateData.description = body.description.trim();
		if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
		if (body.trusted !== undefined) updateData.trusted = body.trusted === true;
		if (body.active !== undefined) updateData.active = body.active === true;
		if (Array.isArray(body.redirectUris)) {
			updateData.redirectUris = body.redirectUris.map(String).map((u) => u.trim()).filter(Boolean);
		}
		if (Array.isArray(body.allowedScopes)) {
			updateData.allowedScopes = body.allowedScopes.map(String).map((s) => s.trim()).filter(Boolean);
		}

		const ok = await updateOAuthClient(id, updateData);
		if (!ok) return NextResponse.json({ error: 'Uygulama bulunamadı.' }, { status: 404 });

		await logSystemEvent({
			service: 'oauth',
			level: 'INFO',
			message: `OAuth istemcisi güncellendi: ${id}`,
			detail: { clientId: id, changes: updateData },
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		const msg = error instanceof Error ? error.message : '';
		if (msg.includes('Geçersiz Yönlendirme URL')) {
			return NextResponse.json({ error: msg }, { status: 400 });
		}
		console.error('API /api/oauth/clients PATCH error:', error);
		return NextResponse.json({ error: 'Uygulama güncellenemedi.' }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);

	try {
		const url = new URL(request.url);
		const id = url.searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'İstemci kimliği zorunludur.' }, { status: 400 });
		}

		const ok = await deleteOAuthClient(id);
		if (!ok) return NextResponse.json({ error: 'Uygulama bulunamadı.' }, { status: 404 });

		await logSystemEvent({
			service: 'oauth',
			level: 'WARN',
			message: `OAuth istemcisi silindi: ${id}`,
			detail: { clientId: id },
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('API /api/oauth/clients DELETE error:', error);
		return NextResponse.json({ error: 'Uygulama silinemedi.' }, { status: 500 });
	}
}
