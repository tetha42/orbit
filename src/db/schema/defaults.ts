export const SYSTEM_SETTINGS_DEFAULTS: Record<string, string> = {
	smtp_host: process.env.SMTP_HOST || '',
	smtp_port: process.env.SMTP_PORT || '465',
	smtp_secure: 'true',
	smtp_user: process.env.SMTP_USER || '',
	smtp_pass: process.env.SMTP_PASS || '',
	smtp_from: process.env.SMTP_FROM || '',
	organization_name: process.env.CLUB_NAME || process.env.COMMUNITY_NAME || 'Orbit Community',
	organization_domain: process.env.CLUB_DOMAIN || process.env.COMMUNITY_DOMAIN || 'orbit.local',
	parent_entity: process.env.CLUB_UNIVERSITY || process.env.COMMUNITY_PARENT || 'tetha42',
	signatory_1_name: process.env.CLUB_PRESIDENT_NAME || '',
	signatory_1_title: process.env.CLUB_PRESIDENT_TITLE || 'Community Leader',
	signatory_2_name: process.env.CLUB_ADVISOR_NAME || '',
	signatory_2_title: process.env.CLUB_ADVISOR_TITLE || 'Studio Coordinator',
	club_name: process.env.CLUB_NAME || process.env.COMMUNITY_NAME || 'Orbit Community',
	club_domain: process.env.CLUB_DOMAIN || process.env.COMMUNITY_DOMAIN || 'orbit.local',
	university: process.env.CLUB_UNIVERSITY || process.env.COMMUNITY_PARENT || 'tetha42',
	signature1_name: process.env.CLUB_PRESIDENT_NAME || '',
	signature1_rank: process.env.CLUB_PRESIDENT_TITLE || 'Community Leader',
	signature2_name: process.env.CLUB_ADVISOR_NAME || '',
	signature2_rank: process.env.CLUB_ADVISOR_TITLE || 'Studio Coordinator',
};

export const MEMBER_ROSTER_SQL = `
	SELECT
		k.id,
		k.first_name AS "firstName",
		k.last_name AS "lastName",
		k.email AS "email",
		k.handle AS "handle",
		k.department AS "department",
		k.grade AS "grade",
		k.role_id AS "roleId",
		r.name AS "roleName",
		r.color AS "roleColor",
		k.avatar_url AS "avatarUrl",
		k.bio,
		k.xp,
		k.status AS "status",
		k.custom_fields AS "customFields",
		k.created_at AS "createdAt",
		(
			SELECT STRING_AGG(DISTINCT t.name, ', ' ORDER BY t.name)
			FROM teams t
			LEFT JOIN team_members tu ON tu.team_id = t.id AND (tu.status = 'active' OR tu.status IS NULL)
			WHERE tu.user_id = k.id OR t.lead_id = k.id
		) AS "teamName",
		(
			SELECT COALESCE(
				JSON_AGG(
					JSONB_BUILD_OBJECT(
						'id', x.id,
						'name', x.name,
						'category', x.category,
						'isLeader', (x.lead_id = k.id),
						'role', x.role
					)
				),
				'[]'::json
			)
			FROM (
				SELECT DISTINCT ON (t.id)
					t.id, t.name, t.category, t.lead_id,
					CASE WHEN t.lead_id = k.id THEN NULL ELSE tu.role_title END AS role
				FROM teams t
				LEFT JOIN team_members tu ON tu.team_id = t.id
					AND tu.user_id = k.id
					AND (tu.status = 'active' OR tu.status IS NULL)
				WHERE tu.user_id = k.id OR t.lead_id = k.id
				ORDER BY t.id, (t.lead_id = k.id) DESC, tu.joined_at ASC NULLS LAST
			) x
		) AS "teams",
		(
			SELECT COUNT(*)::int
			FROM event_participants ep
			WHERE ep.user_id = k.id AND ep.status = 'attended'
		) AS "attendanceCount"
	FROM users k
	LEFT JOIN roles r ON r.id = k.role_id
	ORDER BY
		r.is_system DESC NULLS LAST,
		r.created_at ASC NULLS LAST,
		k.created_at ASC
`;
