'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from '@/core/session';
import { useWindowActions } from '@/core/windows';
import { useI18n } from '@/core/i18n';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

type DefconLevel = 1 | 2 | 3 | 4 | 5;

interface DefconVisual {
	labelTr: string;
	labelEn: string;
	titleTr: string;
	titleEn: string;
	color: string;
	bg: string;
	border: string;
	icon: typeof ShieldAlert;
	pulse?: boolean;
}

const DEFCON_STYLES: Record<DefconLevel, DefconVisual> = {
	1: {
		labelTr: 'DEFCON 1: KİLİTLENDİ',
		labelEn: 'DEFCON 1: LOCKDOWN',
		titleTr: 'DEFCON 1: Saldırı Altındayız Kalkanı (Hard Lockdown) Aktif! Yönetici harici erişimler askıya alındı. SoC merkezini aç.',
		titleEn: 'DEFCON 1: Hard Lockdown active! Non-admin access suspended. Open SoC Center.',
		color: 'var(--danger, #ef4444)',
		bg: 'rgba(239, 68, 68, 0.2)',
		border: '1px solid rgba(239, 68, 68, 0.5)',
		icon: ShieldAlert,
		pulse: true,
	},
	2: {
		labelTr: 'DEFCON 2: YÜKSEK',
		labelEn: 'DEFCON 2: HIGH',
		titleTr: 'DEFCON 2: Yüksek Tehdit Seviyesi (Aktif saldırı / IP karantinaları mevcut). SoC merkezini aç.',
		titleEn: 'DEFCON 2: High Threat Level (Active attacks / quarantined IPs detected). Open SoC Center.',
		color: '#f97316',
		bg: 'rgba(249, 115, 22, 0.18)',
		border: '1px solid rgba(249, 115, 22, 0.45)',
		icon: ShieldAlert,
	},
	3: {
		labelTr: 'DEFCON 3: DİKKAT',
		labelEn: 'DEFCON 3: ELEVATED',
		titleTr: 'DEFCON 3: Artırılmış Güvenlik Uyarısı (Şüpheli aktiviteler ve engeller tespit edildi). SoC merkezini aç.',
		titleEn: 'DEFCON 3: Elevated Security Warning (Suspicious activity detected). Open SoC Center.',
		color: 'var(--warning, #eab308)',
		bg: 'rgba(234, 179, 8, 0.16)',
		border: '1px solid rgba(234, 179, 8, 0.4)',
		icon: ShieldAlert,
	},
	4: {
		labelTr: 'DEFCON 4: İZLEME',
		labelEn: 'DEFCON 4: GUARDED',
		titleTr: 'DEFCON 4: Rutin Tehdit İzleme (Düşük yoğunluklu denemeler). SoC merkezini aç.',
		titleEn: 'DEFCON 4: Routine Threat Monitoring (Low-intensity probes). Open SoC Center.',
		color: '#38bdf8',
		bg: 'rgba(56, 189, 248, 0.14)',
		border: '1px solid rgba(56, 189, 248, 0.35)',
		icon: ShieldCheck,
	},
	5: {
		labelTr: 'DEFCON 5',
		labelEn: 'DEFCON 5: NORMAL',
		titleTr: 'DEFCON 5: Normal Operasyon / Barış Hali. SoC siber güvenlik merkezini aç.',
		titleEn: 'DEFCON 5: Normal Operations. Open SoC Cyber Defense Center.',
		color: 'var(--success, #22c55e)',
		bg: 'rgba(34, 197, 94, 0.12)',
		border: '1px solid rgba(34, 197, 94, 0.28)',
		icon: ShieldCheck,
	},
};

export function DefconStatusBadge() {
	const { currentUser, canUseApp } = useSession();
	const { openApp } = useWindowActions();
	const { language } = useI18n();
	const isEn = language === 'en';
	const [defcon, setDefcon] = useState<DefconLevel>(5);

	useEffect(() => {
		if (!currentUser || !canUseApp('soc')) return;

		let active = true;
		const checkStatus = () => {
			fetch('/api/soc?action=overview')
				.then((res) => {
					if (!res.ok) return null;
					return res.json();
				})
				.then((data) => {
					if (!active || !data) return;
					const ov = data.overview;
					if (ov) {
						if (ov.lockdown?.active) {
							setDefcon(1);
						} else if (typeof ov.defcon === 'number') {
							setDefcon(ov.defcon as DefconLevel);
						}
					}
				})
				.catch(() => {});
		};

		checkStatus();
		const timer = setInterval(checkStatus, 10000);

		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [currentUser, canUseApp]);

	if (!currentUser || !canUseApp('soc')) return null;

	const style = DEFCON_STYLES[defcon] || DEFCON_STYLES[5];
	const Icon = style.icon;
	const label = isEn ? style.labelEn : style.labelTr;
	const title = isEn ? style.titleEn : style.titleTr;

	return (
		<button
			type="button"
			onClick={() => openApp('soc')}
			title={title}
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: '5px',
				background: style.bg,
				border: style.border,
				color: style.color,
				borderRadius: '12px',
				padding: '1px 8px',
				fontSize: '11px',
				fontWeight: defcon <= 2 ? 700 : 600,
				cursor: 'pointer',
				height: '20px',
				lineHeight: 1,
				animation: style.pulse ? 'pulse 2s infinite ease-in-out' : undefined,
			}}
		>
			<Icon size={12} />
			<span>{label}</span>
		</button>
	);
}

