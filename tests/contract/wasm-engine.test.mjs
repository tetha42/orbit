import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { teardownContractTestResources } from './helper.mjs';

after(teardownContractTestResources);

test('contract: WASM cryptographic and security verification engine loads and verifies correctly', async () => {
	const {
		initWasmEngine,
		isWasmEngineActive,
		computeDocumentDigestWasm,
		verifyCertificateFormatWasm,
		timingSafeEqualWasm,
	} = await import('../../src/lib/wasm/securityEngine.ts');
	const initialized = await initWasmEngine();
	assert.ok(initialized, 'WASM engine must initialize successfully');
	assert.ok(isWasmEngineActive(), 'isWasmEngineActive() must return true');

	// Document cryptographic digest
	const digest = computeDocumentDigestWasm('REF-2026', 'Meeting Protocol', '2026-11-12', 'Resolution content');
	assert.match(digest, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

	// Official document format verification
	const docRes = verifyCertificateFormatWasm('ORBIT-DOC-987654');
	assert.strictEqual(docRes.valid, true);
	assert.strictEqual(docRes.kind, 'official_doc');

	// Certificate credential code verification
	const certRes = verifyCertificateFormatWasm('TR99-X442-9988');
	assert.strictEqual(certRes.valid, true);
	assert.strictEqual(certRes.kind, 'certificate');

	const orbitCertRes = verifyCertificateFormatWasm('ORB-2026-X442-9988');
	assert.strictEqual(orbitCertRes.valid, true);
	assert.strictEqual(orbitCertRes.kind, 'certificate');

	const legacyOrbitCertRes = verifyCertificateFormatWasm('ORBIT-2026-CTF-8941');
	assert.strictEqual(legacyOrbitCertRes.valid, true);
	assert.strictEqual(legacyOrbitCertRes.kind, 'certificate');

	// Rejection of invalid codes
	const badRes = verifyCertificateFormatWasm('BAD-FORMAT-PAYLOAD');
	assert.strictEqual(badRes.valid, false);
	assert.strictEqual(badRes.kind, 'unknown');

	// Constant-time comparison
	assert.strictEqual(timingSafeEqualWasm('secret_hash_value', 'secret_hash_value'), true);
	assert.strictEqual(timingSafeEqualWasm('secret_hash_value', 'different_hash_!'), false);
	assert.strictEqual(timingSafeEqualWasm('short', 'longer_string_value'), false);
});
