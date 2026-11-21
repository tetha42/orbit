import type React from 'react';

export const communityCardStyle: React.CSSProperties = {
	background: 'var(--card-bg)',
	border: '1px solid var(--card-border)',
	borderRadius: '12px',
	padding: '18px',
	display: 'flex',
	flexDirection: 'column',
	gap: '14px',
};

export const communitySectionTitleStyle: React.CSSProperties = {
	fontSize: '14px',
	fontWeight: 600,
	margin: 0,
	display: 'flex',
	alignItems: 'center',
	gap: '8px',
};

export const communityLabelStyle: React.CSSProperties = {
	display: 'block',
	fontSize: '12px',
	fontWeight: 500,
	marginBottom: '6px',
	color: 'var(--text-secondary)',
};

export const communityInputStyle: React.CSSProperties = {
	width: '100%',
	padding: '9px 12px',
	borderRadius: '8px',
	border: '1px solid var(--input-border, rgba(255,255,255,0.12))',
	background: 'var(--input-bg, rgba(0,0,0,0.2))',
	color: 'inherit',
	fontSize: '13.5px',
	boxSizing: 'border-box',
	outline: 'none',
};

export const communityReadonlyInputStyle: React.CSSProperties = {
	...communityInputStyle,
	opacity: 0.65,
	cursor: 'not-allowed',
};
