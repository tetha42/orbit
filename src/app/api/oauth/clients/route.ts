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
import { logSystemEvent } from '@/server/db/domains/logs.repo';

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
		const ad = typeof body.ad === 'string' ? body.ad.trim() : '';
		const aciklama = typeof body.aciklama === 'string' ? body.aciklama.trim() : '';
		const logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : undefined;
		const guvenilir = body.guvenilir === true;

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

		if (!ad) {
			return NextResponse.json({ error: 'Uygulama adı zorunludur.' }, { status: 400 });
		}
		if (redirectUris.length === 0) {
			return NextResponse.json({ error: 'En az bir geçerli Yönlendirme URL (redirect_uri) girilmelidir.' }, { status: 400 });
		}

		const result = await createOAuthClient(
			{ ad, aciklama, logoUrl, redirectUris, allowedScopes, guvenilir },
			auth.user.id
		);

		await logSystemEvent({
			servis: 'oauth',
			seviye: 'INFO',
			mesaj: `Yeni OAuth istemcisi oluşturuldu: ${ad} (${result.client.id})`,
			detay: { clientId: result.client.id, ad, redirectUris, guvenilir },
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
				servis: 'oauth',
				seviye: 'WARN',
				mesaj: `OAuth istemci gizli anahtarı (client_secret) yenilendi: ${id}`,
				detay: { clientId: id },
				userId: auth.user.id,
				ip,
			});
			return NextResponse.json({ success: true, plainSecret: regen.plainSecret });
		}

		const updateData: Parameters<typeof updateOAuthClient>[1] = {};
		if (typeof body.ad === 'string') updateData.ad = body.ad.trim();
		if (typeof body.aciklama === 'string') updateData.aciklama = body.aciklama.trim();
		if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
		if (body.guvenilir !== undefined) updateData.guvenilir = body.guvenilir === true;
		if (body.aktif !== undefined) updateData.aktif = body.aktif === true;
		if (Array.isArray(body.redirectUris)) {
			updateData.redirectUris = body.redirectUris.map(String).map((u) => u.trim()).filter(Boolean);
		}
		if (Array.isArray(body.allowedScopes)) {
			updateData.allowedScopes = body.allowedScopes.map(String).map((s) => s.trim()).filter(Boolean);
		}

		const ok = await updateOAuthClient(id, updateData);
		if (!ok) return NextResponse.json({ error: 'Uygulama bulunamadı.' }, { status: 404 });

		await logSystemEvent({
			servis: 'oauth',
			seviye: 'INFO',
			mesaj: `OAuth istemcisi güncellendi: ${id}`,
			detay: { clientId: id, degisiklikler: updateData },
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
			servis: 'oauth',
			seviye: 'WARN',
			mesaj: `OAuth istemcisi silindi: ${id}`,
			detay: { clientId: id },
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('API /api/oauth/clients DELETE error:', error);
		return NextResponse.json({ error: 'Uygulama silinemedi.' }, { status: 500 });
	}
}
