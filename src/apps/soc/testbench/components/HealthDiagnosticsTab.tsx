'use client';

import React from 'react';
import {
	Database,
	ShieldCheck,
	Radio,
	Mail,
	Cpu,
	RefreshCw,
	Users,
	Shield,
	Zap,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import s from './Testbench.module.css';
import type { SystemDiagnostics } from '../types';

interface HealthDiagnosticsTabProps {
	health: SystemDiagnostics | null;
	isLoading: boolean;
	onRefresh: () => void;
}

export function HealthDiagnosticsTab({ health, isLoading, onRefresh }: HealthDiagnosticsTabProps) {
	const { t, language } = useI18n();

	if (!health) {
		return (
			<div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
				{t('tbHealthLoading')}
			</div>
		);
	}

	const formatUptime = (seconds: number) => {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		if (language === 'en') {
			return `${h}h ${m}m ${s}s`;
		}
		return `${h}s ${m}d ${s}sn`;
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
				<div>
					<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
						{t('tbHealthTitle')}
					</h3>
					<p style={{ margin: '3px 0 0', fontSize: '12px', opacity: 0.65 }}>
						{t('tbHealthDesc')}
					</p>
				</div>
				<button
					type="button"
					className={s.btnSecondaryMd}
					disabled={isLoading}
					onClick={onRefresh}
				>
					<RefreshCw size={14} className={isLoading ? s.spin : ''} />
					<span>{t('tbHealthRefresh')}</span>
				</button>
			</div>

			<div className={s.grid}>
				{/* 1. Database Card */}
				<div className={s.card}>
					<div className={s.cardHeader}>
						<span className={s.cardTitle}>
							<Database size={16} color="#0a84ff" /> {t('tbHealthDb')}
						</span>
						<span className={`${s.badge} ${health.database.connected ? s.badgeOk : s.badgeFail}`}>
							{health.database.connected ? t('tbHealthDbConnected') : t('tbHealthDbDisconnected')}
						</span>
					</div>
					<div className={s.cardValue}>{health.database.latencyMs} ms</div>
					<div className={s.cardSub}>
						{fill(t('tbHealthDbPool'), {
							total: health.database.poolTotal,
							idle: health.database.poolIdle,
						})}
					</div>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 4 }}>
						<span className={s.miniBadge}>
							<Users size={12} color="#0a84ff" />
							<span>{fill(t('tbHealthMembers'), { count: health.database.counts.users })}</span>
						</span>
						<span className={s.miniBadge}>
							<Shield size={12} color="#34c759" />
							<span>{fill(t('tbHealthRoles'), { count: health.database.counts.roles })}</span>
						</span>
						<span className={s.miniBadge}>
							<Zap size={12} color="var(--accent)" />
							<span>{fill(t('tbHealthOAuthApps'), { count: health.database.counts.oauthClients })}</span>
						</span>
					</div>
				</div>

				{/* 2. OAuth & JWKS Card */}
				<div className={s.card}>
					<div className={s.cardHeader}>
						<span className={s.cardTitle}>
							<ShieldCheck size={16} color="#34c759" /> {t('tbHealthOAuthJwks')}
						</span>
						<span className={`${s.badge} ${s.badgeOk}`}>{t('tbHealthActive')}</span>
					</div>
					<div className={s.cardValue} style={{ fontSize: '18px' }}>
						{fill(t('tbHealthIntegratedClients'), { count: health.oauth.clientsCount })}
					</div>
					<div className={s.cardSub}>
						{t('tbHealthOidcSignature')}
					</div>
					<div style={{ fontSize: '11px', marginTop: 4 }}>
						<code style={{ opacity: 0.85, padding: '2px 6px', background: 'var(--fill-soft, rgba(0,0,0,0.06))', border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))', borderRadius: 4 }}>/api/oauth/jwks</code>
					</div>
				</div>

				{/* 3. Event Stream Card */}
				<div className={s.card}>
					<div className={s.cardHeader}>
						<span className={s.cardTitle}>
							<Radio size={16} color="var(--accent)" /> {t('tbHealthEventStream')}
						</span>
						<span className={`${s.badge} ${s.badgeOk}`}>{t('tbHealthActive')}</span>
					</div>
					<div className={s.cardValue} style={{ fontSize: '18px' }}>
						SSE Broadcaster
					</div>
					<div className={s.cardSub}>
						{t('tbHealthEventStreamSub')}
					</div>
					<div style={{ fontSize: '11px', opacity: 0.7, marginTop: 4 }}>
						{t('tbHealthEventStreamDesc')}
					</div>
				</div>

				{/* 4. SMTP Email Card */}
				<div className={s.card}>
					<div className={s.cardHeader}>
						<span className={s.cardTitle}>
							<Mail size={16} color="#af52de" /> {t('tbHealthSmtp')}
						</span>
						<span className={`${s.badge} ${health.smtp.configured ? s.badgeOk : s.badgeWarn}`}>
							{health.smtp.configured ? t('tbHealthSmtpConfigured') : t('tbHealthSmtpNotConfigured')}
						</span>
					</div>
					<div className={s.cardValue} style={{ fontSize: '18px' }}>
						{health.smtp.host || '—'}
					</div>
					<div className={s.cardSub}>
						{fill(t('tbHealthSmtpPortPwd'), {
							port: health.smtp.port || '—',
							hasPwd: health.smtp.hasPassword
								? t('tbHealthPasswordPresent')
								: t('tbHealthPasswordMissing'),
						})}
					</div>
				</div>
			</div>

			{/* Server Runtime Environment */}
			<div className={s.card} style={{ marginTop: 4 }}>
				<div className={s.cardHeader}>
					<span className={s.cardTitle}>
						<Cpu size={16} color="#30d158" /> {t('tbHealthRuntime')}
					</span>
				</div>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginTop: 6 }}>
					<div>
						<span style={{ fontSize: '11.5px', opacity: 0.65, display: 'block' }}>{t('tbHealthNodeVer')}</span>
						<strong style={{ fontSize: '13.5px' }}>{health.runtime.nodeVersion}</strong>
					</div>
					<div>
						<span style={{ fontSize: '11.5px', opacity: 0.65, display: 'block' }}>{t('tbHealthOsPlatform')}</span>
						<strong style={{ fontSize: '13.5px' }}>{health.runtime.platform} (Linux x86_64)</strong>
					</div>
					<div>
						<span style={{ fontSize: '11.5px', opacity: 0.65, display: 'block' }}>{t('tbHealthServerUptime')}</span>
						<strong style={{ fontSize: '13.5px' }}>{formatUptime(health.runtime.uptimeSec)}</strong>
					</div>
					<div>
						<span style={{ fontSize: '11.5px', opacity: 0.65, display: 'block' }}>{t('tbHealthHeapMem')}</span>
						<strong style={{ fontSize: '13.5px' }}>{health.runtime.memoryMb} MB</strong>
					</div>
					<div>
						<span style={{ fontSize: '11.5px', opacity: 0.65, display: 'block' }}>{t('tbHealthServerTime')}</span>
						<strong style={{ fontSize: '13.5px' }}>
							{new Date(health.runtime.serverTime).toLocaleTimeString(
								language === 'en' ? 'en-US' : 'tr-TR'
							)}
						</strong>
					</div>
				</div>
			</div>
		</div>
	);
}
