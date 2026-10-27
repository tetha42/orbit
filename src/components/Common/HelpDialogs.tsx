'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Globe, Mail, MapPin, Phone } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useDialog } from './DialogProvider';

/**
 * Bodies for the Help-menu dialogs.
 *
 * They used to be a single `alert()` with the address and phone number pasted in
 * as plain lines — nothing to click, nothing to copy. As dialog content they can
 * be links and carry a copy button.
 */

const rowStyle: React.CSSProperties = {
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
			{copied ? <Check size={14} color="#30d158" /> : <Copy size={14} />}
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
		<div style={rowStyle}>
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
					background: 'rgba(10, 132, 255, 0.14)',
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

/** Help → Topluluk Destek & İletişim. */
export function SupportCard() {
	const [info, setInfo] = useState<{ studio: string; community: string; domain: string } | null>(null);

	useEffect(() => {
		fetch('/api/settings/community')
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => {
				if (d) {
					setInfo({
						studio: d.universite || 'tetha42',
						community: d.kulupAdi || 'Orbit Community',
						domain: d.kulupDomain || 'orbit.local',
					});
				}
			})
			.catch(() => {});
	}, []);

	const studio = info?.studio || 'tetha42';
	const community = info?.community || 'Orbit Community';
	const domain = info?.domain || 'orbit.local';
	const supportMail = `support@${domain}`;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
			<p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 4 }}>
				{community} OS
				<br />
				Engineered by <strong style={{ color: 'var(--text-primary)' }}>{studio}</strong>
			</p>
			<ContactRow
				icon={MapPin}
				label="Ekosistem"
				value={`${studio} Open Source Labs & Studio`}
			/>
			<ContactRow
				icon={Mail}
				label="E-posta"
				value={supportMail}
				href={`mailto:${supportMail}`}
			/>
			<ContactRow
				icon={Phone}
				label="Topluluk"
				value={`${community} Platform Hub`}
			/>
			<ContactRow
				icon={Globe}
				label="Domain"
				value={domain}
				href={`https://${domain}`}
			/>
		</div>
	);
}

const SHORTCUTS: { keys: string[]; tr: string; en: string }[] = [
	{ keys: ['Shift', 'Space'], tr: 'Spotlight araması', en: 'Spotlight search' },
	{ keys: ['Shift', '1–8'], tr: 'Uygulamaları aç', en: 'Open apps' },
	{ keys: ['Shift', 'M'], tr: 'Pencereyi küçült', en: 'Minimize window' },
	{ keys: ['Shift', 'W'], tr: 'Pencereyi kapat', en: 'Close window' },
	{ keys: ['Shift', 'Tab'], tr: 'Açık pencereler arasında geç', en: 'Switch between open windows' },
	{ keys: ['Sağ tık', 'basılı tut'], tr: 'Pencereyi sürükleyerek boyutlandır', en: 'Drag to resize a window' },
];

const keyStyle: React.CSSProperties = {
	display: 'inline-block',
	minWidth: 22,
	padding: '1px 6px',
	borderRadius: 6,
	fontSize: 11,
	fontWeight: 600,
	textAlign: 'center',
	color: 'var(--text-primary)',
	background: 'var(--input-bg)',
	border: '1px solid var(--input-border)',
};

/** Help → Portal Kullanım Kılavuzu: the keyboard and mouse shortcuts. */
export function DocumentationShortcuts() {
	const { language } = useI18n();
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
			{SHORTCUTS.map((shortcut) => (
				<div key={shortcut.tr} style={{ ...rowStyle, justifyContent: 'space-between', padding: '6px 10px' }}>
					<span style={{ fontSize: 12 }}>{language === 'en' ? shortcut.en : shortcut.tr}</span>
					<span style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
						{shortcut.keys.map((key) => (
							<kbd key={key} style={keyStyle}>
								{key}
							</kbd>
						))}
					</span>
				</div>
			))}
		</div>
	);
}

/**
 * The two Help dialogs as functions, so the menu bar and the Spotlight open exactly
 * the same thing.
 */
export function useHelpDialogs() {
	const dialog = useDialog();
	return useMemo(
		() => ({
			showDocumentation: () =>
				void dialog.alert({
					title: 'Portal Kullanım Kılavuzu',
					message:
						'Toplam 320 senaryo, role tabanlı erişim, WebAuthn & 2FA güvenlik katmanı, Ar-Ge takımları, karar defteri ve etkinlik yönetimi aktif olarak çalışmaktadır.',
					tone: 'info',
					body: <DocumentationShortcuts />,
				}),
			showSupport: () =>
				void dialog.alert({
					title: 'Topluluk Destek & İletişim',
					tone: 'info',
					body: <SupportCard />,
				}),
		}),
		[dialog]
	);
}
