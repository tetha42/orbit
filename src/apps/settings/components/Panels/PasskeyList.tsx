'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { Fingerprint, Trash2 } from 'lucide-react';

export interface PasskeySummary {
	id: string;
	nickname: string | null;
	deviceType: string | null;
	backedUp: boolean;
	olusturma: number;
	sonKullanma: number | null;
}

interface PasskeyListProps {
	passkeys: PasskeySummary[];
	isBusy: boolean;
	onRemove: (id: string, label: string) => void;
}

function formatDate(ms: number | null, locale: string): string {
	if (!ms) return '—';
	return new Date(ms).toLocaleDateString(locale);
}

const secondaryButton: React.CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: '8px',
	padding: '8px 12px',
	borderRadius: '8px',
	border: '1px solid var(--window-border)',
	background: 'transparent',
	color: 'inherit',
	fontSize: '13px',
	cursor: 'pointer',
};

export function PasskeyList({ passkeys, isBusy, onRemove }: PasskeyListProps) {
	const { t, language } = useI18n();
	const loc = language === 'en' ? 'en-US' : 'tr-TR';
	if (passkeys.length === 0) return null;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
			{passkeys.map((pk) => (
				<div
					key={pk.id}
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: '12px',
						padding: '12px 14px',
						borderRadius: '10px',
						background: 'rgba(0, 0, 0, 0.18)',
						border: '1px solid var(--window-border)',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
						<Fingerprint size={18} style={{ flexShrink: 0, opacity: 0.8 }} />
						<div style={{ minWidth: 0 }}>
							<div style={{ fontSize: '13px', fontWeight: 600 }}>
								{pk.nickname || (pk.deviceType === 'multiDevice' ? t('passkeySynced') : t('passkeyThisDevice'))}
							</div>
							<div style={{ fontSize: '11.5px', opacity: 0.65 }}>
								{fill(t('passkeyAddedDate'), { date: formatDate(pk.olusturma, loc) })}
								{pk.sonKullanma ? ` · ${fill(t('passkeyLastUsedDate'), { date: formatDate(pk.sonKullanma, loc) })}` : ''}
								{pk.backedUp ? ` · ${t('passkeyBackedUp')}` : ''}
							</div>
						</div>
					</div>
					<button
						type="button"
						onClick={() => onRemove(pk.id, pk.nickname || t('passkeyThisDevice'))}
						disabled={isBusy}
						style={{ ...secondaryButton, color: '#ff453a', flexShrink: 0 }}
						title={t('passkeyRemoveTooltip')}
					>
						<Trash2 size={14} />
						{t('passkeyRemove')}
					</button>
				</div>
			))}
		</div>
	);
}
