import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { getMailEmailSetting, setMailEmailSetting } from '@/db/posta';
import { requireApp } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

/** The caller's own Mail preference: also be told by e-mail when a message arrives. */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'mail', 'kullan');
	if (!auth.authorized) return auth.response;
	try {
		return NextResponse.json({ epostaIleHaber: await getMailEmailSetting(auth.user.id) }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		console.error('API /api/posta/ayarlar GET error:', error);
		return NextResponse.json({ error: 'Ayar okunamadı.' }, { status: 500 });
	}
}

async function handlePATCH(request: Request) {
	const auth = await requireApp(request, 'mail', 'kullan');
	if (!auth.authorized) return auth.response;
	try {
		const body = (await request.json().catch(() => null)) as { epostaIleHaber?: unknown } | null;
		if (typeof body?.epostaIleHaber !== 'boolean') return NextResponse.json({ error: 'Geçersiz değer.' }, { status: 400 });
		await setMailEmailSetting(auth.user.id, body.epostaIleHaber);
		return NextResponse.json({ epostaIleHaber: body.epostaIleHaber });
	} catch (error) {
		console.error('API /api/posta/ayarlar PATCH error:', error);
		return NextResponse.json({ error: 'Ayar kaydedilemedi.' }, { status: 500 });
	}
}

export const PATCH = withAudit(handlePATCH, { action: 'posta.ayarlar.update', target: 'posta.ayarlar' });
