import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { registerTsAliasHooks } from '../../scripts/ts-loader.mjs';
import { invokeRoute, teardownContractTestResources } from './helper.mjs';

registerTsAliasHooks();
after(teardownContractTestResources);

const TINY_PNG_BYTES = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

async function createTempRole(pool, id, name, permissions) {
	await pool.query(
		`INSERT INTO roles (id, name, color, description, permissions, is_system, require_2fa, created_at)
		 VALUES ($1, $2, '#3b82f6', 'Contract test role', $3::jsonb, 0, 0, $4)`,
		[id, name, JSON.stringify(permissions), Date.now()]
	);
}

async function createTempUser(pool, { id, firstName, lastName, roleId, authMethod = 'password', token }) {
	const { hashSessionToken } = await import('../../src/db/repositories/members/normalize.ts');
	const now = Date.now();
	await pool.query(
		`INSERT INTO users (
			id, first_name, last_name, email, password_hash, department, status, role_id,
			session_token, session_expires_at, auth_method, totp_enabled, created_at
		) VALUES ($1, $2, $3, $4, 'unused', 'Contract', 'active', $5, $6, $7, $8, 0, $9)`,
		[id, firstName, lastName, `${id}@orbit.local`, roleId, hashSessionToken(token), now + 600_000, authMethod, now]
	);
}

