import type React from 'react';
import type { RegistrationCoreConfig, RegistrationCoreField } from '@/lib/i18n/data/registrationConfig';

export const coreInputStyle: React.CSSProperties = {
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

export const coreLabelStyle: React.CSSProperties = {
	display: 'block',
	fontSize: '11.5px',
	fontWeight: 600,
	opacity: 0.82,
	marginBottom: '5px',
};

export const coreCardStyle: React.CSSProperties = {
	padding: '14px',
	borderRadius: '10px',
	border: '1px solid var(--window-border)',
	background: 'var(--card-bg, rgba(255,255,255,0.03))',
};

const copyField = (field: RegistrationCoreField): RegistrationCoreField => ({
	...field,
	options: field.options.map((option) => ({ ...option })),
});

export const copyCoreConfig = (config: RegistrationCoreConfig): RegistrationCoreConfig => ({
	track: copyField(config.track),
	level: copyField(config.level),
	memberId: { ...config.memberId },
});
