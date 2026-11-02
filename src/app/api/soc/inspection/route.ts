import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { canManage } from '@/core/permissions';
import {
	runFimScan,
	runApiSecurityScan,
	probeSingleRoute,
	generateExecutiveAuditReport,
	getFimFileDiff,
} from '@/db/repositories/inspection.repo';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'soc', 'kullan');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);

	if (searchParams.get('action') === 'diff') {
		const filePath = searchParams.get('path') || '';
		const diff = await getFimFileDiff(filePath);
		return NextResponse.json({ diff });
	}

	const target = searchParams.get('target') || 'repo';
	const force = searchParams.get('refresh') === 'true';

	const url = new URL(request.url);
	const baseUrl = `${url.protocol}//${url.host}`;

	try {
		const [fim, appSec] = await Promise.all([
			runFimScan(target, { force }),
			runApiSecurityScan(baseUrl, { force }),
		]);

		const targets = [
			{ id: 'repo', label: 'Repo Kodları (src/, scripts/, configs/)' },
			{ id: 'uploads', label: 'Yüklemeler (data/uploads/)' },
			{ id: 'tmp', label: 'Geçici Dizin (/tmp/)' },
		];

		return NextResponse.json({
			fim,
			appSec,
			targets,
			activeTarget: target,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Teftiş telemetrisi alınamadı.';
		const status = message.includes('Erişim reddedildi') ? 400 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'soc', 'kullan');
	if (!auth.authorized) return auth.response;

	const url = new URL(request.url);
	const baseUrl = `${url.protocol}//${url.host}`;

	try {
		const body = await request.json().catch(() => ({}));
		const action = String(body.action || '').trim();

		if (action === 'scan_fim') {
			const target = String(body.target || 'repo');
			const result = await runFimScan(target, { force: true });
			return NextResponse.json({ fim: result });
		}

		if (action === 'scan_api') {
			const summary = await runApiSecurityScan(baseUrl, { force: true });
			return NextResponse.json({ appSec: summary });
		}

		if (action === 'create_baseline') {
			const isManager = canManage(auth.user.permission?.izinler, 'soc') || auth.user.roleId === 'rol_admin';
			if (!isManager) {
				return NextResponse.json(
					{ error: 'Bütünlük başlangıç profili (baseline) oluşturmak için yönetici yetkisi gereklidir.' },
					{ status: 403 }
				);
			}

			const target = String(body.target || 'repo');
			const result = await runFimScan(target, { force: true, saveBaseline: true });
			return NextResponse.json({ fim: result, baselineSaved: true });
		}

		if (action === 'probe_route') {
			const endpoint = String(body.endpoint || '').trim();
			if (!endpoint) {
				return NextResponse.json({ error: 'Endpoint parametresi zorunludur.' }, { status: 400 });
			}
			const report = await probeSingleRoute(baseUrl, endpoint);
			return NextResponse.json({ success: true, route: report });
		}

		if (action === 'generate_report') {
			const report = await generateExecutiveAuditReport(baseUrl);
			const fileName = `soc-audit-report-${new Date().toISOString().slice(0, 10)}.md`;
			return NextResponse.json({ success: true, report, reportMarkdown: report, fileName });
		}

		if (action === 'fim_diff') {
			const path = String(body.path || '').trim();
			if (!path) {
				return NextResponse.json({ error: 'Dosya yolu zorunludur.' }, { status: 400 });
			}
			const diff = await getFimFileDiff(path);
			return NextResponse.json({ diff });
		}

		return NextResponse.json({ error: `Bilinmeyen işlem eylemi: ${action}` }, { status: 400 });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Teftiş işlemi başarısız oldu.';
		const status = message.includes('Erişim reddedildi') ? 400 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export const POST = withAudit(handlePOST, { action: 'soc.inspection.create', target: 'soc.inspection' });