test('atomic quota engine: user > role > global precedence, unlimited (-1) bypass, and 413 rejection without leaks', async () => {
	const { ensurePostgresInit, getPgPool, withTransaction } = await import('../../src/db/index.ts');
	const { ADMIN_ROLE_ID } = await import('../../src/core/permissions/index.ts');
	const { SESSION_COOKIE } = await import('../../src/lib/auth/session.ts');
	const { dropRoleCache } = await import('../../src/db/roles/queries.ts');
	const {
		DEFAULT_GLOBAL_QUOTA_BYTES,
		getUserStorageBreakdown,
		reserveUserStorageQuota,
		resolveEffectiveQuotaBytes,
	} = await import('../../src/server/storage/quota.ts');
	const { uploadDir } = await import('../../src/lib/uploads.ts');
	const quotasRoute = await import('../../src/app/api/drive/quotas/route.ts');
	const uploadInitRoute = await import('../../src/app/api/drive/upload/init/route.ts');
	const uploadChunkRoute = await import('../../src/app/api/drive/upload/chunk/route.ts');
	const uploadCompleteRoute = await import('../../src/app/api/drive/upload/complete/route.ts');
	const notesRoute = await import('../../src/app/api/notes/route.ts');
	const notesUploadRoute = await import('../../src/app/api/notes/upload/route.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const stamp = `${process.pid}_${Date.now()}`;
	const roleId = `role_ct_q_${stamp}`;
	const adminId = `usr_ct_qa_${stamp}`;
	const memberId = `usr_ct_qm_${stamp}`;
	const adminToken = crypto.randomBytes(32).toString('base64url');
	const memberToken = crypto.randomBytes(32).toString('base64url');
	const adminCookie = `${SESSION_COOKIE}=${adminToken}`;
	const memberCookie = `${SESSION_COOKIE}=${memberToken}`;

	const prevGlobalRes = await pool.query(
		`SELECT id, quota_bytes AS "quotaBytes", updated_by AS "updatedBy", updated_at AS "updatedAt"
		 FROM storage_quotas WHERE scope_type = 'global' AND scope_id = '' LIMIT 1`
	);
	const prevGlobal = prevGlobalRes.rows[0] || null;

	await createTempRole(pool, roleId, `QuotaRole_${stamp}`, { drive: 'use', notes: 'use' });
	dropRoleCache();
	await createTempUser(pool, {
		id: adminId,
		firstName: 'Quota',
		lastName: 'Admin',
		roleId: ADMIN_ROLE_ID,
		authMethod: 'passkey',
		token: adminToken,
	});
	await createTempUser(pool, {
		id: memberId,
		firstName: 'Quota',
		lastName: 'Member',
		roleId,
		token: memberToken,
	});

	let tempUploadId = '';
	try {
		// 1. Default global fallback when no global row exists
		await invokeRoute(quotasRoute.DELETE, '/api/drive/quotas?scopeType=global', {
			method: 'DELETE',
			headers: { cookie: adminCookie },
		});
		assert.equal(await resolveEffectiveQuotaBytes(memberId), DEFAULT_GLOBAL_QUOTA_BYTES);

		// 2. Global -> Role -> User precedence
		const setGlobal = await invokeRoute(quotasRoute.PUT, '/api/drive/quotas', {
			method: 'PUT',
			headers: { cookie: adminCookie },
			body: { scopeType: 'global', scopeId: '', quotaBytes: 4096 },
		});
		assert.equal(setGlobal.status, 200);
		assert.equal(await resolveEffectiveQuotaBytes(memberId), 4096);

		const setRole = await invokeRoute(quotasRoute.PUT, '/api/drive/quotas', {
			method: 'PUT',
			headers: { cookie: adminCookie },
			body: { scopeType: 'role', scopeId: roleId, quotaBytes: 2048 },
		});
		assert.equal(setRole.status, 200);
		assert.equal(await resolveEffectiveQuotaBytes(memberId), 2048);

		const setUser = await invokeRoute(quotasRoute.PUT, '/api/drive/quotas', {
			method: 'PUT',
			headers: { cookie: adminCookie },
			body: { scopeType: 'user', scopeId: memberId, quotaBytes: 512 },
		});
		assert.equal(setUser.status, 200);
		assert.equal(await resolveEffectiveQuotaBytes(memberId), 512);

		// 3. Unlimited (-1) bypass
		const setUnlimited = await invokeRoute(quotasRoute.PUT, '/api/drive/quotas', {
			method: 'PUT',
			headers: { cookie: adminCookie },
			body: { scopeType: 'user', scopeId: memberId, quotaBytes: -1 },
		});
		assert.equal(setUnlimited.status, 200);
		assert.equal(await resolveEffectiveQuotaBytes(memberId), -1);

		const unlimitedReservation = await withTransaction((client) =>
			reserveUserStorageQuota(client, memberId, 2_000_000_000)
		);
		assert.equal(unlimitedReservation.allowed, true);
		assert.equal(unlimitedReservation.quotaBytes, -1);

		// 4. GET /api/drive/quotas requires manage permission
		const memberDenied = await invokeRoute(quotasRoute.GET, '/api/drive/quotas', {
			headers: { cookie: memberCookie },
		});
		assert.equal(memberDenied.status, 403);

		const overviewRes = await invokeRoute(quotasRoute.GET, '/api/drive/quotas', {
			headers: { cookie: adminCookie },
		});
		assert.equal(overviewRes.status, 200);
		assert.equal(overviewRes.data?.globalQuotaBytes, 4096);
		const memberRow = overviewRes.data?.members?.find((m) => m.userId === memberId);
		assert.equal(memberRow?.effectiveQuotaBytes, -1);

		// 5. Over-quota rejection (413) on Drive init, Drive complete, and Notes upload without leaking bytes
		await invokeRoute(quotasRoute.PUT, '/api/drive/quotas', {
			method: 'PUT',
			headers: { cookie: adminCookie },
			body: { scopeType: 'user', scopeId: memberId, quotaBytes: 120 },
		});

		const initTooBig = await invokeRoute(uploadInitRoute.POST, '/api/drive/upload/init', {
			method: 'POST',
			headers: { cookie: memberCookie },
			body: { fileName: 'oversize.bin', mimeType: 'application/octet-stream', totalBytes: 256 },
		});
		assert.equal(initTooBig.status, 413);
		assert.equal(initTooBig.data?.code, 'STORAGE_QUOTA_EXCEEDED');

		const initSmall = await invokeRoute(uploadInitRoute.POST, '/api/drive/upload/init', {
			method: 'POST',
			headers: { cookie: memberCookie },
			body: { fileName: 'race.txt', mimeType: 'text/plain', totalBytes: 64 },
		});
		assert.equal(initSmall.status, 200);
		tempUploadId = initSmall.data.uploadId;

		const chunkPut = await invokeRoute(
			uploadChunkRoute.PUT,
			`/api/drive/upload/chunk?uploadId=${encodeURIComponent(tempUploadId)}&index=0`,
			{
				method: 'PUT',
				headers: { cookie: memberCookie },
				body: Buffer.alloc(64, 0x41),
			}
		);
		assert.equal(chunkPut.status, 200);

		// Tighten quota below assembled chunk size before complete
		await invokeRoute(quotasRoute.PUT, '/api/drive/quotas', {
			method: 'PUT',
			headers: { cookie: adminCookie },
			body: { scopeType: 'user', scopeId: memberId, quotaBytes: 16 },
		});

		const completeRejected = await invokeRoute(uploadCompleteRoute.POST, '/api/drive/upload/complete', {
			method: 'POST',
			headers: { cookie: memberCookie },
			body: { uploadId: tempUploadId },
		});
		assert.equal(completeRejected.status, 413);
		assert.equal(completeRejected.data?.code, 'STORAGE_QUOTA_EXCEEDED');

		const noteRes = await invokeRoute(notesRoute.POST, '/api/notes', {
			method: 'POST',
			headers: { cookie: memberCookie },
			body: { title: 'Quota Probe Note', content: 'Checking note quota rejection' },
		});
		assert.equal(noteRes.status, 200);

		const noteImgForm = new FormData();
		noteImgForm.append('noteId', noteRes.data.id);
		noteImgForm.append('file', new File([TINY_PNG_BYTES], 'tiny.png', { type: 'image/png' }));
		const noteQuotaRejected = await invokeRoute(notesUploadRoute.POST, '/api/notes/upload', {
			method: 'POST',
			headers: { cookie: memberCookie },
			body: noteImgForm,
		});
		assert.equal(noteQuotaRejected.status, 413);
		assert.equal(noteQuotaRejected.data?.error, 'STORAGE_QUOTA_EXCEEDED');

		const breakdown = await getUserStorageBreakdown(memberId);
		assert.equal(breakdown.usedBytes, 0);
	} finally {
		if (tempUploadId) {
			rmSync(join(uploadDir(), '.tmp', tempUploadId), { recursive: true, force: true });
		}
		await pool.query('DELETE FROM drive_items WHERE owner_id = $1', [memberId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM user_notes WHERE user_id = $1', [memberId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM files WHERE uploaded_by = $1', [memberId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query("DELETE FROM storage_quotas WHERE (scope_type = 'role' AND scope_id = $1) OR (scope_type = 'user' AND scope_id = $2)", [roleId, memberId]).catch(() => {
			/* ignore test cleanup failure */
		});
		if (prevGlobal) {
			await pool
				.query(
					`INSERT INTO storage_quotas (id, scope_type, scope_id, quota_bytes, updated_by, updated_at)
					 VALUES ($1, 'global', '', $2, $3, $4)
					 ON CONFLICT (scope_type, scope_id) DO UPDATE
					 SET quota_bytes = EXCLUDED.quota_bytes, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at`,
					[prevGlobal.id, prevGlobal.quotaBytes, prevGlobal.updatedBy, prevGlobal.updatedAt]
				)
				.catch(() => {
					/* ignore global quota restore failure */
				});
		} else {
			await pool.query("DELETE FROM storage_quotas WHERE scope_type = 'global' AND scope_id = ''").catch(() => {
				/* ignore test cleanup failure */
			});
		}
		await pool.query('DELETE FROM audit_logs WHERE actor_id IN ($1, $2)', [adminId, memberId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM system_logs WHERE user_id IN ($1, $2)', [adminId, memberId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [adminId, memberId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {
			/* ignore test cleanup failure */
		});
		dropRoleCache();
	}
});

test('notes image upload & cleanup: valid PNG updates usage, invalid magic fails 415, permanent delete removes file and bytes', async () => {
	const { ensurePostgresInit, getPgPool, getStoredFile } = await import('../../src/db/index.ts');
	const { SESSION_COOKIE } = await import('../../src/lib/auth/session.ts');
	const { dropRoleCache } = await import('../../src/db/roles/queries.ts');
	const { uploadDir } = await import('../../src/lib/uploads.ts');
	const { getUserStorageBreakdown } = await import('../../src/server/storage/quota.ts');
	const notesRoute = await import('../../src/app/api/notes/route.ts');
	const notesUploadRoute = await import('../../src/app/api/notes/upload/route.ts');
	const uploadsRoute = await import('../../src/app/api/uploads/[name]/route.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const stamp = `${process.pid}_${Date.now()}`;
	const roleId = `role_ct_note_${stamp}`;
	const userId = `usr_ct_note_${stamp}`;
	const token = crypto.randomBytes(32).toString('base64url');
	const cookie = `${SESSION_COOKIE}=${token}`;
	let uploadedName = '';

	await createTempRole(pool, roleId, `NoteRole_${stamp}`, { notes: 'use' });
	dropRoleCache();
	await createTempUser(pool, {
		id: userId,
		firstName: 'Note',
		lastName: 'Tester',
		roleId,
		token,
	});

	try {
		const createNoteRes = await invokeRoute(notesRoute.POST, '/api/notes', {
			method: 'POST',
			headers: { cookie },
			body: { title: 'Attachment Note', content: 'Body before image upload' },
		});
		assert.equal(createNoteRes.status, 200);
		const noteId = createNoteRes.data?.id;
		assert.ok(noteId);

		// Invalid magic bytes disguised as PNG -> 415
		const elfForm = new FormData();
		elfForm.append('noteId', noteId);
		elfForm.append(
			'file',
			new File([new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01])], 'evil.png', { type: 'image/png' })
		);
		const elfRes = await invokeRoute(notesUploadRoute.POST, '/api/notes/upload', {
			method: 'POST',
			headers: { cookie },
			body: elfForm,
		});
		assert.equal(elfRes.status, 415);
		assert.equal(elfRes.data?.code, 'UNSUPPORTED_IMAGE_TYPE');

		// Plain text masquerading as upload -> 415
		const textForm = new FormData();
		textForm.append('noteId', noteId);
		textForm.append('file', new File(['not an image'], 'bad.txt', { type: 'text/plain' }));
		const textRes = await invokeRoute(notesUploadRoute.POST, '/api/notes/upload', {
			method: 'POST',
			headers: { cookie },
			body: textForm,
		});
		assert.equal(textRes.status, 415);

		// Valid 1x1 PNG upload -> 200 and storage increment
		const validForm = new FormData();
		validForm.append('noteId', noteId);
		validForm.append('file', new File([TINY_PNG_BYTES], 'pixel.png', { type: 'image/png' }));
		const okRes = await invokeRoute(notesUploadRoute.POST, '/api/notes/upload', {
			method: 'POST',
			headers: { cookie },
			body: validForm,
		});
		assert.equal(okRes.status, 200);
		assert.equal(okRes.data?.ok, true);
		assert.equal(okRes.data?.mime, 'image/png');
		assert.ok(typeof okRes.data?.name === 'string' && okRes.data.name.endsWith('.png'));
		assert.equal(okRes.data?.url, `/api/uploads/${okRes.data.name}`);
		assert.ok(okRes.data?.size > 0);
		uploadedName = okRes.data.name;

		const diskPath = join(uploadDir(), uploadedName);
		assert.equal(existsSync(diskPath), true);
		const stored = await getStoredFile(uploadedName);
		assert.equal(stored?.sourceApp, 'notes');
		assert.equal(stored?.scopeId, noteId);
		assert.equal(stored?.sizeBytes, okRes.data.size);

		const usageBeforeDelete = await getUserStorageBreakdown(userId);
		assert.equal(usageBeforeDelete.byApp.notes, okRes.data.size);
		assert.equal(usageBeforeDelete.usedBytes, okRes.data.size);

		// Range request against uploaded note image returns 206 Partial Content
		const rangeRes = await invokeRoute(uploadsRoute.GET, `/api/uploads/${uploadedName}`, {
			headers: { cookie, range: 'bytes=0-3' },
			context: { params: Promise.resolve({ name: uploadedName }) },
			rawResponse: true,
		});
		assert.equal(rangeRes.status, 206);
		assert.equal(rangeRes.headers.get('accept-ranges'), 'bytes');
		assert.equal(rangeRes.headers.get('content-range'), `bytes 0-3/${okRes.data.size}`);
		const sliceBytes = Buffer.from(await rangeRes.response.arrayBuffer());
		assert.deepEqual(sliceBytes, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

		// Permanently deleting the note cleans up DB file record, disk file, and frees storage
		const delRes = await invokeRoute(notesRoute.DELETE, `/api/notes?id=${encodeURIComponent(noteId)}`, {
			method: 'DELETE',
			headers: { cookie },
		});
		assert.equal(delRes.status, 200);
		assert.equal(delRes.data?.success, true);

		assert.equal(await getStoredFile(uploadedName), null);
		assert.equal(existsSync(diskPath), false);
		const usageAfterDelete = await getUserStorageBreakdown(userId);
		assert.equal(usageAfterDelete.byApp.notes, 0);
		assert.equal(usageAfterDelete.usedBytes, 0);
		uploadedName = '';
	} finally {
		if (uploadedName) {
			rmSync(join(uploadDir(), uploadedName), { force: true });
		}
		await pool.query('DELETE FROM user_notes WHERE user_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM files WHERE uploaded_by = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM audit_logs WHERE actor_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM system_logs WHERE user_id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {
			/* ignore test cleanup failure */
		});
		dropRoleCache();
	}
});

test('drive folders, chunked upload, item sharing, and Range 206 streaming', async () => {
	const { ensurePostgresInit, getPgPool, getStoredFile } = await import('../../src/db/index.ts');
	const { SESSION_COOKIE } = await import('../../src/lib/auth/session.ts');
	const { dropRoleCache } = await import('../../src/db/roles/queries.ts');
	const { uploadDir } = await import('../../src/lib/uploads.ts');
	const { getUserStorageBreakdown } = await import('../../src/server/storage/quota.ts');
	const foldersRoute = await import('../../src/app/api/drive/folders/route.ts');
	const folderDetailRoute = await import('../../src/app/api/drive/folders/[id]/route.ts');
	const itemsRoute = await import('../../src/app/api/drive/items/route.ts');
	const itemDetailRoute = await import('../../src/app/api/drive/items/[id]/route.ts');
	const sharesRoute = await import('../../src/app/api/drive/shares/route.ts');
	const uploadInitRoute = await import('../../src/app/api/drive/upload/init/route.ts');
	const uploadChunkRoute = await import('../../src/app/api/drive/upload/chunk/route.ts');
	const uploadCompleteRoute = await import('../../src/app/api/drive/upload/complete/route.ts');
	const uploadsRoute = await import('../../src/app/api/uploads/[name]/route.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const stamp = `${process.pid}_${Date.now()}`;
	const roleId = `role_ct_drv_${stamp}`;
	const ownerId = `usr_ct_do_${stamp}`;
	const viewerId = `usr_ct_dv_${stamp}`;
	const outsiderId = `usr_ct_dx_${stamp}`;
	const ownerToken = crypto.randomBytes(32).toString('base64url');
	const viewerToken = crypto.randomBytes(32).toString('base64url');
	const outsiderToken = crypto.randomBytes(32).toString('base64url');
	const ownerCookie = `${SESSION_COOKIE}=${ownerToken}`;
	const viewerCookie = `${SESSION_COOKIE}=${viewerToken}`;
	const outsiderCookie = `${SESSION_COOKIE}=${outsiderToken}`;

	await createTempRole(pool, roleId, `DriveRole_${stamp}`, { drive: 'use' });
	dropRoleCache();
	await createTempUser(pool, { id: ownerId, firstName: 'Drive', lastName: 'Owner', roleId, token: ownerToken });
	await createTempUser(pool, { id: viewerId, firstName: 'Drive', lastName: 'Viewer', roleId, token: viewerToken });
	await createTempUser(pool, { id: outsiderId, firstName: 'Drive', lastName: 'Outsider', roleId, token: outsiderToken });

	let uploadId = '';
	let storedFileId = '';
	try {
		// 1. Create folder
		const folderRes = await invokeRoute(foldersRoute.POST, '/api/drive/folders', {
			method: 'POST',
			headers: { cookie: ownerCookie },
			body: { name: 'Contract Docs' },
		});
		assert.equal(folderRes.status, 201);
		const folderId = folderRes.data?.folder?.id;
		assert.ok(folderId);

		// 2. Chunked upload (2 chunks concatenated -> 16 bytes)
		const payload = Buffer.from('ORBIT_DRIVE_TEST', 'utf8');
		const initRes = await invokeRoute(uploadInitRoute.POST, '/api/drive/upload/init', {
			method: 'POST',
			headers: { cookie: ownerCookie },
			body: {
				fileName: 'contract-sample.txt',
				mimeType: 'text/plain',
				totalBytes: payload.length,
				folderId,
			},
		});
		assert.equal(initRes.status, 200);
		assert.equal(initRes.data?.ok, true);
		uploadId = initRes.data.uploadId;
		assert.ok(uploadId);

		const chunkRes = await invokeRoute(
			uploadChunkRoute.PUT,
			`/api/drive/upload/chunk?uploadId=${encodeURIComponent(uploadId)}&index=0`,
			{
				method: 'PUT',
				headers: { cookie: ownerCookie },
				body: payload,
			}
		);
		assert.equal(chunkRes.status, 200);

		const completeRes = await invokeRoute(uploadCompleteRoute.POST, '/api/drive/upload/complete', {
			method: 'POST',
			headers: { cookie: ownerCookie },
			body: { uploadId },
		});
		assert.equal(completeRes.status, 201);
		const item = completeRes.data?.item;
		assert.ok(item?.id);
		assert.equal(item.folderId, folderId);
		assert.equal(item.sizeBytes, payload.length);
		assert.equal(item.displayName, 'contract-sample.txt');
		storedFileId = item.fileId;

		// 3. Owner sees item in folder listing and storage breakdown
		const listRes = await invokeRoute(itemsRoute.GET, `/api/drive/items?view=my&folderId=${encodeURIComponent(folderId)}`, {
			headers: { cookie: ownerCookie },
		});
		assert.equal(listRes.status, 200);
		assert.ok(listRes.data?.items?.some((x) => x.id === item.id));
		assert.equal(listRes.data?.storage?.byApp?.drive, payload.length);

		// 4. Unshared viewer & outsider cannot read item or stream bytes
		const preShareViewerList = await invokeRoute(itemsRoute.GET, '/api/drive/items?view=shared', {
			headers: { cookie: viewerCookie },
		});
		assert.equal(preShareViewerList.status, 200);
		assert.equal(preShareViewerList.data?.items?.some((x) => x.id === item.id), false);

		const preShareFetch = await invokeRoute(uploadsRoute.GET, `/api/uploads/${encodeURIComponent(storedFileId)}`, {
			headers: { cookie: viewerCookie },
			context: { params: Promise.resolve({ name: storedFileId }) },
			rawResponse: true,
		});
		assert.equal(preShareFetch.status, 404);

		// 5. Grant read share to viewer
		const shareRes = await invokeRoute(sharesRoute.POST, '/api/drive/shares', {
			method: 'POST',
			headers: { cookie: ownerCookie },
			body: { itemId: item.id, targetUserId: viewerId, permission: 'view' },
		});
		assert.equal(shareRes.status, 201);
		assert.ok(shareRes.data?.id);

		const sharedViewerList = await invokeRoute(itemsRoute.GET, '/api/drive/items?view=shared', {
			headers: { cookie: viewerCookie },
		});
		assert.equal(sharedViewerList.status, 200);
		const sharedItem = sharedViewerList.data?.items?.find((x) => x.id === item.id);
		assert.ok(sharedItem);
		assert.equal(sharedItem.sharedPermission, 'view');

		// 6. Shared viewer gets HTTP 206 Partial Content with Range: bytes=0-3
		const range206 = await invokeRoute(uploadsRoute.GET, `/api/uploads/${encodeURIComponent(storedFileId)}`, {
			headers: { cookie: viewerCookie, range: 'bytes=0-3' },
			context: { params: Promise.resolve({ name: storedFileId }) },
			rawResponse: true,
		});
		assert.equal(range206.status, 206);
		assert.equal(range206.headers.get('accept-ranges'), 'bytes');
		assert.equal(range206.headers.get('content-range'), `bytes 0-3/${payload.length}`);
		assert.equal(range206.headers.get('content-length'), '4');
		assert.equal(await range206.response.text(), 'ORBI');

		// Invalid range returns 416
		const range416 = await invokeRoute(uploadsRoute.GET, `/api/uploads/${encodeURIComponent(storedFileId)}`, {
			headers: { cookie: viewerCookie, range: 'bytes=999-1000' },
			context: { params: Promise.resolve({ name: storedFileId }) },
			rawResponse: true,
		});
		assert.equal(range416.status, 416);
		assert.equal(range416.headers.get('content-range'), `bytes */${payload.length}`);

		// Non-shared outsider still gets 404
		const outsiderFetch = await invokeRoute(uploadsRoute.GET, `/api/uploads/${encodeURIComponent(storedFileId)}`, {
			headers: { cookie: outsiderCookie, range: 'bytes=0-3' },
			context: { params: Promise.resolve({ name: storedFileId }) },
			rawResponse: true,
		});
		assert.equal(outsiderFetch.status, 404);

		// 7. Permanent deletion removes DB rows, physical file, and frees quota
		const delItemRes = await invokeRoute(itemDetailRoute.DELETE, `/api/drive/items/${encodeURIComponent(item.id)}`, {
			method: 'DELETE',
			headers: { cookie: ownerCookie },
			context: { params: Promise.resolve({ id: item.id }) },
		});
		assert.equal(delItemRes.status, 200);
		assert.equal(await getStoredFile(storedFileId), null);
		assert.equal(existsSync(join(uploadDir(), storedFileId)), false);
		assert.equal((await getUserStorageBreakdown(ownerId)).usedBytes, 0);
		storedFileId = '';

		const delFolderRes = await invokeRoute(folderDetailRoute.DELETE, `/api/drive/folders/${encodeURIComponent(folderId)}`, {
			method: 'DELETE',
			headers: { cookie: ownerCookie },
			context: { params: Promise.resolve({ id: folderId }) },
		});
		assert.equal(delFolderRes.status, 200);
	} finally {
		if (uploadId) {
			rmSync(join(uploadDir(), '.tmp', uploadId), { recursive: true, force: true });
		}
		if (storedFileId) {
			rmSync(join(uploadDir(), storedFileId), { force: true });
		}
		await pool.query('DELETE FROM drive_shares WHERE owner_id = $1', [ownerId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM drive_items WHERE owner_id = $1', [ownerId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM drive_folders WHERE owner_id = $1', [ownerId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM files WHERE uploaded_by = ANY($1)', [[ownerId, viewerId, outsiderId]]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM audit_logs WHERE actor_id = ANY($1)', [[ownerId, viewerId, outsiderId]]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM system_logs WHERE user_id = ANY($1)', [[ownerId, viewerId, outsiderId]]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM users WHERE id = ANY($1)', [[ownerId, viewerId, outsiderId]]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {
			/* ignore test cleanup failure */
		});
		dropRoleCache();
	}
});

test('drive temp upload cleanup: sweeps stale .tmp sessions while preserving active sessions and cleans up on quota failure', async () => {
	const { mkdirSync, mkdtempSync, writeFileSync } = await import('node:fs');
	const { tmpdir } = await import('node:os');
	const { ensurePostgresInit, getPgPool } = await import('../../src/db/index.ts');
	const { dropRoleCache } = await import('../../src/db/roles/queries.ts');
	const { sweepStaleDriveUploadSessions } = await import('../../src/domains/drive/uploadCleanup.ts');
	const { initChunkedDriveUpload, writeDriveUploadChunk, completeChunkedDriveUpload } = await import(
		'../../src/domains/drive/service.ts'
	);
	const { uploadDir } = await import('../../src/lib/uploads.ts');

	// 1. Stale .tmp/up_* folders older than TTL are removed; recent ones stay untouched
	const fakeBase = mkdtempSync(join(tmpdir(), 'orbit-drv-sweep-'));
	const fakeTmp = join(fakeBase, '.tmp');
	const staleDir = join(fakeTmp, 'up_stale_001');
	const freshDir = join(fakeTmp, 'up_fresh_002');
	const unrelatedDir = join(fakeTmp, 'keep_other');
	mkdirSync(staleDir, { recursive: true });
	mkdirSync(freshDir, { recursive: true });
	mkdirSync(unrelatedDir, { recursive: true });
	const now = Date.now();
	writeFileSync(join(staleDir, 'meta.json'), JSON.stringify({ createdAt: now - 3 * 60 * 60_000 }));
	writeFileSync(join(staleDir, 'part_0'), 'stale-bytes');
	writeFileSync(join(freshDir, 'meta.json'), JSON.stringify({ createdAt: now - 5 * 60_000 }));

	try {
		const swept = await sweepStaleDriveUploadSessions(fakeBase, { force: true, now, ttlMs: 2 * 60 * 60_000 });
		assert.equal(swept.scanned, 2);
		assert.equal(swept.removed, 1);
		assert.equal(existsSync(staleDir), false);
		assert.equal(existsSync(freshDir), true);
		assert.equal(existsSync(unrelatedDir), true);
	} finally {
		rmSync(fakeBase, { recursive: true, force: true });
	}

	// 2. Completing a chunked upload whose user quota shrinks before completion still deletes .tmp/<uploadId>
	await ensurePostgresInit();
	const pool = getPgPool();
	const stamp = `${process.pid}_${Date.now()}`;
	const roleId = `role_ct_drvc_${stamp}`;
	const userId = `usr_ct_drvc_${stamp}`;
	const token = crypto.randomBytes(32).toString('base64url');
	let uploadId = '';

	await createTempRole(pool, roleId, `DriveCleanup_${stamp}`, { drive: 'use' });
	dropRoleCache();
	await createTempUser(pool, { id: userId, firstName: 'Clean', lastName: 'User', roleId, token });

	try {
		const initRes = await initChunkedDriveUpload({
			userId,
			fileName: 'quota-race.bin',
			mimeType: 'application/octet-stream',
			totalBytes: 256,
			folderId: null,
		});
		assert.equal(initRes.ok, true);
		uploadId = initRes.uploadId;
		const sessionDir = join(uploadDir(), '.tmp', uploadId);
		assert.equal(existsSync(sessionDir), true);

		const chunkRes = await writeDriveUploadChunk({
			uploadId,
			userId,
			chunkIndex: 0,
			bytes: Buffer.alloc(256, 0x41),
		});
		assert.equal(chunkRes.ok, true);

		// Shrink quota below 256 bytes before complete runs to simulate concurrent exhaustion
		await pool.query(
			`INSERT INTO storage_quotas (id, scope_type, scope_id, quota_bytes, updated_by, updated_at)
			 VALUES ($1, 'user', $2, 64, $2, $3)
			 ON CONFLICT (scope_type, scope_id) DO UPDATE SET quota_bytes = 64`,
			[`sq_ct_drvc_${stamp}`, userId, Date.now()]
		);
		const failComplete = await completeChunkedDriveUpload({ uploadId, userId });
		assert.equal(failComplete.ok, false);
		assert.equal(failComplete.code, 'STORAGE_QUOTA_EXCEEDED');
		assert.equal(existsSync(sessionDir), false);
		uploadId = '';
	} finally {
		if (uploadId) rmSync(join(uploadDir(), '.tmp', uploadId), { recursive: true, force: true });
		await pool.query("DELETE FROM storage_quotas WHERE scope_type = 'user' AND scope_id = $1", [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {
			/* ignore test cleanup failure */
		});
		dropRoleCache();
	}
});
