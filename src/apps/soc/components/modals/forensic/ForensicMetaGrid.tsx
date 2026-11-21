'use client';

import React from 'react';
import { formatDateTime } from '../../../types';
import type { SystemLog } from '../../../types';
import type { Language } from '@/lib/i18n';
import type { MODALS_I18N } from '../i18nModals';

interface ForensicMetaGridProps {
	forensicLog: SystemLog;
	language: Language;
	copy: (typeof MODALS_I18N)['en'] | (typeof MODALS_I18N)['tr'];
	onDoubleClickSelect: (e: React.MouseEvent<HTMLElement>) => void;
	onFilterIp: (ip: string) => void;
}

export function ForensicMetaGrid({
	forensicLog,
	language,
	copy,
	onDoubleClickSelect,
	onFilterIp,
}: ForensicMetaGridProps) {
	const isDangerLevel = forensicLog.level === 'CRITICAL' || forensicLog.level === 'ERROR';

	return (
		<div
			style={{
				display: 'grid',
				gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
				gap: 8,
				padding: 10,
				borderRadius: 8,
				background: 'var(--fill-soft, rgba(0, 0, 0, 0.03))',
				border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
				fontSize: 12,
			}}
		>
			<div>
				<div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
					{copy.forensicTimestamp}
				</div>
				<span
					data-type="timestamp"
					onDoubleClick={onDoubleClickSelect}
					style={{ fontFamily: 'monospace', fontWeight: 600, userSelect: 'text' }}
					title={copy.forensicTimestampHint}
				>
					{formatDateTime(forensicLog.time, language)}
				</span>
			</div>

			<div>
				<div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
					{copy.forensicServiceLevel}
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
					<span
						data-type="level"
						onDoubleClick={onDoubleClickSelect}
						style={{
							padding: '1px 6px',
							borderRadius: 4,
							fontWeight: 700,
							fontSize: 10.5,
							background: isDangerLevel
								? 'color-mix(in srgb, var(--danger) 15%, transparent)'
								: 'color-mix(in srgb, var(--warning) 15%, transparent)',
							color: isDangerLevel ? 'var(--danger)' : 'var(--warning)',
							userSelect: 'text',
						}}
					>
						{forensicLog.level}
					</span>
					<span
						data-type="service"
						onDoubleClick={onDoubleClickSelect}
						style={{
							fontFamily: 'monospace',
							padding: '1px 5px',
							borderRadius: 4,
							background: 'var(--fill-soft, rgba(0, 0, 0, 0.05))',
							fontSize: 11,
							userSelect: 'text',
						}}
					>
						{forensicLog.service}
					</span>
				</div>
			</div>

			<div>
				<div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
					{copy.forensicClientIp}
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
					<span
						data-type="ip"
						onDoubleClick={onDoubleClickSelect}
						style={{ fontFamily: 'monospace', fontWeight: 600, userSelect: 'text' }}
						title={copy.forensicIpHint}
					>
						{forensicLog.ip || '—'}
					</span>
					{forensicLog.ip && forensicLog.ip !== 'unknown' && (
						<button
							type="button"
							onClick={() => onFilterIp(forensicLog.ip)}
							style={{
								border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
								background: 'transparent',
								borderRadius: 3,
								fontSize: 10,
								padding: '1px 4px',
								cursor: 'pointer',
								color: 'var(--accent)',
							}}
							title={copy.forensicFilterIpTitle}
						>
							{copy.forensicFilterAdd}
						</button>
					)}
				</div>
			</div>

			<div>
				<div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
					{copy.forensicActor}
				</div>
				<span
					data-type="actor"
					onDoubleClick={onDoubleClickSelect}
					style={{ fontFamily: 'monospace', userSelect: 'text' }}
				>
					{forensicLog.userId || 'anonymous'}
				</span>
			</div>
		</div>
	);
}
