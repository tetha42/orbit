/**
 * Client-Side Notification Manager (Zero Cloud Dependency)
 * 
 * Uses standard Web Notification API and Service Worker showNotification
 * to present instant notifications when new messages, events, or approvals arrive,
 * without requiring any external cloud providers (FCM/Apple APNs).
 */

export async function requestNotificationPermission(): Promise<NotificationPermission> {
	if (typeof window === 'undefined' || !('Notification' in window)) {
		return 'denied';
	}
	return Notification.requestPermission();
}

export function getNotificationPermission(): NotificationPermission {
	if (typeof window === 'undefined' || !('Notification' in window)) {
		return 'denied';
	}
	return Notification.permission;
}

export interface AppNotificationOptions {
	body?: string;
	tag?: string;
	data?: Record<string, unknown>;
	silent?: boolean;
}

export async function showAppNotification(
	title: string,
	options: AppNotificationOptions = {}
): Promise<boolean> {
	if (typeof window === 'undefined' || !('Notification' in window)) {
		return false;
	}

	if (Notification.permission !== 'granted') {
		return false;
	}

	try {
		// Try using Service Worker registration first (standard for PWAs)
		if ('serviceWorker' in navigator) {
			const reg = await navigator.serviceWorker.ready;
			if (reg && 'showNotification' in reg) {
				await reg.showNotification(title, {
					icon: '/assets/img/logo-girdap.svg',
					badge: '/assets/img/logo-girdap.svg',
					body: options.body,
					tag: options.tag,
					data: options.data,
					silent: options.silent,
				});
				return true;
			}
		}

		// Fallback to standard Notification constructor
		const notification = new Notification(title, {
			icon: '/assets/img/logo-girdap.svg',
			body: options.body,
			tag: options.tag,
			silent: options.silent,
			data: options.data,
		});
		notification.onclick = () => {
			window.focus();
			window.dispatchEvent(
				new CustomEvent('orbit:notification-click', {
					detail: { target: options.data?.target, messageId: options.data?.messageId },
				})
			);
			notification.close();
		};
		return true;
	} catch {
		return false;
	}
}
