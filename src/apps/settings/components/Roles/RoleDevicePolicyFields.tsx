'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import type { DesktopAuthPolicy } from '@/db/roles/types';
import ui from '@/core/ui/ui.module.css';
import s from './Roles.module.css';

interface RoleDevicePolicyFieldsProps {
	allowMobileAccess: boolean;
	allowDesktopAccess: boolean;
	desktopAuthPolicy: DesktopAuthPolicy;
	onChangeMobile: (value: boolean) => void;
	onChangeDesktop: (value: boolean) => void;
	onChangePolicy: (value: DesktopAuthPolicy) => void;
}

export function RoleDevicePolicyFields({
	allowMobileAccess,
	allowDesktopAccess,
	desktopAuthPolicy,
	onChangeMobile,
	onChangeDesktop,
	onChangePolicy,
}: RoleDevicePolicyFieldsProps) {
	const { t } = useI18n();
	const neitherAllowed = !allowMobileAccess && !allowDesktopAccess;

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: '10px',
				padding: '12px',
				borderRadius: '10px',
				border: '1px solid var(--card-border)',
				background: 'var(--fill-softer)',
			}}
		>
			<div className={ui.fieldLabel}>{t('rolesDevicePolicyTitle')}</div>
			<label className={s.check}>
				<input
					type="checkbox"
					checked={allowMobileAccess}
					onChange={(e) => onChangeMobile(e.target.checked)}
				/>
				<span>{t('rolesAllowMobileAccess')}</span>
			</label>
			<label className={s.check}>
				<input
					type="checkbox"
					checked={allowDesktopAccess}
					onChange={(e) => onChangeDesktop(e.target.checked)}
				/>
				<span>{t('rolesAllowDesktopAccess')}</span>
			</label>
			{neitherAllowed && <div className={ui.error}>{t('rolesDeviceAccessMinOneWarning')}</div>}
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('rolesDesktopAuthPolicy')}</span>
				<select
					className={ui.select}
					value={desktopAuthPolicy}
					disabled={!allowDesktopAccess}
					onChange={(e) => onChangePolicy(e.target.value as DesktopAuthPolicy)}
				>
					<option value="standard">{t('rolesPolicyStandard')}</option>
					<option value="mobile_preferred">{t('rolesPolicyMobilePreferred')}</option>
					<option value="mobile_required">{t('rolesPolicyMobileRequired')}</option>
				</select>
				<span className={ui.hint}>{t('rolesDesktopAuthPolicyHint')}</span>
			</label>
		</div>
	);
}
