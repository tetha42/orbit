'use client';

import React from 'react';
import { User, Shield, KeyRound, Loader2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { AppID } from '@/types/workspace';
import s from './Testbench.module.css';
import type { UserSessionInfo } from '../types';
import { YETKI_ACIKLAMALARI } from '@/core/permissions';

interface SessionInspectorTabProps {
	sessionInfo: UserSessionInfo | null;
	isLoading: boolean;
}

export function SessionInspectorTab({ sessionInfo, isLoading }: SessionInspectorTabProps) {
	const { t, getAppMeta, language } = useI18n();

	if (isLoading || !sessionInfo) {
		return (
			<div
				style={{
					textAlign: 'center',
					padding: '40px',
					opacity: 0.6,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: 8,
				}}
			>
				<Loader2 size={20} className={s.spin} />
				<span>{t('tbSessionLoading')}</span>
			</div>
		);
	}

	const { user, permissions } = sessionInfo;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			{/* User Profile Card */}
			<div className={s.card}>
				<div className={s.cardHeader}>
					<span className={s.cardTitle}>
						<User size={15} color="#0a84ff" /> {t('tbSessionTitle')}
					</span>
					<div style={{ display: 'flex', gap: '6px' }}>
						{user.admin && (
							<span className={`${s.badge} ${s.badgeOk}`}>
								<Shield size={12} /> {t('tbSessionSysAdmin')}
							</span>
						)}
						<span className={`${s.badge} ${user.totpEnabled ? s.badgeOk : s.badgeWarn}`}>
							<KeyRound size={12} /> {user.totpEnabled ? t('tbSession2faEnabled') : t('tbSession2faDisabled')}
						</span>
					</div>
				</div>

				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
						gap: '12px',
						marginTop: 4,
					}}
				>
					<div>
						<span style={{ fontSize: '11px', opacity: 0.6, display: 'block' }}>{t('tbSessionFullName')}</span>
						<strong style={{ fontSize: '13px' }}>
							{user.ad} {user.soyad}
						</strong>
					</div>
					<div>
						<span style={{ fontSize: '11px', opacity: 0.6, display: 'block' }}>{t('tbSessionEmail')}</span>
						<strong style={{ fontSize: '13px' }}>{user.email}</strong>
					</div>
					<div>
						<span style={{ fontSize: '11px', opacity: 0.6, display: 'block' }}>{t('tbSessionStudentId')}</span>
						<strong style={{ fontSize: '13px', fontFamily: 'ui-monospace, monospace' }}>
							{user.ogrenciNo || '—'}
						</strong>
					</div>
					<div>
						<span style={{ fontSize: '11px', opacity: 0.6, display: 'block' }}>{t('tbSessionAssignedRole')}</span>
						<strong style={{ fontSize: '13px' }}>{user.rolAd}</strong>
					</div>
					<div>
						<span style={{ fontSize: '11px', opacity: 0.6, display: 'block' }}>{t('tbSessionMembershipStatus')}</span>
						<strong style={{ fontSize: '13px', textTransform: 'capitalize' }}>
							{user.status === 'aktif' ? (language === 'en' ? 'Active' : 'Aktif') : user.status}
						</strong>
					</div>
					<div>
						<span style={{ fontSize: '11px', opacity: 0.6, display: 'block' }}>{t('tbSessionUserId')}</span>
						<code style={{ fontSize: '11px', opacity: 0.8 }}>{user.id}</code>
					</div>
				</div>
			</div>

			{/* Permissions Matrix */}
			<div className={s.tableContainer}>
				<div
					style={{
						padding: '12px 16px',
						borderBottom: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
					}}
				>
					<div>
						<h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>{t('tbSessionPermXray')}</h4>
						<p style={{ margin: '2px 0 0', fontSize: '11px', opacity: 0.6 }}>
							{t('tbSessionPermXraySub')}
						</p>
					</div>
				</div>

				<table className={s.table}>
					<thead>
						<tr>
							<th>{t('tbSessionThApp')}</th>
							<th>{t('tbSessionThAppId')}</th>
							<th>{t('tbSessionThLevel')}</th>
							<th>{t('tbSessionThScope')}</th>
						</tr>
					</thead>
					<tbody>
						{Object.entries(permissions).map(([appId, level]) => {
							const meta = YETKI_ACIKLAMALARI[appId as keyof typeof YETKI_ACIKLAMALARI];
							let ad = meta?.ad ?? appId;
							try {
								const appMeta = getAppMeta(appId as AppID);
								if (language === 'en' && appMeta?.title) {
									ad = appMeta.title;
								}
							} catch {
								// fallback to manifest ad
							}

							const desc =
								language === 'en'
									? level === 'yonet'
										? t('tbSessionDescManage')
										: level === 'kullan'
										? t('tbSessionDescUse')
										: t('tbSessionDescNone')
									: level === 'yonet'
									? meta?.yonet ?? t('tbSessionDescManage')
									: level === 'kullan'
									? meta?.kullan ?? t('tbSessionDescUse')
									: t('tbSessionDescNone');

							return (
								<tr key={appId}>
									<td style={{ fontWeight: 600 }}>{ad}</td>
									<td>
										<code
											style={{ fontSize: '11px', opacity: 0.8, cursor: 'text', userSelect: 'text' }}
											onDoubleClick={(e) => {
												e.stopPropagation();
												const selection = window.getSelection();
												if (!selection) return;
												const range = document.createRange();
												range.selectNodeContents(e.currentTarget);
												selection.removeAllRanges();
												selection.addRange(range);
											}}
										>
											{appId}
										</code>
									</td>
									<td>
										<span
											className={`${s.badge} ${
												level === 'yonet' ? s.badgeOk : level === 'kullan' ? s.badgeWarn : s.badgeFail
											}`}
										>
											{level === 'yonet'
												? t('tbSessionLevelManage')
												: level === 'kullan'
												? t('tbSessionLevelUse')
												: t('tbSessionLevelNone')}
										</span>
									</td>
									<td style={{ fontSize: '11.5px', opacity: 0.75 }}>{desc}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
