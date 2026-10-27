'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useShell } from '@/core/shell';
import { fill } from '@/lib/text';
import { useNotifications } from './NotificationsProvider';
import { getNotificationPermission, requestNotificationPermission } from '@/lib/client/notifications';

/** The bell in the menu bar: one button, one number. Everything else is in the panel. */
export function NotificationBell() {
	const { t } = useI18n();
	const { isNotificationCenterOpen, setIsNotificationCenterOpen } = useShell();
	const { badge, hasUrgent } = useNotifications();

	const label = badge > 0 ? fill(t('ncBellLabelCount'), { n: badge }) : t('ncBellLabel');

	const handleClick = () => {
		setIsNotificationCenterOpen(!isNotificationCenterOpen);
		if (getNotificationPermission() === 'default') {
			void requestNotificationPermission();
		}
	};

	return (
		<button
			type="button"
			className="nc-bell"
			data-notification-toggle=""
			data-open={isNotificationCenterOpen || undefined}
			aria-label={label}
			title={label}
			aria-haspopup="dialog"
			aria-expanded={isNotificationCenterOpen}
			onClick={handleClick}
		>
			<Bell size={14} />
			{badge > 0 && (
				<span className="nc-badge" data-notification-badge={badge} data-urgent={hasUrgent || undefined} aria-hidden="true">
					{badge > 9 ? '9+' : badge}
				</span>
			)}
		</button>
	);
}
