import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createMockRequest, teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

test('language: users default to English and mail follows the stored preference', async () => {
	const { ensurePostgresInit, getPgPool } = await import('../../src/db/index.ts');
	const { createUser, getUserById } = await import('../../src/db/index.ts');
	const { getLang, formatMailText } = await import('../../src/lib/mail/notifications/transport.ts');
	await ensurePostgresInit();
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
	const email = `language-probe-${suffix}@example.test`;

	const created = await createUser({
		name: 'Language',
		surname: 'Probe',
		email,
		passwordHash: 'x',
		handle: `LANG-${suffix}`,
		department: '',
		status: 'active',
	});
	try {
		const stored = await getUserById(created.id);
		assert.equal(stored?.preferredLanguage, 'en', 'a new account without an explicit choice is English');

		await getPgPool().query('UPDATE users SET preferred_language = $1 WHERE id = $2', ['tr', created.id]);
		const turkish = await getUserById(created.id);
		assert.equal(turkish?.preferredLanguage, 'tr', 'the stored preference is read back');

		assert.equal(getLang({ email }), 'en', 'mail without a preference is English');
		assert.equal(getLang({ email, preferredLanguage: 'tr' }), 'tr', 'mail uses the Turkish preference');
		assert.match(formatMailText('en', 'mailVerifySubject', { code: '123456', clubName: 'Orbit' }), /123456/);
		assert.notEqual(
			formatMailText('en', 'mailVerifySubject', { code: '123456', clubName: 'Orbit' }),
			formatMailText('tr', 'mailVerifySubject', { code: '123456', clubName: 'Orbit' }),
			'English and Turkish mail templates differ'
		);
		assert.ok(createMockRequest, 'test helper available');
	} finally {
		await getPgPool().query('DELETE FROM users WHERE id = $1', [created.id]);
	}
});
