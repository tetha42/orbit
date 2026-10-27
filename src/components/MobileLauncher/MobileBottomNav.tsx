'use client';

import { useEffect } from 'react';
import { LayoutGrid, Home, UserCircle, Users, type LucideIcon } from 'lucide-react';
import { useI18n } from '@/core/i18n';

export type MobileTab = 'home' | 'apps' | 'teams' | 'profile';

const TABS: { id: MobileTab; Icon: LucideIcon; label: string }[] = [
	{ id: 'home', Icon: Home, label: 'mobTabHome' },
	{ id: 'apps', Icon: LayoutGrid, label: 'mobTabApps' },
	{ id: 'teams', Icon: Users, label: 'mobTabTeams' },
	{ id: 'profile', Icon: UserCircle, label: 'mobTabProfile' },
];

/** Height of the bar without the device's safe area; the page keeps this much room below its content. */
export const MOBILE_NAV_HEIGHT = 64;

/**
 * The thumb bar at the bottom of the phone launcher: four tabs, each a full-height
 * touch target. It sits above the home indicator (safe-area inset).
 */
export function MobileBottomNav({ tab, onChange }: { tab: MobileTab; onChange: (tab: MobileTab) => void }) {
	const { t } = useI18n();
	// Floating controls (the ambient-sound button) sit above the bar instead of under it.
	useEffect(() => {
		const root = document.documentElement;
		root.style.setProperty('--mobile-nav-offset', `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom))`);
		return () => {
			root.style.removeProperty('--mobile-nav-offset');
		};
	}, []);
	return (
		<nav
			aria-label={t('mobNavLabel')}
			data-mobile-nav
			style={{
				position: 'fixed',
				left: 0,
				right: 0,
				bottom: 0,
				zIndex: 20,
				display: 'grid',
				gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
				paddingBottom: 'env(safe-area-inset-bottom)',
				background: '#121216',
				borderTop: '1px solid rgba(255, 255, 255, 0.12)',
			}}
		>
			{TABS.map(({ id, Icon, label }) => {
				const active = tab === id;
				return (
					<button
						key={id}
						type="button"
						data-mobile-tab={id}
						aria-current={active ? 'page' : undefined}
						onClick={() => onChange(id)}
						style={{
							height: `${MOBILE_NAV_HEIGHT}px`,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							gap: '4px',
							background: 'none',
							border: 0,
							cursor: 'pointer',
							color: active ? '#0a84ff' : 'rgba(255, 255, 255, 0.6)',
							fontSize: '10.5px',
							fontWeight: active ? 700 : 500,
							padding: 0,
						}}
					>
						<Icon size={22} aria-hidden="true" />
						<span>{t(label)}</span>
					</button>
				);
			})}
		</nav>
	);
}
