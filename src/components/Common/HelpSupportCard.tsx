'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Globe, Mail, MapPin, Phone } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useIdentity } from '@/core/identity';

export const helpDialogRowStyle: React.CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 10,
	padding: '8px 10px',
	borderRadius: 10,
	background: 'var(--card-bg)',
	border: '1px solid var(--card-border)',
};

function CopyButton({ value }: { value: string }) {
	const { t } = useI18n();
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[]
	);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			if (timer.current) clearTimeout(timer.current);
			timer.current = setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard access can be denied; the value is still selectable text.
		}
	};

	const label = copied ? t('dlgCopied') : t('dlgCopy');
	return (
		<button
			type="button"
			className="dlg-btn"
			onClick={copy}
			aria-label={`${label}: ${value}`}
			title={label}
			style={{ flex: '0 0 auto', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
		>
			{copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
		</button>
	);
}

function ContactRow({
	icon: Icon,
	label,
	value,
	note,
	href,
}: {
	icon: React.ComponentType<{ size?: number | string }>;
	label: string;
	value: string;
	note?: string;
	href?: string;
}) {
	return (
		<div style={helpDialogRowStyle}>
			<span
				aria-hidden="true"
				style={{
					width: 30,
					height: 30,
					flex: '0 0 auto',
					borderRadius: 8,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					color: 'var(--accent-blue)',
					background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
				}}
			>
				<Icon size={15} />
			</span>
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
					{label}
				</div>
				{href ? (
					<a
						href={href}
						style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-blue)', textDecoration: 'none', wordBreak: 'break-word' }}
					>
						{value}
					</a>
				) : (
					<div style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-primary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
						{value}
					</div>
				)}
				{note && <span style={{ marginLeft: 8, fontSize: 11.5, color: 'var(--text-secondary)' }}>{note}</span>}
			</div>
			<CopyButton value={value} />
		</div>
	);
}

export function SupportCard() {
	const { t } = useI18n();
	const { identity } = useIdentity();
	const [info, setInfo] = useState<{ studio: string; community: string; domain: string } | null>(null);

	useEffect(() => {
		fetch('/api/settings/community')
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => {
				if (d) {
					setInfo({
						studio: d.university || 'tetha42',
						community: d.clubName || 'Orbit Community',
						domain: d.clubDomain || 'orbit.local',
					});
				}
			})
			.catch(() => {});
	}, []);

	const studio = info?.studio || identity.studio;
	const community = info?.community || identity.siteName;
	const domain = info?.domain || identity.domain;
	const supportMail = `support@${domain}`;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
			<p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 4 }}>
				{community} OS
				<br />
				Engineered by <strong style={{ color: 'var(--text-primary)' }}>{studio}</strong>
			</p>
			<ContactRow icon={MapPin} label={t('helpEcosystem')} value={`${studio} Open Source Labs & Studio`} />
			<ContactRow icon={Mail} label={t('helpEmail')} value={supportMail} href={`mailto:${supportMail}`} />
			<ContactRow icon={Phone} label={t('helpCommunity')} value={`${community} Platform Hub`} />
			<ContactRow icon={Globe} label={t('helpDomain')} value={domain} href={`https://${domain}`} />
		</div>
	);
}
