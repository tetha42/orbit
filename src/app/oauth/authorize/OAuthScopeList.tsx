'use client';

import React from 'react';
import { User, Mail, GraduationCap, Award } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import styles from './oauth.module.css';
import type { AuthorizeUserData } from './types';

interface OAuthScopeListProps {
	user?: AuthorizeUserData;
	selectedScopes: string[];
	isScopeEffective: (scopeId: string) => boolean;
	onToggleScope: (scopeId: string) => void;
}

export function OAuthScopeList({
	user,
	selectedScopes,
	isScopeEffective,
	onToggleScope,
}: OAuthScopeListProps) {
	const { t } = useI18n();
	const requiredTag = t('formBadgeRequired').toUpperCase();
	const optionalTag = t('formBadgeOptional').toUpperCase();
	return (
		<div className={styles.scopeList}>
			{/* 1. Profile Scope (Mandatory) */}
			<div className={styles.scopeCard}>
				<div className={styles.scopeHeader}>
					<div className={styles.scopeTitle}>
						<User size={14} />
						<span>{t('oauthScopeCoreProfile')}</span>
					</div>
					<span className={styles.scopeTag}>{requiredTag}</span>
				</div>

				<div
					className={styles.scopePreview}
					style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}
				>
					<div>
						<span>{t('identityFullName')}: </span>
						<strong style={{ color: '#fafafa' }}>{user?.nameSurname}</strong>
					</div>
					<div>
						<span>{t('oauthFieldSubjectId')}: </span>
						<code style={{ color: '#fafafa', fontSize: '10.5px' }}>{user?.id?.slice(0, 12)}…</code>
					</div>
				</div>
			</div>

			{/* 2. Email Scope (Toggleable if requested & allowed) */}
			{isScopeEffective('email') && (
				<label
					className={`${styles.scopeCard} ${selectedScopes.includes('email') ? styles.scopeCardActive : ''}`}
					style={{ cursor: 'pointer' }}
				>
					<div className={styles.scopeHeader}>
						<div className={styles.scopeTitle}>
							<input
								type="checkbox"
								checked={selectedScopes.includes('email')}
								onChange={() => onToggleScope('email')}
								style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#fafafa' }}
							/>
							<Mail size={14} />
							<span>{t('oauthScopeEmailLabel')}</span>
						</div>
						<span className={styles.scopeTag}>{optionalTag}</span>
					</div>

					<div className={styles.scopePreview}>
						<span>{t('email')}: </span>
						<strong style={{ color: '#fafafa' }}>{user?.email}</strong>
					</div>
				</label>
			)}

			{/* 3. Academic / Track Scope (Toggleable if requested & allowed) */}
			{isScopeEffective('academic') && (
				<label
					className={`${styles.scopeCard} ${selectedScopes.includes('academic') ? styles.scopeCardActive : ''}`}
					style={{ cursor: 'pointer' }}
				>
					<div className={styles.scopeHeader}>
						<div className={styles.scopeTitle}>
							<input
								type="checkbox"
								checked={selectedScopes.includes('academic')}
								onChange={() => onToggleScope('academic')}
								style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#fafafa' }}
							/>
							<GraduationCap size={14} />
							<span>{t('oauthScopeAcademicLabel')}</span>
						</div>
						<span className={styles.scopeTag}>{optionalTag}</span>
					</div>

					<div
						className={styles.scopePreview}
						style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px' }}
					>
						<div>
							<span>{t('oauthFieldMemberId')}: </span>
							<strong style={{ color: '#fafafa' }}>{user?.studentNo || '—'}</strong>
						</div>
						<div>
							<span>{t('oauthFieldTrack')}: </span>
							<strong style={{ color: '#fafafa' }}>{user?.department || '—'}</strong>
						</div>
						<div>
							<span>{t('certsLevel')}: </span>
							<strong style={{ color: '#fafafa' }}>
								{user?.grade ? fill(t('acLevel'), { n: user.grade }) : '—'}
							</strong>
						</div>
					</div>
				</label>
			)}

			{/* 4. Roles Scope (Toggleable if requested & allowed) */}
			{isScopeEffective('roles') && (
				<label
					className={`${styles.scopeCard} ${selectedScopes.includes('roles') ? styles.scopeCardActive : ''}`}
					style={{ cursor: 'pointer' }}
				>
					<div className={styles.scopeHeader}>
						<div className={styles.scopeTitle}>
							<input
								type="checkbox"
								checked={selectedScopes.includes('roles')}
								onChange={() => onToggleScope('roles')}
								style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#fafafa' }}
							/>
							<Award size={14} />
							<span>{t('oauthScopeRolesLabel')}</span>
						</div>
						<span className={styles.scopeTag}>{optionalTag}</span>
					</div>

					<div
						className={styles.scopePreview}
						style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}
					>
						<div>
							<span>{t('rosterColRole')}: </span>
							<strong style={{ color: '#fafafa' }}>{user?.roleName || t('driveShareMember')}</strong>
						</div>
						<div>
							<span>{t('oauthFieldReputation')}: </span>
							<strong style={{ color: '#fafafa' }}>{user?.xp ?? 0} XP</strong>
						</div>
					</div>
				</label>
			)}
		</div>
	);
}
