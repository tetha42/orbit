import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

test('setup auto-detect: stores candidate URLs server-side by ID and returns null for unknown IDs', async () => {
	const {
		clearDetectedCandidates,
		getDetectedCandidateUrl,
		rememberDetectedCandidate,
	} = await import('../../src/app/api/setup/auto-detect/dockerDetect.ts');

	clearDetectedCandidates();
	const sampleUrl = 'postgresql://orbit:secret@127.0.0.1:5432/orbit';
	rememberDetectedCandidate('docker:orbit-postgres', sampleUrl);

	assert.equal(getDetectedCandidateUrl('docker:orbit-postgres'), sampleUrl);
	assert.equal(getDetectedCandidateUrl('docker:missing'), null);

	clearDetectedCandidates();
	assert.equal(getDetectedCandidateUrl('docker:orbit-postgres'), null);
});

test('security rules cache: offline database backoff catches init errors with zero unhandled rejections', async () => {
	const { globalForPg } = await import('../../src/db/core/pool.ts');
	const { CONFIG } = await import('../../src/server/config.ts');
	const {
		getCachedSecurityRulesSync,
		invalidateRuleCacheMemory,
		refreshRuleCache,
	} = await import('../../src/db/repositories/securityRulesCache.ts');

	const prevEnvUrl = process.env.DATABASE_URL;
	const prevConfigUrl = CONFIG.database.url;
	const prevPool = globalForPg.__pgPool;
	const unhandled = [];
	const onUnhandled = (reason) => unhandled.push(reason);
	process.on('unhandledRejection', onUnhandled);

	try {
		globalForPg.__pgPool = undefined;
		process.env.DATABASE_URL = 'postgresql://orbit:bad@127.0.0.1:59999/offline_test';
		CONFIG.database.url = process.env.DATABASE_URL;

		invalidateRuleCacheMemory();
		const rules = await refreshRuleCache();
		assert.deepEqual(rules, []);

		const syncRules = getCachedSecurityRulesSync();
		assert.deepEqual(syncRules, []);

		await new Promise((resolve) => setTimeout(resolve, 25));
		assert.equal(unhandled.length, 0);
	} finally {
		process.off('unhandledRejection', onUnhandled);
		globalForPg.__pgPool = prevPool;
		CONFIG.database.url = prevConfigUrl;
		if (prevEnvUrl === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = prevEnvUrl;
		invalidateRuleCacheMemory();
	}
});
