'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from '@/core/session';
import { useWindowActions } from '@/core/windows';
import { AlertTriangle } from 'lucide-react';

export function SmtpWarningBadge() {
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
			title="E-posta sunucusu (SMTP) henüz yapılandırılmadı. Ayarları açmak için tıklayın."
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: '4px',
				background: 'rgba(255, 189, 46, 0.15)',
				border: '1px solid rgba(255, 189, 46, 0.35)',
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
			<span>SMTP Kurulumu Gerekli</span>
		</button>
	);
}
