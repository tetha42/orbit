import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { executeSoarPlaybook } from '@/server/security/soarPlaybooks';
import type { SoarPlaybookId } from '@/apps/soc/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handlePOST(request: Request) {
	try {
		const auth = await requireApp(request, 'soc', 'yonet');
		if (!auth.authorized) return auth.response;

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== 'object') {
			return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
		}

		const playbookId = body.playbookId as SoarPlaybookId;
		const validPlaybooks: SoarPlaybookId[] = [
			'brute-force-containment',
			'compromised-account-isolation',
			'webshell-quarantine',
		];

		if (!validPlaybooks.includes(playbookId)) {
			return NextResponse.json(
				{ error: `Bilinmeyen SOAR playbook ID: ${String(playbookId)}` },
				{ status: 400 }
			);
		}

		const target = body.target || {};
		const result = await executeSoarPlaybook(playbookId, {
			ip: target.ip,
			userId: target.userId,
			path: target.path,
			incidentId: target.incidentId,
			analystId: auth.user.id,
		});

		if (!result.success) {
			return NextResponse.json(
				{ error: result.error || 'Playbook çalıştırılırken bir hata oluştu.', result },
				{ status: 500 }
			);
		}

		return NextResponse.json({ ok: true, result });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ error: `Sunucu hatası: ${msg}` }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'soc.playbooks.create', target: 'soc.playbooks' });
