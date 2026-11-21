'use client';

import React, { useEffect, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { useWindowActions } from '@/core/windows';
import { AlertTriangle } from 'lucide-react';

export function SmtpWarningBadge() {
	const { t } = useI18n();
	const { currentUser, canManageApp } = useSession();
	const { openApp } = useWindowActions();
	const [smtpMissing, setSmtpMissing] = useState(false);

	useEffect(() => {
		if (!currentUser || !canManageApp('settings')) return;

		let active = true;
		fetch('/api/settings/smtp')
			.then((res) => {
				if (!res.ok) return null;
				return res.json();
			})
			.then((data) => {
				if (!active || !data) return;
				if (!data.emailReady && !data.configured) {
					setSmtpMissing(true);
				}
			})
			.catch(() => {});

		return () => {
			active = false;
		};
	}, [currentUser, canManageApp]);

	if (!smtpMissing) return null;

	return (
		<button
			type="button"
			onClick={() => openApp('settings')}
			title={t('smtpBadgeTitle')}
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: '4px',
				background: 'color-mix(in srgb, var(--gold) 15%, transparent)',
				border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)',
				color: '#ffbd2e',
				borderRadius: '12px',
				padding: '1px 8px',
				fontSize: '11px',
				fontWeight: 650,
				cursor: 'pointer',
				height: '20px',
				lineHeight: 1,
			}}
		>
			<AlertTriangle size={12} />
			<span>{t('smtpBadgeLabel')}</span>
		</button>
	);
}
