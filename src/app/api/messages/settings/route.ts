import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { getMailEmailSetting, setMailEmailSetting } from '@/db/messages';
import { requireApp } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

/** The caller's own Mail preference: also be told by e-mail when a message arrives. */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'mail', 'use');
	if (!auth.authorized) return auth.response;
	try {
		const setting = await getMailEmailSetting(auth.user.id);
		return NextResponse.json({ notifyByEmail: setting, emailWithNews: setting }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		console.error('API /api/messages/settings GET error:', error);
		return NextResponse.json({ error: 'Failed to load setting.' }, { status: 500 });
	}
}

async function handlePATCH(request: Request) {
	const auth = await requireApp(request, 'mail', 'use');
	if (!auth.authorized) return auth.response;
	try {
		const body = (await request.json().catch(() => null)) as { notifyByEmail?: unknown; emailWithNews?: unknown } | null;
		const rawValue = body?.notifyByEmail !== undefined ? body.notifyByEmail : body?.emailWithNews;
		if (typeof rawValue !== 'boolean') return NextResponse.json({ error: 'Invalid value.' }, { status: 400 });
		await setMailEmailSetting(auth.user.id, rawValue);
		return NextResponse.json({ notifyByEmail: rawValue, emailWithNews: rawValue });
	} catch (error) {
		console.error('API /api/messages/settings PATCH error:', error);
		return NextResponse.json({ error: 'Failed to save setting.' }, { status: 500 });
	}
}

export const PATCH = withAudit(handlePATCH, { action: 'messages.settings.update', target: 'messages.settings' });
