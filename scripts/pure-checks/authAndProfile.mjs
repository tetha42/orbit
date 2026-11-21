import assert from 'node:assert/strict';
import { level, passwordProblem } from '../../src/lib/profile.ts';
import { badges } from '../../src/lib/badges.ts';
import { documentCount, documentVerificationCode } from '../../src/lib/documents.ts';
import { escapeHtml } from '../../src/core/text/escape.ts';
import { initials } from '../../src/core/text/initials.ts';
import {
	ADMIN_ROLE_ID,
	ALL_PERMISSIONS,
	PERMISSION_APPS,
	PERMISSION_DESCRIPTIONS,
	canAssignRole,
	canManage,
	canUse,
	extraPermissions,
	hasManagementPermission,
	levelOf,
	normalizePermissions,
	roleProblem,
} from '../../src/core/permissions/index.ts';
import { NOTIFICATION_KINDS } from '../../src/core/notifications/kinds.ts';
import { ALL_MANIFESTS, DEFAULT_DOCK_ORDER, WINDOW_MANIFESTS, appColor } from '../../src/apps/index.ts';
import { check } from './runner.mjs';

export function runAuthAndProfileChecks() {
	check('password rules', () => {
		assert.equal(passwordProblem('Kampus-2026x'), null);
		assert.match(passwordProblem('Password123'), /most commonly leaked/);
		assert.match(passwordProblem('12345678a'), /most commonly leaked/);
		assert.match(passwordProblem('abc1'), /at least 8/);
		assert.match(passwordProblem('lettersonly'), /one letter and one digit/);
		assert.match(passwordProblem('12345678'), /one letter and one digit/);
		assert.match(passwordProblem('Campus-pass-2026', { current: 'Campus-pass-2026' }), /same as the current/);
		assert.match(passwordProblem('burak.sahin99', { email: 'burak.sahin@beuteknoloji.org' }), /e-mail address/);
		assert.equal(passwordProblem('Ab1xxxxx', { email: 'ab@x.org' }), null); // a 2-letter local part is not checked
		assert.match(passwordProblem(null), /required/);
		assert.match(passwordProblem('a1'.repeat(70)), /at most/);
	});

	check('levels from XP', () => {
		assert.deepEqual(level(0), { level: 1, progress: 0, next: 100 });
		assert.equal(level(99).level, 1);
		assert.equal(level(100).level, 2);
		assert.equal(level(299).level, 2);
		assert.equal(level(300).level, 3);
		assert.equal(level(820).level, 4);
		assert.equal(level(820).next, 1000);
		assert.equal(level(-50).level, 1);
	});

	check('badges follow the record, earned first, progress capped', () => {
		const none = badges({ xp: 0, team: 0, captain: false, attendedEvent: 0, completedTask: 0, certificate: 0, project: 0 });
		assert.equal(none.length, 8);
		assert.equal(none.filter((r) => r.earned).length, 0);
		const some = badges({ xp: 1850, team: 2, captain: true, attendedEvent: 7, completedTask: 3, certificate: 0, project: 1 });
		const byId = Object.fromEntries(some.map((r) => [r.id, r]));
		assert.ok(byId['first-step'].earned && byId['regular'].earned && byId['captain'].earned && byId['star'].earned);
		assert.ok(!byId['task-hunter'].earned && byId['task-hunter'].value === 3);
		assert.equal(byId['regular'].value, 5); // capped at the target
		const firstLocked = some.findIndex((r) => !r.earned);
		assert.ok(some.slice(firstLocked).every((r) => !r.earned), 'earned badges come first');
		assert.equal(some[firstLocked].id, 'task-hunter'); // closest to being earned (3/10 beats 0/1)
	});

	check('document numbers print as year/sequence', () => {
		assert.equal(documentCount(2026005), '2026/005');
		assert.equal(documentCount(2026123), '2026/123');
		assert.equal(documentCount(1999001), '1999/001');
		assert.equal(documentCount(42), '42'); // outside the scheme: as is
		assert.equal(documentCount(Number.NaN), '');
		assert.equal(documentVerificationCode(2026005), 'ORBIT-DOC-2026005');
	});

	check('core text helpers', () => {
		assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
		assert.equal(escapeHtml(null), '');
		assert.equal(initials('Ay\u015fe Nur Y\u0131lmaz'), 'AY');
		assert.equal(initials('ilker'), '\u0130');
		assert.equal(initials(''), '?');
	});

	check('permissions: levels, defaults, escalation, validation', () => {
		const member = { news: 'use', events: 'use' };
		assert.equal(canUse(member, 'news'), true);
		assert.equal(canManage(member, 'news'), false);
		assert.equal(canUse(member, 'budget'), false);
		assert.equal(canUse(null, 'budget'), false);
		assert.equal(canUse({}, 'settings'), true); // personal settings for everyone
		assert.equal(canManage({}, 'settings'), false);
		assert.equal(levelOf(member, 'nonexistent'), 'none');
		for (const a of PERMISSION_APPS) {
			assert.equal(canManage(ALL_PERMISSIONS, a), true, a);
			assert.ok(PERMISSION_DESCRIPTIONS[a]?.use && PERMISSION_DESCRIPTIONS[a]?.manage, `description for ${a}`);
		}
		assert.deepEqual(extraPermissions({ news: 'manage', events: 'use' }, member), ['news']);
		assert.deepEqual(extraPermissions(member, ALL_PERMISSIONS), []);
		assert.deepEqual(extraPermissions({ settings: 'use' }, {}), []); // implicit level is not an escalation
		assert.equal(hasManagementPermission(member), false);
		assert.equal(hasManagementPermission({ notes: 'manage' }), false);
		assert.equal(hasManagementPermission({ events: 'manage' }), true);
		assert.deepEqual(normalizePermissions({ news: 'use', budget: 'none' }).value, { news: 'use' });
		assert.ok(normalizePermissions({ hack: 'manage' }).error);
		assert.ok(normalizePermissions({ news: 'admin' }).error);
		assert.ok(normalizePermissions([]).error);
		assert.equal(roleProblem({ name: 'Y\u00f6netim Kurulu', color: '#ff9f0a' }), null);
		assert.ok(roleProblem({ name: 'Y', color: '#ff9f0a' }));
		assert.ok(roleProblem({ name: 'Y\u00f6netim', color: 'red' }));
	});

	check('permissions: who may hand out which role', () => {
		const admin = { admin: true, permissions: ALL_PERMISSIONS };
		const board = { admin: false, permissions: { ...ALL_PERMISSIONS } };
		const secretary = { admin: false, permissions: { members: 'manage', news: 'use' } };
		const reporter = { id: 'role_h', permissions: { news: 'use' } };
		// The admin role: only an admin, even for someone holding every permission.
		assert.equal(canAssignRole({ id: ADMIN_ROLE_ID, permissions: ALL_PERMISSIONS }, admin), true);
		assert.equal(canAssignRole({ id: ADMIN_ROLE_ID, permissions: ALL_PERMISSIONS }, board), false);
		// Equal or weaker: yes. Stronger in any app: no.
		assert.equal(canAssignRole(reporter, secretary), true);
		assert.equal(canAssignRole({ id: 'role_k', permissions: ALL_PERMISSIONS }, board), true);
		assert.equal(canAssignRole({ id: 'role_x', permissions: { news: 'manage' } }, secretary), false);
		assert.equal(canAssignRole({ id: 'role_y', permissions: { budget: 'use' } }, secretary), false);
		assert.equal(canAssignRole({ id: 'role_bos', permissions: {} }, secretary), true);
	});

	check('apps: manifests are consistent', () => {
		const ids = ALL_MANIFESTS.map((m) => m.id);
		assert.equal(new Set(ids).size, ids.length, 'unique ids');
		const permissionIds = ALL_MANIFESTS.filter((m) => !('internal' in m && m.internal)).map((m) => m.id);
		assert.deepEqual([...PERMISSION_APPS], permissionIds, 'the role editor lists every user-facing manifest, in order');
		assert.ok(!PERMISSION_APPS.includes('mediaviewer'), 'internal media window is not a role permission');
		assert.ok(
			ALL_MANIFESTS.some((m) => m.id === 'mediaviewer' && 'internal' in m && m.internal),
			'the media window exists as an internal manifest'
		);
		for (const m of WINDOW_MANIFESTS) {
			assert.ok(m.window.width >= (m.window.minWidth ?? 0) && m.window.height >= (m.window.minHeight ?? 0), `${m.id}: window smaller than its minimum`);
			assert.ok(m.en.title && m.en.shortTitle && m.en.description, `${m.id}: English texts`);
			assert.match(appColor(m.id), /^#[0-9a-f]{6}$/i, `${m.id}: colour`);
		}
		assert.deepEqual([...DEFAULT_DOCK_ORDER].sort(), WINDOW_MANIFESTS.map((m) => m.id).sort(), 'every window app is in the default dock');
		// Menu item ids carry translations and special actions: one id, one meaning.
		const seen = new Map();
		for (const m of WINDOW_MANIFESTS) {
			const items = [m.menu?.about, ...(m.menu?.defaultItems ?? []), ...(m.menu?.categories ?? []).flatMap((c) => c.items)].filter(Boolean);
			for (const item of items) {
				assert.ok(item.label.tr && item.label.en, `${m.id}/${item.id}: both languages`);
				const key = JSON.stringify([item.label, item.shortcut ?? null]);
				if (seen.has(item.id)) assert.equal(seen.get(item.id).key, key, `menu item "${item.id}" differs between ${seen.get(item.id).app} and ${m.id}`);
				else seen.set(item.id, { key, app: m.id });
			}
		}
		const hotkeys = WINDOW_MANIFESTS.map((m) => m.hotkey).filter(Boolean);
		assert.equal(new Set(hotkeys).size, hotkeys.length, 'unique hotkeys');
	});

	check('notifications: every kind belongs to a permission app', () => {
		const kinds = ['approval', 'projectProposal', 'teamApplication', 'teamDecision', 'task', 'assigned', 'loan', 'checkin', 'event', 'news', 'certificate', 'message'];
		assert.deepEqual(Object.keys(NOTIFICATION_KINDS).sort(), [...kinds].sort());
		for (const [kind, rule] of Object.entries(NOTIFICATION_KINDS)) {
			assert.ok(PERMISSION_APPS.includes(rule.appId), `${kind} -> ${rule.appId}`);
			assert.ok(rule.level === 'use' || rule.level === 'manage', kind);
		}
		// Only-news role: news and always-open chat messages pass; the admin's permissions pass every kind.
		const only = Object.entries(NOTIFICATION_KINDS).filter(([, r]) => (r.level === 'manage' ? canManage : canUse)({ news: 'use' }, r.appId)).map(([k]) => k);
		assert.deepEqual(only.sort(), ['message', 'news']);
		assert.equal(Object.values(NOTIFICATION_KINDS).every((r) => canManage(ALL_PERMISSIONS, r.appId)), true);
	});
}
