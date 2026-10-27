'use client';

/**
 * A member's role as a coloured chip — the role's own name and colour from the
 * role editor. Every place that shows a role (control centre, account page,
 * member directory, phone launcher) uses this, so a renamed or recoloured role
 * looks the same everywhere.
 */
export interface RoleBadgeRole {
	ad: string;
	renk: string;
}

export function RoleBadge({ role, size = 'sm', bosMetin = 'Role atanmadı' }: { role: RoleBadgeRole | null | undefined; size?: 'sm' | 'md'; bosMetin?: string }) {
	const renk = role?.renk && /^#[0-9a-fA-F]{6}$/.test(role.renk) ? role.renk : '#8e8e93';
	return (
		<span
			data-role-badge={role ? role.ad : ''}
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: '5px',
				maxWidth: '100%',
				fontSize: size === 'md' ? '12px' : '10.5px',
				fontWeight: 600,
				lineHeight: 1.3,
				padding: size === 'md' ? '3px 10px' : '2px 8px',
				borderRadius: '999px',
				background: `${renk}26`,
				border: `1px solid ${renk}59`,
				color: role ? renk : 'var(--text-secondary, #8e8e93)',
				whiteSpace: 'nowrap',
				overflow: 'hidden',
				textOverflow: 'ellipsis',
			}}
		>
			<span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: renk, flexShrink: 0 }} />
			{role ? role.ad : bosMetin}
		</span>
	);
}

/** The avatar gradient for a role colour (initials circle). */
export function roleGradient(renk: string | null | undefined): string {
	const c = renk && /^#[0-9a-fA-F]{6}$/.test(renk) ? renk : '#0a84ff';
	return `linear-gradient(135deg, ${c}, ${c}b3)`;
}
