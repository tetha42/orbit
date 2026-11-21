import assert from 'node:assert/strict';
import {
	categoryDistribution,
	filterRecords,
	formatMinor,
	isValidDate,
	monthlyFeed,
	parseAmount,
	runningBalance,
} from '../../src/lib/budget.ts';
import {
	codeProblem,
	endOfDay,
	normalizeCode,
	returnDateProblem,
	returnStatus,
	returnText,
} from '../../src/lib/inventory.ts';
import { MAIL_ACTIONS, MAIL_FOLDERS, previewRow, skippedReason } from '../../src/lib/messages.ts';
import { NOTIFICATION_KINDS } from '../../src/core/notifications/kinds.ts';
import {
	AUDIT_ACTIONS,
	AUDIT_CSV_HEADERS,
	AUDIT_RETENTION_DAYS,
	auditCsvRows,
	cleanIp,
	clear,
	diffRows,
	fieldDiff,
	formatAuditAction,
	memberSummary,
	memberTargetName,
	parseAuditFilter,
	recordFields,
	retentionDays,
	roleDiff,
	roleSummary,
	smtpDiff,
	statusAction,
} from '../../src/lib/audit.ts';
import { isPrivateHost } from '../../src/lib/mail/hosts.ts';
import { toCsv } from '../../src/lib/events.ts';
import { check } from './runner.mjs';

