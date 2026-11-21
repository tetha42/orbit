'use client';

import type { CSSProperties } from 'react';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import type { ThemeMode } from '@/core/theme';

export const MODE_ICONS: Record<ThemeMode, LucideIcon> = {
	light: Sun,
	dark: Moon,
	system: Monitor,
};

// A miniature window per mode; "system" shows both halves. The colours are the point here, so they stay fixed.
const PREVIEW: Record<'light' | 'dark', { bg: string; border: string; bar: string; line1: string; line2: string }> = {
	light: { bg: '#f2f2f7', border: '#d1d1d6', bar: 'var(--accent)', line1: '#c7c7cc', line2: '#e5e5ea' },
	dark: { bg: '#1c1c1e', border: '#38383a', bar: 'var(--accent)', line1: '#48484a', line2: '#2c2c2e' },
};

export const appearanceSectionStyle: CSSProperties = {
	background: 'var(--card-bg)',
	border: '1px solid var(--card-border)',
	borderRadius: '12px',
	padding: '16px 18px',
	display: 'flex',
	flexDirection: 'column',
	gap: '14px',
};

export function Miniature({ mode }: { mode: 'light' | 'dark' }) {
	const p = PREVIEW[mode];
	return (
		<div style={{ flex: 1, height: '100%', background: p.bg, display: 'flex', flexDirection: 'column', padding: '6px', gap: '4px' }}>
			<div style={{ height: '8px', width: '40%', background: p.bar, borderRadius: '4px' }} />
			<div style={{ height: '6px', width: '80%', background: p.line1, borderRadius: '3px' }} />
			<div style={{ height: '6px', width: '60%', background: p.line2, borderRadius: '3px' }} />
		</div>
	);
}

export function AppearanceSwitch({
	name,
	label,
	desc,
	checked,
	onChange,
}: {
	name: string;
	label: string;
	desc: string;
	checked: boolean;
	onChange: (on: boolean) => void;
}) {
	return (
		<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
			<div>
				<div style={{ fontSize: '14px', fontWeight: 600 }}>{label}</div>
				<div style={{ fontSize: '12px', opacity: 0.6 }}>{desc}</div>
			</div>
			<button
				role="switch"
				data-setting={name}
				aria-checked={checked}
				aria-label={label}
				onClick={() => onChange(!checked)}
				style={{
					flexShrink: 0,
					width: '46px',
					height: '26px',
					borderRadius: '13px',
					background: checked ? 'var(--accent)' : 'var(--input-border)',
					position: 'relative',
					cursor: 'pointer',
					transition: 'background 200ms ease',
					padding: '2px',
				}}
			>
				<div
					style={{
						width: '22px',
						height: '22px',
						borderRadius: '50%',
						background: '#ffffff',
						boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
						transform: checked ? 'translateX(20px)' : 'translateX(0px)',
						transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
					}}
				/>
			</button>
		</div>
	);
}
