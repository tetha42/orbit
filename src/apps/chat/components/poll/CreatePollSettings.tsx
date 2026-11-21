'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { Shield, CheckSquare, Clock } from 'lucide-react';
import s from '../../ChatPoll.module.css';

export type DurationOption = 'none' | '1h' | '24h' | '3d' | '1w';

export function computePollEndsAt(duration: DurationOption): number | null {
	const now = Date.now();
	if (duration === '1h') return now + 3600 * 1000;
	if (duration === '24h') return now + 86400 * 1000;
	if (duration === '3d') return now + 3 * 86400 * 1000;
	if (duration === '1w') return now + 7 * 86400 * 1000;
	return null;
}

const DURATION_OPTIONS = [
	{ id: 'none', labelKey: 'chatPollDurationUnlimited' },
	{ id: '1h', labelKey: 'chatPollDuration1h' },
	{ id: '24h', labelKey: 'chatPollDuration24h' },
	{ id: '3d', labelKey: 'chatPollDuration3d' },
	{ id: '1w', labelKey: 'chatPollDuration1w' },
] as const;

interface CreatePollSettingsProps {
	anonymous: boolean;
	onAnonymousChange: (next: boolean) => void;
	multipleSelection: boolean;
	onMultipleSelectionChange: (next: boolean) => void;
	duration: DurationOption;
	onDurationChange: (next: DurationOption) => void;
}

export function CreatePollSettings({
	anonymous,
	onAnonymousChange,
	multipleSelection,
	onMultipleSelectionChange,
	duration,
	onDurationChange,
}: CreatePollSettingsProps) {
	const { t } = useI18n();

	return (
		<div className={s.pollSettingsContainer}>
			<label className={s.pollSettingItem}>
				<div className={s.pollSettingInfo}>
					<div className={s.pollSettingTitle}>
						<Shield size={15} />
						<span>{t('chatPollAnonymous')}</span>
					</div>
					<div className={s.pollSettingDesc}>{t('chatPollAnonymousDesc')}</div>
				</div>
				<input
					type="checkbox"
					className={s.pollToggle}
					checked={anonymous}
					onChange={(e) => onAnonymousChange(e.target.checked)}
				/>
			</label>

			<label className={s.pollSettingItem}>
				<div className={s.pollSettingInfo}>
					<div className={s.pollSettingTitle}>
						<CheckSquare size={15} />
						<span>{t('chatPollMultiChoice')}</span>
					</div>
					<div className={s.pollSettingDesc}>{t('chatPollMultiChoiceDesc')}</div>
				</div>
				<input
					type="checkbox"
					className={s.pollToggle}
					checked={multipleSelection}
					onChange={(e) => onMultipleSelectionChange(e.target.checked)}
				/>
			</label>

			<div className={s.pollDurationGroup}>
				<div className={s.pollDurationTitle}>
					<Clock size={15} />
					<span>{t('chatPollDuration')}</span>
				</div>
				<div className={s.pollDurationSegments}>
					{DURATION_OPTIONS.map((item) => (
						<button
							key={item.id}
							type="button"
							className={`${s.pollDurationBtn} ${
								duration === item.id ? s.pollDurationBtnActive : ''
							}`}
							onClick={() => onDurationChange(item.id)}
						>
							{t(item.labelKey)}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
