export function buildQueries(ctx) {
	return [
		{
			id: 'auth.sessionLookup',
			expectedIndex: 'idx_users_session_token',
			sql: `SELECT id, role_id, status FROM users WHERE session_token = $1 LIMIT 1`,
			params: [ctx.sessionToken],
		},
		{
			id: 'auth.emailLowerLookup',
			expectedIndex: 'idx_users_email_lower',
			sql: `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
			params: [ctx.email],
		},
		{
			id: 'members.statusCreatedPage',
			expectedIndex: 'idx_users_status_created',
			sql: `SELECT id, first_name, last_name FROM users WHERE status = 'active' ORDER BY created_at ASC LIMIT 25`,
			params: [],
		},
		{
			id: 'siem.logsTimeline',
			expectedIndex: 'idx_system_logs_timestamp',
			sql: `SELECT id, timestamp, level, service FROM system_logs ORDER BY timestamp DESC LIMIT 100`,
			params: [],
		},
		{
			id: 'siem.logsByService',
			expectedIndex: 'idx_system_logs_service',
			sql: `SELECT id, timestamp, level FROM system_logs WHERE service = $1 ORDER BY timestamp DESC LIMIT 100`,
			params: [ctx.serviceName],
		},
		{
			id: 'siem.logsByUser',
			expectedIndex: 'idx_system_logs_user_ts',
			sql: `SELECT id, timestamp, message FROM system_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 50`,
			params: [ctx.userId],
		},
		{
			id: 'audit.timeline',
			expectedIndex: 'idx_audit_logs_timestamp',
			sql: `SELECT id, timestamp, action FROM audit_logs ORDER BY timestamp DESC, id DESC LIMIT 50`,
			params: [],
		},
		{
			id: 'notifications.userUnread',
			expectedIndex: 'idx_notifications_user',
			sql: `SELECT id, title, created_at FROM notifications WHERE user_id = $1 AND is_read = 0 ORDER BY created_at DESC LIMIT 20`,
			params: [ctx.userId],
		},
		{
			id: 'events.upcomingPublished',
			expectedIndex: 'idx_events_status_starts',
			sql: `SELECT id, title, starts_at FROM events WHERE status = 'published' AND starts_at >= $1 ORDER BY starts_at ASC LIMIT 24`,
			params: [ctx.now - 3600_000],
		},
		{
			id: 'tasks.assigneeDue',
			expectedIndex: 'idx_team_tasks_assignee_due',
			sql: `SELECT id, title, due_at FROM team_tasks WHERE assignee_id = $1 AND status = 'todo' ORDER BY due_at ASC LIMIT 20`,
			params: [ctx.userId],
		},
		{
			id: 'chat.latestRoomMessages',
			expectedIndex: 'idx_chat_messages_room_date_desc',
			sql: `SELECT id, sender_id, date FROM chat_messages WHERE room_id = $1 AND deleted_at IS NULL ORDER BY date DESC, id DESC LIMIT 50`,
			params: [ctx.roomId],
		},
		{
			id: 'certificates.userList',
			expectedIndex: 'idx_certificates_user_created',
			sql: `SELECT id, title, created_at FROM certificates WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
			params: [ctx.userId],
		},
		{
			id: 'notes.userFolderPinned',
			expectedIndex: 'idx_user_notes_user_folder',
			sql: `SELECT id, title, updated_at FROM user_notes WHERE user_id = $1 AND folder_id = 'quick' ORDER BY is_pinned DESC, updated_at DESC LIMIT 50`,
			params: [ctx.userId],
		},
		{
			id: 'news.publishedFeed',
			expectedIndex: 'idx_news_published',
			sql: `SELECT id, title, published_at FROM news WHERE publish_status = 'published' ORDER BY is_pinned DESC, published_at DESC, created_at DESC LIMIT 20`,
			params: [],
		},
	];
}

