import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db';

export type ApplicationSource = 'self' | 'admin' | 'invite';
export type ApplicationStatus =
	| 'submitted'
	| 'email_verified'
	| 'pending_review'
	| 'approved'
	| 'rejected'
	| 'withdrawn';

export interface MembershipApplication {
	id: string;
	userId: string;
	source: ApplicationSource;
	status: ApplicationStatus;
	snapshot: string;
	invitationId: string | null;
	reapplyOf: string | null;
	submittedAt: number;
	emailVerifiedAt: number | null;
	reviewedBy: string | null;
	reviewedAt: number | null;
	rejectionReason: string | null;
	createdAt: number;
}

function mapApplication(row: Record<string, unknown>, fallbackUserId = ''): MembershipApplication {
	const rawSnapshot = row.snapshot;
	const snapshot =
		typeof rawSnapshot === 'string'
			? rawSnapshot
			: rawSnapshot && typeof rawSnapshot === 'object'
				? JSON.stringify(rawSnapshot)
				: '{}';
	return {
		id: String(row.id ?? ''),
		userId: String(row.userId ?? row.user_id ?? fallbackUserId),
		source: String(row.source ?? 'self') as ApplicationSource,
		status: String(row.status ?? 'pending_review') as ApplicationStatus,
		snapshot,
		invitationId: row.invitationId ? String(row.invitationId) : row.invitation_id ? String(row.invitation_id) : null,
		reapplyOf: row.reapplyOf ? String(row.reapplyOf) : row.reapply_of ? String(row.reapply_of) : null,
		submittedAt: Number(row.submittedAt ?? row.submitted_at) || 0,
		emailVerifiedAt: row.emailVerifiedAt
			? Number(row.emailVerifiedAt)
			: row.email_verified_at
				? Number(row.email_verified_at)
				: null,
		reviewedBy: row.reviewedBy ? String(row.reviewedBy) : row.reviewed_by ? String(row.reviewed_by) : null,
		reviewedAt: row.reviewedAt ? Number(row.reviewedAt) : row.reviewed_at ? Number(row.reviewed_at) : null,
		rejectionReason: row.rejectionReason
			? String(row.rejectionReason)
			: row.rejection_reason
				? String(row.rejection_reason)
				: null,
		createdAt: Number(row.createdAt ?? row.created_at) || 0,
	};
}

function parseApplicationHistory(raw: unknown, userId: string): MembershipApplication[] {
	let arr: unknown = raw;
	if (typeof raw === 'string') {
		try {
			arr = JSON.parse(raw);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(arr)) return [];
	return arr
		.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
		.map((item) => mapApplication(item, userId));
}

export async function createMembershipApplication(input: {
	userId: string;
	source: ApplicationSource;
	status?: ApplicationStatus;
	snapshot?: Record<string, unknown>;
	invitationId?: string | null;
	reapplyOf?: string | null;
	emailVerifiedAt?: number | null;
	reviewedBy?: string | null;
	reviewedAt?: number | null;
	rejectionReason?: string | null;
}): Promise<MembershipApplication> {
	await ensurePostgresInit();
	const now = Date.now();
	const status = input.status ?? 'pending_review';
	const id = `app_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
	const created: MembershipApplication = {
		id,
		userId: input.userId,
		source: input.source,
		status,
		snapshot: JSON.stringify(input.snapshot ?? {}),
		invitationId: input.invitationId ?? null,
		reapplyOf: input.reapplyOf ?? null,
		submittedAt: now,
		emailVerifiedAt: input.emailVerifiedAt ?? null,
		reviewedBy: input.reviewedBy ?? null,
		reviewedAt: input.reviewedAt ?? null,
		rejectionReason: input.rejectionReason ?? null,
		createdAt: now,
	};

	await withTransaction(async (client) => {
		const res = await client.query(
			'SELECT application_history AS "applicationHistory" FROM users WHERE id = $1 FOR UPDATE',
			[input.userId]
		);
		const history = parseApplicationHistory(
			res.rows[0]?.applicationHistory ?? res.rows[0]?.application_history,
			input.userId
		);
		// One open application per member; a re-application replaces the open draft.
		const filtered = ['submitted', 'email_verified', 'pending_review'].includes(status)
			? history.filter((a) => !['submitted', 'email_verified', 'pending_review'].includes(a.status))
			: history;
		filtered.push(created);
		await client.query(
			'UPDATE users SET application_history = $2::jsonb WHERE id = $1',
			[input.userId, JSON.stringify(filtered)]
		);
	});
	return created;
}

export async function getLatestApplication(userId: string): Promise<MembershipApplication | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'SELECT application_history AS "applicationHistory" FROM users WHERE id = $1',
		[userId]
	);
	if (!res.rows[0]) return null;
	const history = parseApplicationHistory(
		res.rows[0].applicationHistory ?? res.rows[0].application_history,
		userId
	);
	if (history.length === 0) return null;
	history.sort((a, b) => b.createdAt - a.createdAt);
	return history[0] ?? null;
}

export async function recordApplicationDecision(
	userId: string,
	status: 'approved' | 'rejected',
	reviewedBy: string,
	rejectionReason?: string | null
): Promise<void> {
	await ensurePostgresInit();
	await withTransaction(async (client) => {
		const res = await client.query(
			'SELECT application_history AS "applicationHistory" FROM users WHERE id = $1 FOR UPDATE',
			[userId]
		);
		if (!res.rows[0]) return;
		const history = parseApplicationHistory(
			res.rows[0].applicationHistory ?? res.rows[0].application_history,
			userId
		);
		let targetIdx = -1;
		let latestCreated = -1;
		for (let i = 0; i < history.length; i++) {
			const item = history[i];
			if (
				['submitted', 'email_verified', 'pending_review'].includes(item.status) &&
				item.createdAt >= latestCreated
			) {
				latestCreated = item.createdAt;
				targetIdx = i;
			}
		}
		if (targetIdx === -1) return;
		history[targetIdx] = {
			...history[targetIdx],
			status,
			reviewedBy,
			reviewedAt: Date.now(),
			rejectionReason: status === 'rejected' ? rejectionReason ?? null : null,
		};
		await client.query(
			'UPDATE users SET application_history = $2::jsonb WHERE id = $1',
			[userId, JSON.stringify(history)]
		);
	});
}
