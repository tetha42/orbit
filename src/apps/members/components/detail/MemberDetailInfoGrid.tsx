'use client';

import React from 'react';
import { Award, Building2, CalendarCheck, HardDrive, Hash } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatBytes } from '@/core/data/format';
import { fill } from '@/lib/text';
import type { MemberRecord } from '../../types';

interface MemberDetailInfoGridProps {
	member: MemberRecord;
}

const cellStyle: React.CSSProperties = {
	padding: '10px 12px',
	borderRadius: '10px',
	background: 'rgba(255, 255, 255, 0.03)',
	border: '1px solid var(--window-border)',
	display: 'flex',
	flexDirection: 'column',
	gap: '4px',
};

const labelStyle: React.CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: '5px',
	fontSize: '11px',
	opacity: 0.65,
};

export function MemberDetailInfoGrid({ member }: MemberDetailInfoGridProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
			<div style={cellStyle}>
				<div style={labelStyle}>
					<Building2 size={12} />
					<span>{t('membersDeptClassLabel')}</span>
				</div>
				<div style={{ fontSize: '12.5px', fontWeight: 600 }}>
					{member.department || '—'}
					{member.grade ? ` · ${fill(t('membersClassYear'), { year: member.grade })}` : ''}
				</div>
			</div>

			<div style={cellStyle}>
				<div style={labelStyle}>
					<Hash size={12} />
					<span>{t('membersStudentIdLabel')}</span>
				</div>
				<div style={{ fontSize: '12.5px', fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>
					{member.handle || member.studentNo || '—'}
				</div>
			</div>

			<div style={cellStyle}>
				<div style={labelStyle}>
					<CalendarCheck size={12} />
					<span>{t('membersAttendanceLabel')}</span>
				</div>
				<div style={{ fontSize: '12.5px', fontWeight: 600 }}>
					{member.attendanceCount ?? 0} {t('eventsAttendanceUnit')}
				</div>
			</div>

			<div style={cellStyle}>
				<div style={labelStyle}>
					<Award size={12} style={{ color: 'var(--warning)' }} />
					<span>{t('membersXpLabel')}</span>
				</div>
				<div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--warning)' }}>
					{member.xp ?? 0} XP
				</div>
			</div>

			<div style={{ ...cellStyle, gridColumn: '1 / -1' }}>
				<div style={labelStyle}>
					<HardDrive size={12} />
					<span>{t('membersColStorage')}</span>
				</div>
				<div style={{ fontSize: '12.5px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
					{formatBytes(member.diskUsageBytes)} ({member.fileCount ?? 0} {t('filesCountUnit')})
				</div>
			</div>
		</div>
	);
}
