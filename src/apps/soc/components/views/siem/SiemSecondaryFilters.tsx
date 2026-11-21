'use client';

import React from 'react';
import { Server, AlertTriangle, Globe, X, Ban, ShieldAlert, ShieldCheck, RotateCcw } from 'lucide-react';
import type { SiemFilterSnapshot } from '../../../types';
import type { SIEM_I18N } from './i18nSiem';
import s from '../../../SocSiem.module.css';

interface SiemSecondaryFiltersProps {
	siemService: string;
	setSiemService: (val: string) => void;
	siemServiceOp: 'eq' | 'neq';
	setSiemServiceOp: (val: 'eq' | 'neq') => void;
	siemLevel: string;
	setSiemLevel: (val: string) => void;
	siemLevelOp: 'eq' | 'neq';
	setSiemLevelOp: (val: 'eq' | 'neq') => void;
	siemIp: string;
	setSiemIp: (val: string) => void;
	siemIpOp: 'eq' | 'neq' | 'contains' | 'not_contains';
	setSiemIpOp: (val: 'eq' | 'neq' | 'contains' | 'not_contains') => void;
	siemSearch: string;
	copy: (typeof SIEM_I18N)['en'] | (typeof SIEM_I18N)['tr'];
	onFetch: (overrides?: Partial<SiemFilterSnapshot>) => Promise<void>;
	onResetAll: () => void;
}

