'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { TEAM_LIMIT } from '@/lib/teams';
import ui from '@/core/ui/ui.module.css';
import type { Team } from '../types';

interface TeamJoinButtonProps {
	team: Team;
	currentUserId: string;
	busy: boolean;
	myTeams: number;
	onJoin: (tm: Team) => void;
	onLeave: (tm: Team) => void;
}

export function TeamJoinButton({
	team: tm,
	currentUserId,
	busy,
	myTeams,
	onJoin,
	onLeave,
}: TeamJoinButtonProps) {
	const { t } = useI18n();

	if (tm.myMyStatus === 'aktif') {
		return tm.leadId === currentUserId ? null : (
			<button type="button" className={`${ui.btn} ${ui.btnDanger}`} disabled={busy} onClick={() => onLeave(tm)}>
				{t('tmLeave')}
			</button>
		);
	}
	if (tm.myMyStatus === 'basvurdu') {
		return (
			<button type="button" className={ui.btn} disabled={busy} onClick={() => onLeave(tm)}>
				{t('tmWithdraw')}
			</button>
		);
	}
	const closed = tm.status !== 'aktif';
	const full = tm.remainingCapacity === 0 && tm.participationType === 'acik';
	const limit = myTeams >= TEAM_LIMIT;
	return (
		<button
			type="button"
			className={ui.primaryBtn}
			disabled={busy || closed || full || limit}
			title={limit ? fill(t('tmLimitReached'), { n: TEAM_LIMIT }) : undefined}
			onClick={() => onJoin(tm)}
		>
			<Plus size={14} />
			{closed ? t('tmClosed') : full ? t('tmFull') : tm.participationType === 'onayli' ? t('tmApply') : t('tmJoin')}
		</button>
	);
}