export async function seedSyntheticRows(client, totalRows, ctx) {
	const usersN = Math.max(100, Math.round(totalRows * 0.03));
	const logsN = Math.max(500, Math.round(totalRows * 0.4));
	const auditN = Math.max(200, Math.round(totalRows * 0.1));
	const notifN = Math.max(200, Math.round(totalRows * 0.1));
	const eventsN = Math.max(100, Math.round(totalRows * 0.05));
	const tasksN = Math.max(200, Math.round(totalRows * 0.05));
	const chatN = Math.max(500, Math.round(totalRows * 0.15));
	const certN = Math.max(100, Math.round(totalRows * 0.04));
	const notesN = Math.max(100, Math.round(totalRows * 0.04));
	const newsN = Math.max(100, Math.round(totalRows * 0.04));

	await client.query(
		`INSERT INTO users (id, first_name, last_name, email, password_hash, department, grade, status, session_token, created_at)
		 SELECT CASE WHEN g = 1 THEN $2 ELSE '__exp_u_' || g END,
		        'Bench', 'User' || g,
		        CASE WHEN g = 1 THEN $3 ELSE 'exp_' || g || '@orbit.local' END,
		        'hash', 'Engineering', 1, CASE WHEN g % 5 = 0 THEN 'pending' ELSE 'active' END,
		        CASE WHEN g = 1 THEN $4 ELSE 'exp_tok_' || g END,
		        $5::bigint + g
		 FROM generate_series(1, $1) AS g
		 ON CONFLICT DO NOTHING`,
		[usersN, ctx.userId, ctx.email, ctx.sessionToken, ctx.now - 10_000_000]
	);

	await client.query(
		`INSERT INTO teams (id, name, slug, category, created_at)
		 VALUES ($1, 'Explain Team', $1, 'Engineering', $2::bigint)
		 ON CONFLICT DO NOTHING`,
		[ctx.teamId, ctx.now]
	);

	await client.query(
		`INSERT INTO chat_rooms (id, room_type, name, created_at)
		 VALUES ($1, 'general', 'Explain Room', $2::bigint), ('__exp_room_other', 'general', 'Other Room', $2::bigint)
		 ON CONFLICT DO NOTHING`,
		[ctx.roomId, ctx.now]
	);

	await client.query(
		`INSERT INTO system_logs (timestamp, level, service, message, user_id, ip)
		 SELECT $2::bigint + g, 'INFO',
		        CASE WHEN g <= 25 THEN $3 ELSE 'http' END,
		        'Synthetic log #' || g,
		        CASE WHEN g <= 25 THEN $4 ELSE '__exp_u_' || ((g % ($5 - 1)) + 2) END,
		        '127.0.0.1'
		 FROM generate_series(1, $1) AS g`,
		[logsN, ctx.now - 1_000_000, ctx.serviceName, ctx.userId, usersN]
	);

	await client.query(
		`INSERT INTO audit_logs (id, timestamp, actor_id, action, target_type, target_id)
		 SELECT '__exp_aud_' || g, $2::bigint + g, $3, 'member.update', 'member', '__exp_u_2'
		 FROM generate_series(1, $1) AS g`,
		[auditN, ctx.now - 1_000_000, ctx.userId]
	);

	await client.query(
		`INSERT INTO notifications (id, user_id, title, message, is_read, created_at)
		 SELECT '__exp_notif_' || g,
		        CASE WHEN g <= 20 THEN $2 ELSE '__exp_u_' || ((g % ($4 - 1)) + 2) END,
		        'Notice ' || g, 'Body', 0, $3::bigint + g
		 FROM generate_series(1, $1) AS g`,
		[notifN, ctx.userId, ctx.now - 1_000_000, usersN]
	);

	await client.query(
		`INSERT INTO events (id, slug, title, category, location, starts_at, ends_at, status, created_at)
		 SELECT '__exp_evt_' || g, '__exp_slug_' || g, 'Event ' || g, 'workshop', 'Lab',
		        CASE WHEN g <= 20 THEN $2::bigint + (g::bigint * 1000) ELSE $2::bigint - (g::bigint * 1000) END,
		        $2::bigint + (g::bigint * 1000) + 3600000,
		        CASE WHEN g % 3 = 0 THEN 'draft' ELSE 'published' END,
		        $2::bigint
		 FROM generate_series(1, $1) AS g`,
		[eventsN, ctx.now]
	);

	await client.query(
		`INSERT INTO team_tasks (id, team_id, title, status, assignee_id, due_at, created_at)
		 SELECT '__exp_task_' || g, $2, 'Task ' || g, 'todo',
		        CASE WHEN g <= 20 THEN $3 ELSE '__exp_u_' || ((g % ($5 - 1)) + 2) END,
		        $4::bigint + (g::bigint * 1000), $4::bigint
		 FROM generate_series(1, $1) AS g`,
		[tasksN, ctx.teamId, ctx.userId, ctx.now, usersN]
	);

	await client.query(
		`INSERT INTO chat_messages (id, room_id, sender_id, content, date)
		 SELECT '__exp_msg_' || g,
		        CASE WHEN g <= 50 THEN $2 ELSE '__exp_room_other' END,
		        $3, 'msg ' || g, $4::bigint + g
		 FROM generate_series(1, $1) AS g`,
		[chatN, ctx.roomId, ctx.userId, ctx.now - 1_000_000]
	);

	await client.query(
		`INSERT INTO certificates (id, verification_code, user_id, title, issued_at, created_at)
		 SELECT '__exp_cert_' || g, 'EXP-' || g,
		        CASE WHEN g <= 20 THEN $2 ELSE '__exp_u_' || ((g % ($4 - 1)) + 2) END,
		        'Cert ' || g, $3::bigint, $3::bigint + g
		 FROM generate_series(1, $1) AS g`,
		[certN, ctx.userId, ctx.now - 1_000_000, usersN]
	);

	await client.query(
		`INSERT INTO user_notes (id, user_id, title, content, folder_id, is_pinned, updated_at, created_at)
		 SELECT '__exp_note_' || g,
		        CASE WHEN g <= 20 THEN $2 ELSE '__exp_u_' || ((g % ($4 - 1)) + 2) END,
		        'Note ' || g, 'Body', 'quick', g % 2, $3::bigint + g, $3::bigint
		 FROM generate_series(1, $1) AS g`,
		[notesN, ctx.userId, ctx.now - 1_000_000, usersN]
	);

	await client.query(
		`INSERT INTO news (id, slug, title, summary, content, is_pinned, publish_status, published_at, created_at, updated_at)
		 SELECT '__exp_news_' || g, '__exp_news_slug_' || g, 'News ' || g, 'Sum', 'Body',
		        CASE WHEN g <= 5 THEN 1 ELSE 0 END,
		        CASE WHEN g % 4 = 0 THEN 'draft' ELSE 'published' END,
		        $2::bigint + g, $2::bigint + g, $2::bigint + g
		 FROM generate_series(1, $1) AS g`,
		[newsN, ctx.now - 1_000_000]
	);

	await client.query(
		'ANALYZE users, system_logs, audit_logs, notifications, events, team_tasks, chat_messages, certificates, user_notes, news'
	);

	return {
		totalSyntheticRows: usersN + logsN + auditN + notifN + eventsN + tasksN + chatN + certN + notesN + newsN,
		breakdown: { usersN, logsN, auditN, notifN, eventsN, tasksN, chatN, certN, notesN, newsN },
	};
}
