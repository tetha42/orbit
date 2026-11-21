import type React from 'react';

export interface Invitation {
	id: string;
	email: string | null;
	roleId: string | null;
	note: string | null;
	expiresAt: number;
	createdAt: number;
}

export interface RoleOption {
	id: string;
	name: string;
	color: string;
}

export const membershipCardStyle: React.CSSProperties = {
	padding: '16px',
	borderRadius: '10px',
	border: '1px solid var(--window-border)',
	background: 'var(--card-bg, rgba(255,255,255,0.03))',
	display: 'flex',
	flexDirection: 'column',
	gap: '12px',
};

export const membershipInputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 11px',
	borderRadius: '8px',
	border: '1px solid var(--window-border)',
	background: 'rgba(0, 0, 0, 0.22)',
	color: 'inherit',
	fontSize: '12.5px',
	outline: 'none',
	boxSizing: 'border-box',
};

export const membershipLabelStyle: React.CSSProperties = {
	display: 'block',
	fontSize: '11.5px',
	fontWeight: 600,
	opacity: 0.82,
	marginBottom: '5px',
};
