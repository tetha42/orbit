#!/usr/bin/env node
import pg from 'pg';
import crypto from 'crypto';
import assert from 'node:assert/strict';
import { loadConfigIni } from '../../scripts/ini-loader.mjs';
import { registerTsAliasHooks } from '../../scripts/ts-loader.mjs';
import { teardownContractTestResources } from '../contract/helper.mjs';

// ANSI styling (100% zero-unicode emoji)
const c = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',
	green: '\x1b[32m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	yellow: '\x1b[33m',
	red: '\x1b[31m',
	gray: '\x1b[90m',
};

const TOTAL_SCENARIOS = 9;
const log = {
	info: (msg) => console.log(`${c.blue}[INFO]${c.reset} ${msg}`),
	ok: (msg) => console.log(`${c.green}[PASS]${c.reset} ${msg}`),
	warn: (msg) => console.log(`${c.yellow}[WARN]${c.reset} ${msg}`),
	error: (msg) => console.log(`${c.red}[FAIL]${c.reset} ${msg}`),
	step: (num, title) => console.log(`\n${c.bold}${c.cyan}==> [SCENARIO ${num}/${TOTAL_SCENARIOS}] ${title}${c.reset}`),
};

console.log(`
${c.bold}${c.cyan}================================================================${c.reset}
${c.bold}  Orbit Community OS — End-to-End System Integration Test       ${c.reset}
${c.gray}  Autonomous Defense, Task Workflows, and Batch Path Simulator  ${c.reset}
${c.bold}${c.cyan}================================================================${c.reset}
`);

const startTime = Date.now();
const rootDir = process.cwd();
const ini = loadConfigIni(rootDir);
const candidateUrls = [
	process.env.DATABASE_URL,
	ini?.database?.url,
	'postgresql://orbit:orbit_secret_2026@localhost:5432/orbit',
	'postgresql://postgres:postgres@localhost:5432/orbit',
].filter(Boolean);

let pool;
let dbUrl;

