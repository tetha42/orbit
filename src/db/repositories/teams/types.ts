export type ApplicationDecision = 'accepted' | 'rejected';

export type TeamJoinResult =
	| { ok: true; status: 'active' | 'applied'; message: string }
	| { ok: false; status?: number; message: string };

export interface TeamPatch {
	name?: string;
	description?: string;
	category?: string;
	capacity?: number;
	repoUrl?: string | null;
	status?: 'active' | 'suspended' | 'done';
	participationType?: 'open' | 'approval';
	leadId?: string;
}

/** A team as the onboarding showcase lists it for one member. */
export interface TeamShowcaseRecord {
	id: string;
	name: string;
	slug: string;
	description: string;
	category: string;
	capacity: number;
	leaderName: string | null;
	participationType: 'open' | 'approval';
	activeMemberCount: number;
	remainingCapacity: number;
	/** The member's own standing in the team. */
	myStatus: 'active' | 'applied' | null;
	/** The captain's last answer to this member's application, if any. */
	myDecision: ApplicationDecision | null;
	decisionDate: number | null;
}

export const TEAM_COLUMNS = `
	t.id, t.name AS "name", t.slug, t.description AS "description", t.category AS "category", t.lead_id AS "leadId",
	t.capacity AS "capacity", t.repo_url AS "repoUrl", t.status, t.join_policy AS "participationType",
	t.type, t.quorum, t.created_at AS "createdAt"
`;

export const TEAM_QUERY = `
	SELECT ${TEAM_COLUMNS}, k.first_name || ' ' || k.last_name AS "leaderName",
	       (SELECT COUNT(*) FROM team_members tu WHERE tu.team_id = t.id AND tu.status = 'active')::int AS "activeMemberCount"
	FROM teams t LEFT JOIN users k ON t.lead_id = k.id
`;
