'use client';

import { useEffect } from 'react';

export const MOBILE_SUBVIEW_EVENT = 'clubpanel:mobile-subview';

/**
 * Signals to ActiveMobileAppView whether the current mini app is inside a nested
 * screen/detail view (e.g. event detail, settings panel, note editor, chat room).
 * When active is true, ActiveMobileAppView suppresses its shell top bar so only
 * the app's authentic back navigation header is shown, preventing duplicate stacked headers.
 */
export function useMobileSubView(active: boolean) {
	useEffect(() => {
		if (typeof window === 'undefined') return;
		window.dispatchEvent(
			new CustomEvent(MOBILE_SUBVIEW_EVENT, { detail: { active } })
		);
		return () => {
			window.dispatchEvent(
				new CustomEvent(MOBILE_SUBVIEW_EVENT, { detail: { active: false } })
			);
		};
	}, [active]);
}