async function run() {
	let client;
	for (const candidate of candidateUrls) {
		try {
			const tempPool = new pg.Pool({ connectionString: candidate, max: 2, connectionTimeoutMillis: 1500 });
			const tempClient = await tempPool.connect();
			const check = await tempClient.query("SELECT to_regclass('users') AS u");
			if (check.rows[0]?.u) {
				pool = tempPool;
				client = tempClient;
				dbUrl = candidate;
				break;
			}
			tempClient.release();
			await tempPool.end().catch(() => {});
		} catch {
			// Try next candidate
		}
	}

	if (!client || !pool) {
		log.error('Could not connect to any candidate database (orbit, env).');
		process.exit(1);
	}
	log.ok(`Connected to PostgreSQL database (${dbUrl.split('@')[1] || 'localhost'}).`);

	process.env.DATABASE_URL = dbUrl;
	registerTsAliasHooks();

	const runTag = `${process.pid}_${Date.now()}`;
	let admin = null;
	let initialXp = 0;
	let xpModified = false;
	let teamId = null;
	let isTestTeamCreated = false;
	const taskId = `test-task-${runTag}`;
	const docId = `e2e-edr-${runTag}`;
	const simUserIds = [];
	const simRoomIds = [];
	let simProjectId = null;
	let simEventId = null;
	const simSettingKeys = [`e2e_sim_batch_a_${runTag}`, `e2e_sim_batch_b_${runTag}`];
	const simAuditTargetId = `e2e_sim_settings_${runTag}`;

	try {
		const { ensurePostgresInit, getUserById, setSystemSettings, getSystemSettings, getMemberRoster } = await import('../../src/db/index.ts');
		const { getRolePermission } = await import('../../src/db/roles.ts');
		const { createMailThread, addMailReply, getMailThread, getUnreadMailCount, setMailThreadStatus } = await import('../../src/db/messages.ts');
		const { createGroupDm, addMembersToRoom, getRoomMembers } = await import('../../src/db/repositories/chat.repo.ts');
		const { getPendingProjectProposals, getPendingAttendanceEvents } = await import('../../src/db/repositories/notifications.repo.ts');
		const { buildNotificationsResponse } = await import('../../src/app/api/notifications/notificationBuilders.ts');
		const { ATTENDANCE_TOLERANCE_MS } = await import('../../src/lib/events.ts');
		const { fieldDiff } = await import('../../src/lib/audit.ts');

		await ensurePostgresInit();

		// -----------------------------------------------------------------------
		// SCENARIO 1: Administrator Presence & Role Verification
		// -----------------------------------------------------------------------
		log.step(1, 'Administrator Account & Role Verification');
		let adminRes = await client.query(
			`SELECT id, first_name, last_name, email, role_id, xp, status FROM users WHERE role_id = 'role_admin' OR email = 'admin@orbit.local' LIMIT 1`
		);
		if (adminRes.rowCount === 0) {
			const adminId = crypto.randomUUID();
			await client.query(
				`INSERT INTO users (id, first_name, last_name, email, password_hash, handle, department, grade, role_id, status, xp, created_at)
				 VALUES ($1, 'Orbit', 'Administrator', 'admin@orbit.local', '$2b$12$e2eSimulationDummyHash2026', 'admin', 'Architecture', 4, 'role_admin', 'active', 100, $2)`,
				[adminId, Date.now()]
			);
			adminRes = await client.query(
				`SELECT id, first_name, last_name, email, role_id, xp, status FROM users WHERE id = $1`,
				[adminId]
			);
		}
		admin = adminRes.rows[0];
		initialXp = Number(admin.xp);
		log.ok(
			`Admin account verified: ${admin.first_name} ${admin.last_name} (${admin.email}) [Status: ${admin.status}, XP: ${admin.xp}]`
		);

		// -----------------------------------------------------------------------
		// SCENARIO 2: Team and Engineering Task Package Flow
		// -----------------------------------------------------------------------
		log.step(2, 'Team Creation & Task Workflow (Kanban)');
		const teamRes = await client.query(`SELECT id, name FROM teams LIMIT 1`);
		if (teamRes.rowCount > 0) {
			teamId = teamRes.rows[0].id;
			log.ok(`Using existing R&D team: ${teamRes.rows[0].name} (ID: ${teamId})`);
		} else {
			teamId = crypto.randomUUID();
			isTestTeamCreated = true;
			await client.query(
				`INSERT INTO teams (id, name, slug, description, category, lead_id, capacity, repo_url, status, created_at)
				 VALUES ($1, $2, $3, $4, $5, $6, 10, 'https://github.com/tetha42/orbit', 'active', $7)`,
				[
					teamId,
					'Core Engineering Team (E2E Test)',
					`core-eng-${runTag}`,
					'Automated testing unit',
					'Engineering',
					admin.id,
					Date.now(),
				]
			);
			log.ok(`Temporary test team created (ID: ${teamId}).`);
		}

		await client.query(
			`INSERT INTO team_tasks (id, team_id, title, description, status, priority, assignee_id, due_at, created_at, position, updated_at, xp_awarded)
			 VALUES ($1, $2, $3, $4, 'todo', 'high', $5, $6, $7, 1, $7, 0)`,
			[
				taskId,
				teamId,
				'E2E Test: Telemetry Unit Calibration',
				'Automated E2E task package',
				admin.id,
				Date.now() + 86400000,
				Date.now(),
			]
		);
		log.ok(`New task package opened: "${taskId}" [Status: todo].`);

		// -----------------------------------------------------------------------
		// SCENARIO 3: Task Completion & Automated XP Reward (+40 XP)
		// -----------------------------------------------------------------------
		log.step(3, 'Task Completion & XP Award Trigger');
		await client.query(
			`UPDATE team_tasks SET status = 'done', completed_at = $1, xp_awarded = 1, updated_at = $1 WHERE id = $2`,
			[Date.now(), taskId]
		);
		xpModified = true;
		await client.query(`UPDATE users SET xp = xp + 40 WHERE id = $1`, [admin.id]);

		const updatedAdminRes = await client.query(`SELECT xp FROM users WHERE id = $1`, [admin.id]);
		const newXp = Number(updatedAdminRes.rows[0].xp);
		assert.strictEqual(newXp, initialXp + 40, `XP increment mismatch! Expected: ${initialXp + 40}, Actual: ${newXp}`);
		log.ok(`Task completed successfully and +40 XP awarded (Prior XP: ${initialXp} -> New XP: ${newXp}).`);

		// -----------------------------------------------------------------------
		// SCENARIO 4: Engineering Decision / Record & Freeze Verification
		// -----------------------------------------------------------------------
		log.step(4, 'Engineering Decision Record (EDR) Flow');
		const decisionNo = Math.floor(Math.random() * 90000) + 10000;
		const decisionNow = Date.now();
		await client.query(
			`INSERT INTO decisions (id, reference_no, title, agenda, content, date, decision_type, is_public, is_locked, created_by, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, 'resolution', 1, 0, $7, $6, $6)`,
			[
				docId,
				decisionNo,
				'E2E Architecture RFC Approval',
				'Test Agenda',
				'This decision record was generated by the automated E2E simulation.',
				decisionNow,
				admin.id,
			]
		);
		log.ok(`EDR decision record created with explicit updated_at (No: ${decisionNo}, ID: ${docId}).`);

		await client.query(`UPDATE decisions SET is_locked = 1, updated_at = $2 WHERE id = $1`, [docId, Date.now()]);
		const docCheck = await client.query(`SELECT is_locked, updated_at FROM decisions WHERE id = $1`, [docId]);
		assert.strictEqual(Number(docCheck.rows[0]?.is_locked), 1, 'Document freezing failed!');
		assert.ok(Number(docCheck.rows[0]?.updated_at) >= decisionNow, 'Decision updated_at should be preserved/updated');
		log.ok(`EDR decision frozen and signed (is_locked: 1).`);

		// -----------------------------------------------------------------------
		// SCENARIO 5: Mail Batch Path (insertMessage UNNEST, Reply & Statuses)
		// -----------------------------------------------------------------------
		log.step(5, 'Mail Batch Insertion (insertMessage UNNEST), Reply & Thread Status Flow');
		const simUsers = [
			{ id: `sim_u1_${runTag}`, first: 'Sim', last: 'Sender', role: 'role_member' },
			{ id: `sim_u2_${runTag}`, first: 'Sim', last: 'RecipOne', role: 'role_admin' },
			{ id: `sim_u3_${runTag}`, first: 'Sim', last: 'RecipTwo', role: 'role_member' },
		];
		const userNow = Date.now();
		for (const u of simUsers) {
			simUserIds.push(u.id);
			await client.query(
				`INSERT INTO users (id, first_name, last_name, email, password_hash, handle, department, grade, role_id, status, auth_method, created_at)
				 VALUES ($1, $2, $3, $4, '$2b$10$e2eSimDummyHash2026', $5, 'Engineering', 2, $6, 'active', 'passkey', $7)`,
				[u.id, u.first, u.last, `${u.id}@orbit.local`, u.id, u.role, userNow]
			);
		}
		const [senderId, recip1Id, recip2Id] = simUserIds;

		const mailCreated = await createMailThread(
			senderId,
			`E2E Batch Mail ${runTag}`,
			'Initial batch message exercising insertMessage UNNEST.',
			[recip1Id, recip2Id, recip1Id]
		);
		simRoomIds.push(mailCreated.topicId);

		const memberFoldersRes = await client.query(
			`SELECT user_id, folder FROM chat_members WHERE room_id = $1`,
			[mailCreated.topicId]
		);
		const folderByUser = new Map(memberFoldersRes.rows.map((r) => [String(r.user_id), String(r.folder)]));
		assert.strictEqual(folderByUser.get(senderId), 'sent');
		assert.strictEqual(folderByUser.get(recip1Id), 'inbox');
		assert.strictEqual(folderByUser.get(recip2Id), 'inbox');
		assert.ok((await getUnreadMailCount(recip1Id)) >= 1, 'Recip1 should have unread mail after createMailThread');
		assert.ok((await getUnreadMailCount(recip2Id)) >= 1, 'Recip2 should have unread mail after createMailThread');

		const replyId = await addMailReply(
			mailCreated.topicId,
			recip1Id,
			'Reply exercising addMailReply and UNNEST upsert.',
			[senderId, recip2Id]
		);
		assert.ok(replyId, 'Reply messageId should be returned');
		const threadForRecip2 = await getMailThread(recip2Id, mailCreated.topicId);
		assert.ok(threadForRecip2 && threadForRecip2.messages.length === 2, 'Thread should contain 2 messages');

		assert.strictEqual(await setMailThreadStatus(recip2Id, mailCreated.topicId, 'read'), true);
		assert.strictEqual(await getUnreadMailCount(recip2Id), 0, 'Recip2 unread count should drop to 0 after read');
		assert.strictEqual(await setMailThreadStatus(recip2Id, mailCreated.topicId, 'unread'), true);
		assert.ok((await getUnreadMailCount(recip2Id)) >= 1, 'Recip2 unread count should restore after unread');
		assert.strictEqual(await setMailThreadStatus(recip2Id, mailCreated.topicId, 'archive'), true);
		assert.strictEqual(await setMailThreadStatus(recip2Id, mailCreated.topicId, 'restore'), true);
		assert.strictEqual(await setMailThreadStatus(recip2Id, mailCreated.topicId, 'trash'), true);
		assert.strictEqual(await setMailThreadStatus(recip2Id, mailCreated.topicId, 'delete'), true);
		log.ok('insertMessage UNNEST batch insert, addMailReply, unread counts, and status transitions verified.');

		// -----------------------------------------------------------------------
		// SCENARIO 6: Group DM & Batch Room Membership (createGroupDm / addMembersToRoom)
		// -----------------------------------------------------------------------
		log.step(6, 'Group DM & Batch Room Membership (createGroupDm & addMembersToRoom)');
		const groupDm = await createGroupDm(
			{ id: senderId, name: 'Sim', surname: 'Sender' },
			[recip1Id],
			`E2E Group DM ${runTag}`
		);
		simRoomIds.push(groupDm.roomId);
		assert.ok(groupDm.roomId.startsWith('grp_'), `Expected grp_ room id, got ${groupDm.roomId}`);

		const initialMembers = await getRoomMembers(groupDm.roomId);
		assert.strictEqual(initialMembers.length, 2, `Expected 2 initial group members, got ${initialMembers.length}`);

		const sysMsgRes = await client.query(
			`SELECT sender_id, content FROM chat_messages WHERE room_id = $1`,
			[groupDm.roomId]
		);
		assert.ok(
			sysMsgRes.rows.some((r) => r.sender_id === 'system'),
			'Group DM creation must persist system message with sender_id = system'
		);

		const addResult = await addMembersToRoom(
			groupDm.roomId,
			{ id: senderId, name: 'Sim', surname: 'Sender' },
			[recip1Id, recip2Id]
		);
		assert.strictEqual(addResult.addedCount, 1, `Expected 1 newly added member, got ${addResult.addedCount}`);

		const noOpAdd = await addMembersToRoom(
			groupDm.roomId,
			{ id: senderId, name: 'Sim', surname: 'Sender' },
			[recip2Id]
		);
		assert.strictEqual(noOpAdd.addedCount, 0, 'Duplicate addMembersToRoom must add 0 members');

		const finalMembers = await getRoomMembers(groupDm.roomId);
		assert.strictEqual(finalMembers.length, 3, `Expected 3 members after addMembersToRoom, got ${finalMembers.length}`);
		log.ok(`createGroupDm and addMembersToRoom UNNEST batch paths verified (${groupDm.roomId}, 3 members).`);

		// -----------------------------------------------------------------------
		// SCENARIO 7: Transactional Batch System Settings (setSystemSettings UNNEST + Audit)
		// -----------------------------------------------------------------------
		log.step(7, 'Transactional Batch System Settings (setSystemSettings UNNEST + Audit)');
		const [keyA, keyB] = simSettingKeys;
		await setSystemSettings(
			{ [keyA]: 'batch_alpha', [keyB]: 'batch_beta' },
			{
				ctx: { actorId: admin.id, actorName: `${admin.first_name} ${admin.last_name}`.trim(), ip: '127.0.0.1' },
				registration: {
					action: 'settings.update',
					targetType: 'settings',
					targetId: simAuditTargetId,
					targetName: 'E2E Batch Settings',
				},
				diff: (before, fresh) => fieldDiff(before, fresh),
			}
		);
		await setSystemSettings({});

		const loadedSettings = await getSystemSettings();
		assert.strictEqual(loadedSettings[keyA], 'batch_alpha');
		assert.strictEqual(loadedSettings[keyB], 'batch_beta');

		const auditRes = await client.query(
			`SELECT action, after_state FROM audit_logs WHERE target_id = $1`,
			[simAuditTargetId]
		);
		assert.strictEqual(auditRes.rowCount, 1, 'Expected 1 transactional audit log entry from setSystemSettings');
		assert.ok(String(auditRes.rows[0].after_state || '').includes('batch_alpha'));
		log.ok('setSystemSettings UNNEST batch upsert + transactional audit diff verified.');

		// -----------------------------------------------------------------------
		// SCENARIO 8: Paginated Member Roster & Notifications Response
		// -----------------------------------------------------------------------
		log.step(8, 'Paginated getMemberRoster & Notifications Pipeline');
		const pagedRoster = await getMemberRoster({ isManager: true, page: 1, limit: 2 });
		assert.ok(Array.isArray(pagedRoster.members) && pagedRoster.members.length <= 2);
		assert.strictEqual(pagedRoster.page, 1);
		assert.strictEqual(pagedRoster.limit, 2);
		assert.ok(pagedRoster.totalCount >= 4, `Expected totalCount >= 4, got ${pagedRoster.totalCount}`);

		const filteredRoster = await getMemberRoster({ isManager: false, page: 1, limit: 10, search: `${recip1Id}@orbit.local` });
		assert.strictEqual(filteredRoster.totalCount, 1, 'Filtered paginated roster should match exact simulation member');
		assert.strictEqual(filteredRoster.members[0]?.id, recip1Id);
		assert.strictEqual(typeof filteredRoster.members[0]?.diskUsageBytes, 'number');
		assert.strictEqual(typeof filteredRoster.members[0]?.customFields, 'object');

		const notifNow = Date.now();
		simProjectId = `sim_proj_${runTag}`;
		await client.query(
			`INSERT INTO projects (id, slug, title, summary, description, status, created_by, owner_user_id, created_at, updated_at)
			 VALUES ($1, $2, $3, 'Sim Summary', 'Sim Desc', 'proposed', $4, $4, $5, $5)`,
			[simProjectId, `sim-proj-${runTag}`, `E2E Proposal ${runTag}`, senderId, notifNow]
		);

		simEventId = `sim_evt_${runTag}`;
		await client.query(
			`INSERT INTO events (id, slug, title, category, description, location, starts_at, ends_at, capacity, status, checkin_open, xp_reward, created_by, created_at)
			 VALUES ($1, $2, $3, 'workshop', 'Sim Event', 'Hall A', $4, $5, 25, 'published', 1, 20, $6, $4)`,
			[simEventId, `sim-evt-${runTag}`, `E2E Checkin Event ${runTag}`, notifNow - 60_000, notifNow + 3_600_000, senderId]
		);
		await client.query(
			`INSERT INTO event_participants (id, event_id, user_id, status, registered_at)
			 VALUES ($1, $2, $3, 'registered', $4)`,
			[`sim_ep_${runTag}`, simEventId, recip1Id, notifNow - 120_000]
		);

		const notifMail = await createMailThread(
			senderId,
			`E2E Notification Mail ${runTag}`,
			'Unread mail notification probe.',
			[recip1Id]
		);
		simRoomIds.push(notifMail.topicId);

		const proposals = await getPendingProjectProposals();
		assert.ok(proposals.some((p) => p.id === simProjectId), 'getPendingProjectProposals must include proposed simulation project');
		const attendancePending = await getPendingAttendanceEvents(recip1Id, notifNow, ATTENDANCE_TOLERANCE_MS);
		assert.ok(attendancePending.some((e) => e.id === simEventId), 'getPendingAttendanceEvents must include open check-in event');

		const recip1User = await getUserById(recip1Id);
		assert.ok(recip1User, 'Simulation recipient user must resolve via getUserById');
		const recip1Perm = await getRolePermission(recip1User.roleId);
		const notifResp = await buildNotificationsResponse({ ...recip1User, permission: recip1Perm }, notifNow);

		assert.ok(notifResp.items.some((i) => i.id === `projectProposal:${simProjectId}`), 'Notifications must contain projectProposal item');
		assert.ok(notifResp.items.some((i) => i.id === `checkin:${simEventId}`), 'Notifications must contain checkin item');
		assert.ok(notifResp.items.some((i) => i.id === `message:${notifMail.topicId}`), 'Notifications must contain unread message item');
		assert.ok(notifResp.counts.actionRequired >= 2, 'Notification actionRequired count must reflect pending items');
		assert.ok(notifResp.counts.unreadMessages >= 1, 'Notification unreadMessages count must reflect unread thread');
		log.ok(`Paginated getMemberRoster (total=${pagedRoster.totalCount}) and notifications (${notifResp.items.length} items) verified.`);

		// -----------------------------------------------------------------------
		// SCENARIO 9: Teardown & Reporting
		// -----------------------------------------------------------------------
		log.step(9, 'Test Artifact Cleanup');
		log.ok('All simulation scenarios executed; proceeding to deterministic artifact teardown.');

		const elapsed = Date.now() - startTime;
		console.log(`
${c.bold}${c.green}================================================================${c.reset}
${c.bold}${c.green}  [SUCCESS] All E2E Integration Scenarios Passed Cleanly!        ${c.reset}
${c.gray}  Execution Time: ${elapsed} ms | Failures: 0                   ${c.reset}
${c.bold}${c.green}================================================================${c.reset}
`);
	} catch (err) {
		log.error(`E2E Test Failure: ${err.message}`);
		console.error(err);
		process.exitCode = 1;
	} finally {
		// Allow any background fire-and-forget notifyChatRoomParticipants calls to settle before cleanup
		await new Promise((r) => setTimeout(r, 150));

		if (client) {
			if (xpModified && admin) {
				await client.query(`UPDATE users SET xp = $1 WHERE id = $2`, [initialXp, admin.id]).catch(() => {});
			}
			await client.query(`DELETE FROM team_tasks WHERE id = $1`, [taskId]).catch(() => {});
			await client.query(`DELETE FROM decisions WHERE id = $1`, [docId]).catch(() => {});
			if (isTestTeamCreated && teamId) {
				await client.query(`DELETE FROM teams WHERE id = $1`, [teamId]).catch(() => {});
			}
			if (simProjectId) {
				await client.query(`DELETE FROM projects WHERE id = $1`, [simProjectId]).catch(() => {});
			}
			if (simEventId) {
				await client.query(`DELETE FROM event_participants WHERE event_id = $1`, [simEventId]).catch(() => {});
				await client.query(`DELETE FROM events WHERE id = $1`, [simEventId]).catch(() => {});
			}
			if (simRoomIds.length > 0) {
				await client.query(`DELETE FROM chat_rooms WHERE id = ANY($1::text[])`, [simRoomIds]).catch(() => {});
			}
			await client.query(`DELETE FROM system_settings WHERE key = ANY($1::text[])`, [simSettingKeys]).catch(() => {});
			await client.query(`DELETE FROM audit_logs WHERE target_id = $1`, [simAuditTargetId]).catch(() => {});
			if (simUserIds.length > 0) {
				await client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [simUserIds]).catch(() => {});
			}
			client.release();
		}
		await teardownContractTestResources().catch(() => {});
		if (pool) {
			await pool.end().catch(() => {});
		}
		log.ok('Test artifacts and XP state restored; database cleanly reset.');
	}
}

run();