export function SiemSecondaryFilters({
	siemService,
	setSiemService,
	siemServiceOp,
	setSiemServiceOp,
	siemLevel,
	setSiemLevel,
	siemLevelOp,
	setSiemLevelOp,
	siemIp,
	setSiemIp,
	siemIpOp,
	setSiemIpOp,
	siemSearch,
	copy,
	onFetch,
	onResetAll,
}: SiemSecondaryFiltersProps) {
	return (
		<div className={s.siemFiltersRow}>
			<div className={s.siemFilterPill}>
				<span className={s.siemFilterPillLabel}>
					<Server size={11} />
					{copy.serviceLabel}:
				</span>
				<button
					type="button"
					className={`${s.siemOpToggle} ${siemServiceOp === 'neq' ? s.siemOpToggleActive : ''}`}
					onClick={() => {
						const nextOp = siemServiceOp === 'eq' ? 'neq' : 'eq';
						setSiemServiceOp(nextOp);
						if (siemService !== 'all') void onFetch({ serviceOp: nextOp });
					}}
					title={siemServiceOp === 'eq' ? copy.invertToNeqTitle : copy.invertToEqTitle}
				>
					{siemServiceOp === 'neq' ? '≠' : '='}
				</button>
				<select
					className={s.siemFilterSelect}
					value={siemService}
					onChange={(e) => {
						const next = e.target.value;
						setSiemService(next);
						void onFetch({ service: next });
					}}
				>
					<option value="all">{copy.allServices}</option>
					<option value="http">http (HTTP Telemetry / Latency)</option>
					<option value="security">security (WAF / IPS / CSRF)</option>
					<option value="auth">auth (Login / 2FA / Passkey)</option>
					<option value="terminal">terminal (SSH / PTY)</option>
					<option value="database">database (SQL Studio)</option>
					<option value="chat">chat (Messaging)</option>
					<option value="oauth">oauth (OAuth2 / OIDC)</option>
					<option value="smtp">smtp (Mail Engine)</option>
				</select>
			</div>

			<div className={s.siemFilterPill}>
				<span className={s.siemFilterPillLabel}>
					<AlertTriangle size={11} />
					{copy.severityLabel}:
				</span>
				<button
					type="button"
					className={`${s.siemOpToggle} ${siemLevelOp === 'neq' ? s.siemOpToggleActive : ''}`}
					onClick={() => {
						const nextOp = siemLevelOp === 'eq' ? 'neq' : 'eq';
						setSiemLevelOp(nextOp);
						if (siemLevel !== 'all') void onFetch({ levelOp: nextOp });
					}}
				>
					{siemLevelOp === 'neq' ? '≠' : '='}
				</button>
				<select
					className={s.siemFilterSelect}
					value={siemLevel}
					onChange={(e) => {
						const next = e.target.value;
						setSiemLevel(next);
						void onFetch({ level: next });
					}}
				>
					<option value="all">{copy.allSeverities}</option>
					<option value="CRITICAL">CRITICAL</option>
					<option value="ERROR">ERROR</option>
					<option value="WARN">WARN</option>
					<option value="INFO">INFO</option>
				</select>
			</div>

			<div className={s.siemFilterPill}>
				<span className={s.siemFilterPillLabel}>
					<Globe size={11} />
					IP:
				</span>
				<button
					type="button"
					className={`${s.siemOpToggle} ${siemIpOp === 'neq' ? s.siemOpToggleActive : ''}`}
					onClick={() => {
						const nextOp = siemIpOp === 'eq' ? 'neq' : 'eq';
						setSiemIpOp(nextOp);
						if (siemIp.trim()) void onFetch({ ipOp: nextOp });
					}}
				>
					{siemIpOp === 'neq' ? '≠' : '='}
				</button>
				<input
					type="text"
					className={s.siemIpInput}
					placeholder={copy.ipPlaceholder}
					value={siemIp}
					onChange={(e) => setSiemIp(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') void onFetch();
					}}
				/>
				{siemIp && (
					<button
						type="button"
						className={s.siemOmnibarClear}
						onClick={() => {
							setSiemIp('');
							void onFetch({ ip: '' });
						}}
						title={copy.clearIpTitle}
					>
						<X size={12} />
					</button>
				)}
			</div>

			<div className={s.siemPresetDivider} />

			<button
				type="button"
				className={`${s.siemPresetChip} ${siemIp === '127.0.0.1' && siemIpOp === 'neq' ? s.siemPresetChipActive : ''}`}
				onClick={() => {
					const active = siemIp === '127.0.0.1' && siemIpOp === 'neq';
					setSiemIp(active ? '' : '127.0.0.1');
					setSiemIpOp(active ? 'eq' : 'neq');
					void onFetch({ ip: active ? '' : '127.0.0.1', ipOp: active ? 'eq' : 'neq' });
				}}
				title={copy.excludeLocalhostTitle}
				style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
			>
				<Ban size={11} />
				<span>{copy.excludeLocalhost}</span>
			</button>

			<button
				type="button"
				className={`${s.siemPresetChip} ${siemLevel === 'INFO' && siemLevelOp === 'neq' ? s.siemPresetChipActive : ''}`}
				onClick={() => {
					const active = siemLevel === 'INFO' && siemLevelOp === 'neq';
					setSiemLevel(active ? 'all' : 'INFO');
					setSiemLevelOp(active ? 'eq' : 'neq');
					void onFetch({ level: active ? 'all' : 'INFO', levelOp: active ? 'eq' : 'neq' });
				}}
				title={copy.excludeInfoTitle}
				style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
			>
				<AlertTriangle size={11} />
				<span>{copy.excludeInfo}</span>
			</button>

			<button
				type="button"
				className={`${s.siemPresetChip} ${siemLevel === 'CRITICAL' && siemLevelOp === 'eq' ? s.siemPresetChipActive : ''}`}
				onClick={() => {
					const active = siemLevel === 'CRITICAL' && siemLevelOp === 'eq';
					setSiemLevel(active ? 'all' : 'CRITICAL');
					if (!active) setSiemLevelOp('eq');
					void onFetch(active ? { level: 'all' } : { level: 'CRITICAL', levelOp: 'eq' });
				}}
				title={copy.onlyCriticalTitle}
				style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
			>
				<ShieldAlert size={11} />
				<span>{copy.onlyCritical}</span>
			</button>

			<button
				type="button"
				className={`${s.siemPresetChip} ${siemService === 'security' && siemServiceOp === 'eq' ? s.siemPresetChipActive : ''}`}
				onClick={() => {
					const active = siemService === 'security' && siemServiceOp === 'eq';
					setSiemService(active ? 'all' : 'security');
					if (!active) setSiemServiceOp('eq');
					void onFetch(active ? { service: 'all' } : { service: 'security', serviceOp: 'eq' });
				}}
				title={copy.securityWafTitle}
				style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
			>
				<ShieldCheck size={11} />
				<span>{copy.securityWaf}</span>
			</button>

			{(siemService !== 'all' || siemLevel !== 'all' || siemIp.trim() || siemSearch.trim()) && (
				<button
					type="button"
					className={s.siemResetBtn}
					onClick={onResetAll}
					title={copy.resetFiltersTitle}
				>
					<RotateCcw size={12} />
					<span>{copy.resetBtn}</span>
				</button>
			)}
		</div>
	);
}
