import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { registerTsAliasHooks } from '../../scripts/ts-loader.mjs';
import { invokeRoute, teardownContractTestResources } from './helper.mjs';

registerTsAliasHooks();
after(teardownContractTestResources);

async function createChatRole(pool, roleId, name) {
	await pool.query(
		`INSERT INTO roles (id, name, color, description, permissions, is_system, require_2fa, created_at)
		 VALUES ($1, $2, '#10b981', 'Chat contract test role', $3::jsonb, 0, 0, $4)`,
		[roleId, name, JSON.stringify({ chat: 'use' }), Date.now()]
	);
}

async function createChatUser(pool, { id, firstName, lastName, roleId, token }) {
	const { hashSessionToken } = await import('../../src/db/repositories/members/normalize.ts');
	const now = Date.now();
	await pool.query(
		`INSERT INTO users (
			id, first_name, last_name, email, password_hash, department, status, role_id,
			session_token, session_expires_at, auth_method, totp_enabled, created_at
		) VALUES ($1, $2, $3, $4, 'unused', 'Contract', 'active', $5, $6, $7, 'password', 0, $8)`,
		[id, firstName, lastName, `${id}@orbit.local`, roleId, hashSessionToken(token), now + 600_000, now]
	);
}

test('chat search & aroundId: private room isolation, snippet matching, and context window', async () => {
	const { ensurePostgresInit, getPgPool } = await import('../../src/db/index.ts');
	const { SESSION_COOKIE } = await import('../../src/lib/auth/session.ts');
	const { dropRoleCache } = await import('../../src/db/roles/queries.ts');
	const roomsRoute = await import('../../src/app/api/chat/rooms/route.ts');
	const messagesRoute = await import('../../src/app/api/chat/messages/route.ts');
	const searchRoute = await import('../../src/app/api/chat/search/route.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const stamp = `${process.pid}_${Date.now()}`;
	const roleId = `role_ct_cs_${stamp}`;
	const userAId = `usr_ct_csa_${stamp}`;
	const userBId = `usr_ct_csb_${stamp}`;
	const userCId = `usr_ct_csc_${stamp}`;
	const tokenA = crypto.randomBytes(32).toString('base64url');
	const tokenB = crypto.randomBytes(32).toString('base64url');
	const tokenC = crypto.randomBytes(32).toString('base64url');
	const cookieA = `${SESSION_COOKIE}=${tokenA}`;
	const cookieB = `${SESSION_COOKIE}=${tokenB}`;
	const cookieC = `${SESSION_COOKIE}=${tokenC}`;

	await createChatRole(pool, roleId, `ChatSearchRole_${stamp}`);
	dropRoleCache();
	await createChatUser(pool, { id: userAId, firstName: 'Alice', lastName: 'Search', roleId, token: tokenA });
	await createChatUser(pool, { id: userBId, firstName: 'Bob', lastName: 'Search', roleId, token: tokenB });
	await createChatUser(pool, { id: userCId, firstName: 'Charlie', lastName: 'Outsider', roleId, token: tokenC });

	let roomId = '';
	try {
		const dmRes = await invokeRoute(roomsRoute.POST, '/api/chat/rooms', {
			method: 'POST',
			headers: { cookie: cookieA },
			body: { action: 'create_dm', targetUserId: userBId },
		});
		assert.equal(dmRes.status, 200);
		roomId = dmRes.data?.roomId;
		assert.ok(roomId);

		const uniqueTerm = `QuantumBeacon${stamp}`;
		const texts = [
			'Telemetry baseline initialized at sector zero',
			'Calibration sequence awaiting final check',
			`Target hit ${uniqueTerm} orbital packet verified`,
			'Downlink window opened for telemetry pass',
			'Payload checksum completed cleanly',
		];

		const sentIds = [];
		for (const [idx, content] of texts.entries()) {
			const senderCookie = idx % 2 === 0 ? cookieA : cookieB;
			const sendRes = await invokeRoute(messagesRoute.POST, '/api/chat/messages', {
				method: 'POST',
				headers: { cookie: senderCookie },
				body: { roomId, content },
			});
			assert.equal(sendRes.status, 200);
			sentIds.push(sendRes.data.message.id);
		}
		const targetMsgId = sentIds[2];

		// Insert a soft-deleted message with the same term to confirm deleted messages are excluded
		await pool.query(
			`INSERT INTO chat_messages (id, room_id, sender_id, sender_name, content, attachments, date, deleted_at)
			 VALUES ($1, $2, $3, 'Alice Search', $4, '[]', $5, $5)`,
			[`msg_del_${stamp}`, roomId, userAId, `Deleted ${uniqueTerm} ghost`, Date.now()]
		);

		// 1. Short query (< 2 chars) rejected with 400
		const shortRes = await invokeRoute(searchRoute.GET, '/api/chat/search?q=x', {
			headers: { cookie: cookieA },
		});
		assert.equal(shortRes.status, 400);

		// 2. Room member User A gets hit with snippet & match ranges
		const searchARes = await invokeRoute(
			searchRoute.GET,
			`/api/chat/search?q=${encodeURIComponent(uniqueTerm)}`,
			{ headers: { cookie: cookieA } }
		);
		assert.equal(searchARes.status, 200);
		assert.equal(searchARes.data?.ok, true);
		assert.equal(searchARes.data?.hits?.length, 1);
		const hit = searchARes.data.hits[0];
		assert.equal(hit.id, targetMsgId);
		assert.equal(hit.roomId, roomId);
		assert.equal(hit.roomType, 'private');
		assert.ok(hit.snippet.toLowerCase().includes(uniqueTerm.toLowerCase()));
		assert.ok(Array.isArray(hit.matches) && hit.matches.length >= 1);

		// 3. Room member User B can search scoped to roomId
		const searchBRes = await invokeRoute(
			searchRoute.GET,
			`/api/chat/search?q=${encodeURIComponent(uniqueTerm)}&roomId=${encodeURIComponent(roomId)}`,
			{ headers: { cookie: cookieB } }
		);
		assert.equal(searchBRes.status, 200);
		assert.equal(searchBRes.data?.hits?.length, 1);

		// 4. Non-member User C receives zero results for User A's private room
		const searchCGlobal = await invokeRoute(
			searchRoute.GET,
			`/api/chat/search?q=${encodeURIComponent(uniqueTerm)}`,
			{ headers: { cookie: cookieC } }
		);
		assert.equal(searchCGlobal.status, 200);
		assert.equal(searchCGlobal.data?.hits?.filter((h) => h.roomId === roomId).length, 0);

		const searchCScoped = await invokeRoute(
			searchRoute.GET,
			`/api/chat/search?q=${encodeURIComponent(uniqueTerm)}&roomId=${encodeURIComponent(roomId)}`,
			{ headers: { cookie: cookieC } }
		);
		assert.equal(searchCScoped.status, 403);
		assert.equal(searchCScoped.data?.errorCode, 'ROOM_ACCESS_DENIED');

		// 5. GET /api/chat/messages?aroundId=... returns surrounding context window
		const aroundRes = await invokeRoute(
			messagesRoute.GET,
			`/api/chat/messages?roomId=${encodeURIComponent(roomId)}&aroundId=${encodeURIComponent(targetMsgId)}`,
			{ headers: { cookie: cookieA } }
		);
		assert.equal(aroundRes.status, 200);
		assert.equal(aroundRes.data?.ok, true);
		assert.equal(aroundRes.data?.targetFound, true);
		const aroundIds = aroundRes.data.messages.map((m) => m.id);
		for (const id of sentIds) {
			assert.ok(aroundIds.includes(id), `Expected message ${id} in aroundId window`);
		}

		// Non-member blocked from reading aroundId window
		const aroundDenied = await invokeRoute(
			messagesRoute.GET,
			`/api/chat/messages?roomId=${encodeURIComponent(roomId)}&aroundId=${encodeURIComponent(targetMsgId)}`,
			{ headers: { cookie: cookieC } }
		);
		assert.equal(aroundDenied.status, 403);
	} finally {
		if (roomId) {
			await pool.query('DELETE FROM chat_messages WHERE room_id = $1', [roomId]).catch(() => {
				/* ignore test cleanup failure */
			});
			await pool.query('DELETE FROM chat_members WHERE room_id = $1', [roomId]).catch(() => {
				/* ignore test cleanup failure */
			});
			await pool.query('DELETE FROM chat_rooms WHERE id = $1', [roomId]).catch(() => {
				/* ignore test cleanup failure */
			});
		}
		await pool.query('DELETE FROM audit_logs WHERE actor_id = ANY($1)', [[userAId, userBId, userCId]]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM system_logs WHERE user_id = ANY($1)', [[userAId, userBId, userCId]]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM users WHERE id = ANY($1)', [[userAId, userBId, userCId]]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {
			/* ignore test cleanup failure */
		});
		dropRoleCache();
	}
});

test('WebRTC signaling: ICE servers, call start/accept/cap-6/hangup, SDP/ICE signals, and non-member rejection', async () => {
	const { ensurePostgresInit, getPgPool } = await import('../../src/db/index.ts');
	const { SESSION_COOKIE } = await import('../../src/lib/auth/session.ts');
	const { dropRoleCache } = await import('../../src/db/roles/queries.ts');
	const roomsRoute = await import('../../src/app/api/chat/rooms/route.ts');
	const callRoute = await import('../../src/app/api/chat/call/route.ts');
	const iceRoute = await import('../../src/app/api/chat/call/ice/route.ts');
	const signalRoute = await import('../../src/app/api/chat/call/signal/route.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const stamp = `${process.pid}_${Date.now()}`;
	const roleId = `role_ct_rtc_${stamp}`;

	await createChatRole(pool, roleId, `WebRtcRole_${stamp}`);
	dropRoleCache();

	const members = [];
	for (let i = 0; i < 7; i++) {
		const id = `usr_ct_rtc_${i}_${stamp}`;
		const token = crypto.randomBytes(32).toString('base64url');
		await createChatUser(pool, { id, firstName: `Rtc${i}`, lastName: 'Member', roleId, token });
		members.push({ id, token, cookie: `${SESSION_COOKIE}=${token}` });
	}
	const outsiderId = `usr_ct_rtcx_${stamp}`;
	const outsiderToken = crypto.randomBytes(32).toString('base64url');
	await createChatUser(pool, {
		id: outsiderId,
		firstName: 'Rtc',
		lastName: 'Outsider',
		roleId,
		token: outsiderToken,
	});
	const outsiderCookie = `${SESSION_COOKIE}=${outsiderToken}`;
	const allUserIds = [...members.map((m) => m.id), outsiderId];

	const prevTurnUrl = process.env.WEBRTC_TURN_URL;
	const prevTurnSecret = process.env.WEBRTC_TURN_SECRET;
	let roomId = '';
	let callId = '';

	try {
		const groupRes = await invokeRoute(roomsRoute.POST, '/api/chat/rooms', {
			method: 'POST',
			headers: { cookie: members[0].cookie },
			body: {
				action: 'create_group_dm',
				memberIds: members.slice(1).map((m) => m.id),
				title: 'WebRTC Contract Room',
			},
		});
		assert.equal(groupRes.status, 200);
		roomId = groupRes.data?.roomId;
		assert.ok(roomId);

		// 1. ICE endpoint auth & STUN/TURN generation
		const unauthIce = await invokeRoute(iceRoute.GET, '/api/chat/call/ice');
		assert.equal(unauthIce.status, 401);

		process.env.WEBRTC_TURN_URL = 'turn:turn.orbit.local:3478';
		process.env.WEBRTC_TURN_SECRET = 'contract-turn-hmac-secret';
		const iceRes = await invokeRoute(iceRoute.GET, '/api/chat/call/ice', {
			headers: { cookie: members[0].cookie },
		});
		assert.equal(iceRes.status, 200);
		assert.equal(iceRes.data?.ok, true);
		assert.ok(Array.isArray(iceRes.data?.iceServers) && iceRes.data.iceServers.length >= 2);
		const turnEntry = iceRes.data.iceServers.find((s) => s.username && s.credential);
		assert.ok(turnEntry, 'Expected ephemeral HMAC TURN credentials when env is configured');

		// 2. Member 0 starts call
		const startRes = await invokeRoute(callRoute.POST, '/api/chat/call', {
			method: 'POST',
			headers: { cookie: members[0].cookie },
			body: { action: 'start', roomId },
		});
		assert.equal(startRes.status, 200);
		assert.equal(startRes.data?.call?.status, 'ringing');
		assert.equal(startRes.data?.call?.participants?.length, 1);
		callId = startRes.data.call.id;

		// 3. Non-member outsider is rejected from viewing, joining, and signaling
		const outGet = await invokeRoute(callRoute.GET, `/api/chat/call?roomId=${encodeURIComponent(roomId)}`, {
			headers: { cookie: outsiderCookie },
		});
		assert.equal(outGet.status, 403);

		const outJoin = await invokeRoute(callRoute.POST, '/api/chat/call', {
			method: 'POST',
			headers: { cookie: outsiderCookie },
			body: { action: 'accept', callId },
		});
		assert.equal(outJoin.status, 403);
		assert.equal(outJoin.data?.code, 'ROOM_ACCESS_DENIED');

		const outSig = await invokeRoute(signalRoute.POST, '/api/chat/call/signal', {
			method: 'POST',
			headers: { cookie: outsiderCookie },
			body: { callId, toUserId: members[0].id, kind: 'offer', payload: { sdp: 'v=0' } },
		});
		assert.equal(outSig.status, 403);

		// 4. Member 1 accepts & duplicate accept stays idempotent
		const accept1 = await invokeRoute(callRoute.POST, '/api/chat/call', {
			method: 'POST',
			headers: { cookie: members[1].cookie },
			body: { action: 'accept', callId },
		});
		assert.equal(accept1.status, 200);
		assert.equal(accept1.data?.call?.status, 'active');
		assert.equal(accept1.data?.call?.participants?.length, 2);

		const duplicateAccept = await invokeRoute(callRoute.POST, '/api/chat/call', {
			method: 'POST',
			headers: { cookie: members[1].cookie },
			body: { action: 'accept', callId },
		});
		assert.equal(duplicateAccept.status, 200);
		assert.equal(duplicateAccept.data?.call?.participants?.length, 2);

		// 5. SDP offer/answer and ICE candidate exchange
		const offerRes = await invokeRoute(signalRoute.POST, '/api/chat/call/signal', {
			method: 'POST',
			headers: { cookie: members[0].cookie },
			body: {
				callId,
				toUserId: members[1].id,
				kind: 'offer',
				payload: { type: 'offer', sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n' },
			},
		});
		assert.equal(offerRes.status, 200);

		const iceSigRes = await invokeRoute(signalRoute.POST, '/api/chat/call/signal', {
			method: 'POST',
			headers: { cookie: members[0].cookie },
			body: {
				callId,
				toUserId: members[1].id,
				kind: 'ice',
				payload: { candidate: 'candidate:1 1 UDP 2122260223 127.0.0.1 54321 typ host' },
			},
		});
		assert.equal(iceSigRes.status, 200);

		const pollB = await invokeRoute(
			signalRoute.GET,
			`/api/chat/call/signal?callId=${encodeURIComponent(callId)}&since=0`,
			{ headers: { cookie: members[1].cookie } }
		);
		assert.equal(pollB.status, 200);
		assert.equal(pollB.data?.signals?.length, 2);
		assert.equal(pollB.data.signals[0].kind, 'offer');
		assert.equal(pollB.data.signals[1].kind, 'ice');

		const answerRes = await invokeRoute(signalRoute.POST, '/api/chat/call/signal', {
			method: 'POST',
			headers: { cookie: members[1].cookie },
			body: {
				callId,
				toUserId: members[0].id,
				kind: 'answer',
				payload: { type: 'answer', sdp: 'v=0\r\no=- 2 2 IN IP4 127.0.0.1\r\n' },
			},
		});
		assert.equal(answerRes.status, 200);

		const pollA = await invokeRoute(
			signalRoute.GET,
			`/api/chat/call/signal?callId=${encodeURIComponent(callId)}&since=0`,
			{ headers: { cookie: members[0].cookie } }
		);
		assert.equal(pollA.status, 200);
		assert.equal(pollA.data?.signals?.length, 1);
		assert.equal(pollA.data.signals[0].kind, 'answer');

		// 6. Participant cap (<= 6): members 2..5 succeed, 7th participant (member 6) gets 409 CALL_FULL
		for (let i = 2; i < 6; i++) {
			const joinRes = await invokeRoute(callRoute.POST, '/api/chat/call', {
				method: 'POST',
				headers: { cookie: members[i].cookie },
				body: { action: 'accept', callId },
			});
			assert.equal(joinRes.status, 200);
		}
		const overCapRes = await invokeRoute(callRoute.POST, '/api/chat/call', {
			method: 'POST',
			headers: { cookie: members[6].cookie },
			body: { action: 'accept', callId },
		});
		assert.equal(overCapRes.status, 409);
		assert.equal(overCapRes.data?.code, 'CALL_FULL');

		// 7. Hangup by all active participants ends call and clears signaling queue
		let lastHangupRes = null;
		for (let i = 0; i < 6; i++) {
			lastHangupRes = await invokeRoute(callRoute.POST, '/api/chat/call', {
				method: 'POST',
				headers: { cookie: members[i].cookie },
				body: { action: 'hangup', callId },
			});
			assert.equal(lastHangupRes.status, 200);
		}
		assert.equal(lastHangupRes?.data?.call?.status, 'ended');
		assert.equal(typeof lastHangupRes?.data?.call?.endedAt, 'number');

		const activeAfterEnd = await invokeRoute(
			callRoute.GET,
			`/api/chat/call?roomId=${encodeURIComponent(roomId)}`,
			{ headers: { cookie: members[0].cookie } }
		);
		assert.equal(activeAfterEnd.status, 200);
		assert.equal(activeAfterEnd.data?.call, null);

		const signalAfterEnd = await invokeRoute(signalRoute.POST, '/api/chat/call/signal', {
			method: 'POST',
			headers: { cookie: members[0].cookie },
			body: { callId, toUserId: members[1].id, kind: 'ice', payload: {} },
		});
		assert.equal(signalAfterEnd.status, 410);
	} finally {
		if (prevTurnUrl === undefined) delete process.env.WEBRTC_TURN_URL;
		else process.env.WEBRTC_TURN_URL = prevTurnUrl;
		if (prevTurnSecret === undefined) delete process.env.WEBRTC_TURN_SECRET;
		else process.env.WEBRTC_TURN_SECRET = prevTurnSecret;

		if (callId) {
			await pool.query('DELETE FROM chat_call_signals WHERE call_id = $1', [callId]).catch(() => {
				/* ignore test cleanup failure */
			});
			await pool.query('DELETE FROM chat_calls WHERE id = $1', [callId]).catch(() => {
				/* ignore test cleanup failure */
			});
		}
		if (roomId) {
			await pool.query('DELETE FROM chat_messages WHERE room_id = $1', [roomId]).catch(() => {
				/* ignore test cleanup failure */
			});
			await pool.query('DELETE FROM chat_members WHERE room_id = $1', [roomId]).catch(() => {
				/* ignore test cleanup failure */
			});
			await pool.query('DELETE FROM chat_rooms WHERE id = $1', [roomId]).catch(() => {
				/* ignore test cleanup failure */
			});
		}
		await pool.query('DELETE FROM audit_logs WHERE actor_id = ANY($1)', [allUserIds]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM system_logs WHERE user_id = ANY($1)', [allUserIds]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM users WHERE id = ANY($1)', [allUserIds]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {
			/* ignore test cleanup failure */
		});
		dropRoleCache();
	}
});

test('WebRTC reaper: expires stale active/ringing calls and purges orphaned call signals', async () => {
	const { ensurePostgresInit, getPgPool } = await import('../../src/db/index.ts');
	const { dropRoleCache } = await import('../../src/db/roles/queries.ts');
	const { sweepStaleCallsAndSignals } = await import('../../src/domains/webrtc/reaper.ts');

	await ensurePostgresInit();
	const pool = getPgPool();
	const stamp = `${process.pid}_${Date.now()}`;
	const roleId = `role_ct_reap_${stamp}`;
	const userAId = `usr_ct_ra_${stamp}`;
	const userBId = `usr_ct_rb_${stamp}`;
	const roomId = `room_ct_reap_${stamp}`;
	const staleRingId = `call_ring_stale_${stamp}`;
	const staleActiveId = `call_act_stale_${stamp}`;
	const freshActiveId = `call_act_fresh_${stamp}`;

	await createChatRole(pool, roleId, `ReaperRole_${stamp}`);
	dropRoleCache();
	await createChatUser(pool, { id: userAId, firstName: 'R', lastName: 'A', roleId, token: crypto.randomBytes(16).toString('hex') });
	await createChatUser(pool, { id: userBId, firstName: 'R', lastName: 'B', roleId, token: crypto.randomBytes(16).toString('hex') });

	const now = Date.now();
	await pool.query(
		`INSERT INTO chat_rooms (id, room_type, team_id, name, created_by, created_at) VALUES ($1, 'direct', NULL, 'ReapRoom', $2, $3)`,
		[roomId, userAId, now]
	);
	await pool.query(
		`INSERT INTO chat_calls (id, room_id, initiator_id, status, participants, started_at, answered_at)
		 VALUES
		   ($1, $4, $5, 'ringing', '[]'::jsonb, $6, NULL),
		   ($2, $4, $5, 'active', '[{"userId":"u1"}]'::jsonb, $7, $7),
		   ($3, $4, $5, 'active', '[{"userId":"u1"}]'::jsonb, $8, $8)`,
		[staleRingId, staleActiveId, freshActiveId, roomId, userAId, now - 120_000, now - 3 * 60 * 60_000, now - 5_000]
	);
	await pool.query(
		`INSERT INTO chat_call_signals (id, call_id, from_user_id, to_user_id, kind, payload, created_at)
		 VALUES
		   ($1, $4, $7, $8, 'ice', '{}'::jsonb, $9),
		   ($2, $5, $7, $8, 'offer', '{}'::jsonb, $10),
		   ($3, $6, $7, $8, 'ice', '{}'::jsonb, $11)`,
		[
			`sig_1_${stamp}`,
			`sig_2_${stamp}`,
			`sig_3_${stamp}`,
			staleRingId,
			staleActiveId,
			freshActiveId,
			userAId,
			userBId,
			now - 10_000,
			now - 10 * 60_000,
			now - 5_000,
		]
	);

	try {
		const summary = await sweepStaleCallsAndSignals({ force: true, now });
		assert.ok(summary.expiredRinging >= 1);
		assert.ok(summary.expiredActive >= 1);
		assert.ok(summary.purgedSignals >= 2);

		const callRows = await pool.query('SELECT id, status FROM chat_calls WHERE id = ANY($1)', [
			[staleRingId, staleActiveId, freshActiveId],
		]);
		const statusMap = new Map(callRows.rows.map((r) => [r.id, r.status]));
		assert.equal(statusMap.get(staleRingId), 'missed');
		assert.equal(statusMap.get(staleActiveId), 'ended');
		assert.equal(statusMap.get(freshActiveId), 'active');

		const sigRows = await pool.query('SELECT call_id AS "callId" FROM chat_call_signals WHERE call_id = ANY($1)', [
			[staleRingId, staleActiveId, freshActiveId],
		]);
		assert.deepEqual(sigRows.rows.map((r) => r.callId ?? r.call_id), [freshActiveId]);
	} finally {
		await pool.query('DELETE FROM chat_call_signals WHERE call_id = ANY($1)', [[staleRingId, staleActiveId, freshActiveId]]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM chat_calls WHERE id = ANY($1)', [[staleRingId, staleActiveId, freshActiveId]]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM chat_rooms WHERE id = $1', [roomId]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM users WHERE id = ANY($1)', [[userAId, userBId]]).catch(() => {
			/* ignore test cleanup failure */
		});
		await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {
			/* ignore test cleanup failure */
		});
		dropRoleCache();
	}
});
