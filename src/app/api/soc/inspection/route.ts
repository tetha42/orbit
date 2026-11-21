import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { canManage } from '@/core/permissions';
import { checkSecurityGuardHealth } from '@/server/security/securityGuardClient';
import {
	runFimScan,
	runApiSecurityScan,
	probeSingleRoute,
	generateExecutiveAuditReport,
	getFimFileDiff,
} from '@/db/repositories/inspection.repo';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'soc', 'use');
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
		const [fim, appSec, securityGuard] = await Promise.all([
			runFimScan(target, { force }),
			runApiSecurityScan(baseUrl, { force }),
			checkSecurityGuardHealth(),
		]);

		const targets = [
			{ id: 'repo', label: 'Repo Code (src/, scripts/, configs/)' },
			{ id: 'uploads', label: 'Uploads (data/uploads/)' },
			{ id: 'tmp', label: 'Temporary Directory (/tmp/)' },
		];

		return NextResponse.json({
			fim,
			appSec,
			securityGuard,
			targets,
			activeTarget: target,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Inspection telemetry could not be retrieved.';
		const status = message.includes('Access denied') ? 400 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'soc', 'use');
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
			const isManager = canManage(auth.user.permission?.permissions, 'soc') || auth.user.roleId === 'role_admin';
			if (!isManager) {
				return NextResponse.json(
					{ error: 'Manager permissions are required to create an integrity baseline.' },
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
				return NextResponse.json({ error: 'Endpoint parameter is required.' }, { status: 400 });
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
				return NextResponse.json({ error: 'File path is required.' }, { status: 400 });
			}
			const diff = await getFimFileDiff(path);
			return NextResponse.json({ diff });
		}

		return NextResponse.json({ error: `Unknown inspection action: ${action}` }, { status: 400 });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Inspection action failed.';
		const status = message.includes('Access denied') ? 400 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}

export const POST = withAudit(handlePOST, { action: 'soc.inspection.create', target: 'soc.inspection' });