export function runBudgetAndMailChecks() {
	check('amounts typed in Turkish or English style', () => {
		assert.equal(parseAmount('1.234,56'), 123456);
		assert.equal(parseAmount('1234,56'), 123456);
		assert.equal(parseAmount('1234.56'), 123456);
		assert.equal(parseAmount('1,234.56'), 123456);
		assert.equal(parseAmount('1.234'), 123400); // a thousands group, not 1.234 lira
		assert.equal(parseAmount('1,5'), 150);
		assert.equal(parseAmount('₺ 12'), 1200);
		assert.equal(parseAmount('1 234,5'), 123450);
		assert.equal(parseAmount('1.234.567,89'), 123456789);
		for (const bad of ['', 'abc', '-5', '0', '0,00', '12,', '12.3456', '1e5', '1..2', '12,34,56'])
			assert.equal(parseAmount(bad), null, bad);
		assert.equal(formatMinor(123456789), '1.234.567,89');
		assert.equal(formatMinor(5), '0,05');
		assert.equal(formatMinor(-150000), '-1.500,00');
	});

	check('ledger: running balance, categories, months, filters', () => {
		const t = (s) => new Date(s).getTime();
		const rows = [
			{ id: 'c', date: t('2026-09-06T10:00'), typeValue: 'expense', category: 'hardware', amountMinor: 890000, description: 'Raspberry Pi', recorderNameSurname: 'Mehmet Demir' },
			{ id: 'a', date: t('2026-08-22T10:00'), typeValue: 'income', category: 'sponsorship', amountMinor: 3500000, description: 'Sponsor' },
			{ id: 'd', date: t('2026-10-01T10:00'), typeValue: 'expense', category: 'catering', amountMinor: 115000, description: '\u00c7ay, kahve' },
			{ id: 'e', date: t('2026-10-04T10:00'), typeValue: 'expense', category: 'hardware', amountMinor: 165000, description: 'Filament' },
		];
		const b = runningBalance(rows);
		assert.deepEqual([b.get('a'), b.get('c'), b.get('d'), b.get('e')], [3500000, 2610000, 2495000, 2330000]);
		const distribution = categoryDistribution(rows);
		assert.deepEqual(distribution.map((d) => d.category), ['hardware', 'catering']);
		assert.equal(distribution[0].amountMinor, 1055000);
		assert.ok(Math.abs(distribution[0].ratio + distribution[1].ratio - 1) < 1e-9);
		const month = monthlyFeed(rows, t('2026-10-06T00:30'), 3);
		assert.deepEqual(month.map((m) => m.month), ['2026-08', '2026-09', '2026-10']);
		assert.deepEqual(month.map((m) => [m.income, m.expense]), [[3500000, 0], [0, 890000], [0, 280000]]);
		assert.deepEqual(monthlyFeed(rows, t('2026-01-15T00:00'), 2).map((m) => m.month), ['2025-12', '2026-01']); // across a year
		const fold = (s) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0131/g, 'i');
		assert.deepEqual(filterRecords(rows, { typeValue: 'expense', month: '2026-10' }).map((r) => r.id), ['d', 'e']);
		assert.deepEqual(filterRecords(rows, { search: 'CAY', fold }).map((r) => r.id), ['d']);
		assert.deepEqual(filterRecords(rows, { search: 'mehmet', fold }).map((r) => r.id), ['c']);
		assert.deepEqual(filterRecords(rows, { category: 'hardware' }).map((r) => r.id), ['c', 'e']);
		const now = t('2026-10-06T00:30');
		assert.ok(isValidDate(now, now) && isValidDate(t('2025-01-01'), now));
		assert.ok(!isValidDate(now + 3 * 86_400_000, now) && !isValidDate(t('2020-01-01'), now) && !isValidDate(NaN, now));
	});

	check('inventory codes, loan windows and due text', () => {
		assert.equal(normalizeCode(' lab rpi 006 '), 'LAB-RPI-006');
		assert.equal(codeProblem('LAB-RPI-006'), null);
		assert.ok(codeProblem('LAB_RPI') && codeProblem('AB') && codeProblem('-LAB') && codeProblem('LAB--X') && codeProblem('A'.repeat(25)));
		const DAY = 86_400_000;
		const now = new Date('2026-10-06T10:00').getTime();
		assert.deepEqual(returnStatus(now + 5 * DAY + 1000, now), { overdue: false, day: 5 });
		assert.deepEqual(returnStatus(now + 3600_000, now), { overdue: false, day: 0 });
		assert.deepEqual(returnStatus(now - 1000, now), { overdue: true, day: 1 });
		assert.deepEqual(returnStatus(now - 2.5 * DAY, now), { overdue: true, day: 2 });
		assert.deepEqual(returnStatus(now - 3 * DAY - 3600_000, now), { overdue: true, day: 3 });
		assert.equal(returnStatus(null, now), null);
		assert.equal(returnText(now - 2.5 * DAY, now), '2 g\u00fcn gecikti');
		assert.equal(returnText(now + 3600_000, now), 'Bug\u00fcn iade');
		assert.equal(returnText(now + 1.5 * DAY, now), 'Yar\u0131n iade');
		assert.equal(returnText(now + 9.2 * DAY, now), '9 g\u00fcn kald\u0131');
		// windows
		assert.equal(returnDateProblem(now + 14 * DAY, { now, management: false }), null);
		assert.ok(returnDateProblem(now + 45 * DAY, { now, management: false }));
		assert.equal(returnDateProblem(now + 45 * DAY, { now, management: true }), null);
		assert.ok(returnDateProblem(now - DAY, { now, management: true }));
		assert.ok(returnDateProblem(Number.NaN, { now, management: true }));
		// extending: counted from when the loan started, not from now
		const started = now - 20 * DAY;
		assert.equal(returnDateProblem(now + 9 * DAY, { now, start: started, management: false }), null);
		assert.ok(returnDateProblem(now + 12 * DAY, { now, start: started, management: false }));
		const end = new Date(endOfDay(now));
		assert.deepEqual([end.getHours(), end.getMinutes(), end.getDate()], [23, 59, 6]);
	});

	check('mail: previews, skipped-recipient wording, folders and actions', () => {
		assert.equal(previewRow('  Hello\n\n world  '), 'Hello world');
		assert.equal(previewRow('x'.repeat(200), 10), `${'x'.repeat(9)}…`);
		assert.match(skippedReason({ id: '1', name: 'Alex Taylor', reason: 'role' }), /role does not open Mail/);
		assert.match(skippedReason({ id: '1', name: 'Alex Taylor', reason: 'inactive' }), /no longer an active member/);
		assert.deepEqual([...MAIL_FOLDERS], ['inbox', 'sent', 'archived', 'trash']);
		assert.equal(new Set(MAIL_ACTIONS).size, MAIL_ACTIONS.length);
		assert.equal(NOTIFICATION_KINDS.message.appId, 'chat');
		assert.equal(NOTIFICATION_KINDS.message.level, 'use');
	});

	const NEVER = /pass|parola|password|hash|totp|secret|token|recovery|kurtarma|cookie|oturum/i;

	check('audit: credential-looking keys never survive clear / recordFields', () => {
		const dirty = {
			name: 'Alex',
			passwordHash: '$2b$10$abc',
			nested: { totpSecret: 'JBSWY3DP', activeSessionToken: 'tok', recoveryCodes: ['a'], good: 1 },
			smtp_pass: 'cipher',
			list: [{ password: 'x', ok: true }],
		};
		const out = clear(dirty);
		assert.deepEqual(out, { name: 'Alex', nested: { good: 1 }, list: [{ ok: true }] });
		assert.equal(NEVER.test(JSON.stringify(out)), false);
		assert.equal(recordFields(null), null);
		assert.deepEqual(recordFields({ token: 'x', a: 1 }), { a: 1 });
		assert.equal(clear('x'.repeat(1000)).length, 301);
		assert.equal(clear(NaN), null);
	});

	check('audit: roleSummary keeps a white-list and drops "none" rows; roleDiff lists only changes', () => {
		const raw = { name: 'Board', color: '#fff', description: null, twoStepRequired: 1, permissions: { budget: 'none', news: 'use', events: 'manage' }, passwordHash: 'x', id: 'role_1' };
		const o = roleSummary(raw);
		assert.deepEqual(Object.keys(o).sort(), ['color', 'description', 'name', 'permissions', 'twoStepRequired']);
		assert.deepEqual(o.permissions, { events: 'manage', news: 'use' });
		assert.equal(o.twoStepRequired, true);
		assert.equal(roleDiff(o, roleSummary(raw)), null);
		const fresh = roleSummary({ ...raw, name: 'Management', permissions: { budget: 'manage', news: 'use' } });
		assert.deepEqual(roleDiff(o, fresh), {
			before: { name: 'Board', permissions: { budget: 'none', events: 'manage' } },
			after: { name: 'Management', permissions: { budget: 'manage', events: 'none' } },
		});
	});

	check('audit: memberSummary is name + e-mail (+ status/role), never anything else', () => {
		const u = memberSummary({ name: 'Sam', surname: 'Lee', email: 's@l.test', passwordHash: 'h', totpSecret: 's', activeSessionToken: 't', status: 'active' });
		assert.deepEqual(u, { name: 'Sam Lee', email: 's@l.test', status: 'active' });
		assert.equal(memberTargetName({ name: 'Sam', surname: 'Lee', email: 's@l.test' }), 'Sam Lee (s@l.test)');
	});

	check('audit: fieldDiff / diffRows', () => {
		assert.equal(fieldDiff({ a: 1, b: 2 }, { a: 1, b: 2 }), null);
		assert.deepEqual(fieldDiff({ status: 'pending', roleId: null }, { status: 'active', roleId: 'role_member' }), {
			before: { status: 'pending', roleId: null },
			after: { status: 'active', roleId: 'role_member' },
		});
		const rows = diffRows({ name: 'A', permissions: { budget: 'none' } }, { name: 'B', permissions: { budget: 'manage' } });
		assert.deepEqual(rows, [
			{ field: 'name', before: 'A', after: 'B' },
			{ field: 'permissions.budget', before: 'none', after: 'manage' },
		]);
		assert.deepEqual(diffRows(null, { a: true }), [{ field: 'a', before: null, after: true }]);
	});

	check('audit: smtpDiff never carries the password, only that it changed', () => {
		const defaultValue = { smtp_host: 'smtp.gmail.com', smtp_port: '465', smtp_secure: 'true', smtp_user: '', smtp_from: 'C <c@x.test>' };
		const fresh = { smtp_host: 'smtp.gmail.com', smtp_port: '465', smtp_secure: 'true', smtp_user: 'club@x.test', smtp_from: 'C <c@x.test>', smtp_pass: 'enc:v1:SECRET-CIPHER-VALUE' };
		const f = smtpDiff({}, fresh, defaultValue);
		assert.deepEqual(f, { before: { smtp_user: '', appKey: 'none' }, after: { smtp_user: 'club@x.test', appKey: 'changed' } });
		assert.equal(JSON.stringify(f).includes('SECRET'), false);
		assert.equal(smtpDiff({ smtp_user: 'club@x.test' }, { smtp_user: 'club@x.test', smtp_pass: '' }, defaultValue), null);
		assert.deepEqual(smtpDiff({ smtp_pass: 'enc' }, { smtp_pass: '' }, defaultValue), { before: { appKey: 'set' }, after: { appKey: 'deleted' } });
		assert.deepEqual(smtpDiff({}, { smtp_port: '587' }, defaultValue), { before: { smtp_port: '465' }, after: { smtp_port: '587' } });
	});

	check('smtp test: private hosts are recognised, public ones are not', () => {
		for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.0.9', '172.20.0.1', '169.254.169.254', '[::1]', ' LOCALHOST ', '::ffff:127.0.0.1', 'app.internal', 'mybox.local', '0177.0.0.1', 'metadata.google.internal', 'srv.lan']) assert.equal(isPrivateHost(h), true, h);
		for (const h of ['smtp.gmail.com', 'mail.example.org', '8.8.8.8', '172.32.0.1']) assert.equal(isPrivateHost(h), false, h);
	});

	check('audit: smtpDiff ignores keys it no longer tracks (old imap_* rows), still never the password', () => {
		const defaultValue = { smtp_host: '', smtp_port: '465', smtp_secure: 'true', smtp_user: '', smtp_from: '' };
		const f = smtpDiff({}, { ...defaultValue, imap_host: 'imap.legacy.test', smtp_pass: 'enc:v1:SECRET' }, defaultValue);
		assert.deepEqual(f, { before: { appKey: 'none' }, after: { appKey: 'changed' } });
		assert.equal(JSON.stringify(f).includes('SECRET'), false);
		assert.equal(smtpDiff({ imap_host: 'a' }, { imap_host: 'b', imap_secure: 'false' }, defaultValue), null);
	});

	check('audit: statusAction names the status change', () => {
		assert.equal(statusAction('pending', 'active'), 'application.approve');
		assert.equal(statusAction('pending', 'rejected'), 'application.reject');
		assert.equal(statusAction('active', 'alumni'), 'member.graduate');
		assert.equal(statusAction('alumni', 'active'), 'member.activate');
		assert.equal(statusAction('active', 'pending'), 'member.status');
		assert.equal(statusAction('active', 'active'), null);
		for (const op of ['application.approve', 'application.reject', 'member.graduate', 'member.activate', 'member.status']) assert.ok(AUDIT_ACTIONS.includes(op), op);
	});

	check('audit: parseAuditFilter bounds the query, cleanIp the address, retentionDays the retention', () => {
		const f = parseAuditFilter(new URLSearchParams('user=%20alex%20&role=role_x&action=role.delete&from=2026-01-05&to=2026-02-31x&page=-3&pageSize=99999'));
		assert.equal(f.user, 'alex');
		assert.equal(f.role, 'role_x');
		assert.equal(f.action, 'role.delete');
		assert.equal(f.from, '2026-01-05');
		assert.equal(f.to, '');
		assert.equal(f.page, 1);
		assert.equal(f.pageSize, 200);
		assert.equal(parseAuditFilter(new URLSearchParams('action=DROP')).action, '');
		assert.equal(parseAuditFilter(new URLSearchParams('')).pageSize, 50);
		assert.equal(cleanIp('203.0.113.7'), '203.0.113.7');
		assert.equal(cleanIp('1.2.3.4\r\nX-Evil: 1'), '1.2.3.4X-Evil:1');
		assert.equal(cleanIp('a'.repeat(500)).length, 64);
		assert.equal(cleanIp(''), 'unknown');
		assert.equal(retentionDays(undefined), AUDIT_RETENTION_DAYS);
		assert.equal(AUDIT_RETENTION_DAYS, 730);
		assert.equal(retentionDays('365'), 365);
		assert.equal(retentionDays('3'), AUDIT_RETENTION_DAYS);
		assert.equal(retentionDays('abc'), AUDIT_RETENTION_DAYS);
	});

	check('audit: CSV rows are flat, formula-safe through toCsv, one column per header', () => {
		const registration = { id: '1', timestamp: Date.UTC(2026, 0, 2, 3, 4, 5), actorId: 'u1', actorName: '=cmd|x', action: 'role.delete', targetType: 'role', targetId: 'role_1', targetName: 'Member; "Board"', before: { name: 'A' }, after: null, ip: '10.0.0.1' };
		const rows = auditCsvRows([registration]);
		assert.equal(rows.length, 1);
		assert.equal(rows[0].length, AUDIT_CSV_HEADERS.length);
		assert.equal(rows[0][0], '2026-01-02T03:04:05.000Z');
		assert.equal(rows[0][7], '{"name":"A"}');
		assert.equal(rows[0][8], '');
		const csv = toCsv(AUDIT_CSV_HEADERS, rows);
		assert.ok(csv.includes("'=cmd|x"), 'formula neutralised');
		assert.ok(csv.includes('"Member; ""Board"""'));
	});

	check('formatAuditAction: humanizes action strings when untranslated', () => {
		assert.equal(formatAuditAction('profile.workspace.update'), 'Profile Workspace Update');
		assert.equal(formatAuditAction('notes_create'), 'Notes Create');
		assert.equal(formatAuditAction(''), '—');
		assert.equal(formatAuditAction('role.create', (k) => k === 'auditOp_role_create' ? 'Role created' : k), 'Role created');
	});
}
