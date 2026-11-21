'use client';

import { useRef, useEffect } from 'react';
import { SlidersHorizontal, Moon, Sun, Globe } from 'lucide-react';
import { useSession } from '@/core/session';
import { getLocaleDefinition, getNextLocale, useI18n } from '@/core/i18n';
import { useShell } from '@/core/shell';
import { useTheme } from '@/core/theme';
import { ControlCenterAccountCard } from './ControlCenterAccountCard';
import { ControlCenterSliders } from './ControlCenterSliders';

export function ControlCenterApplet() {
	const { currentUser, logout } = useSession();
	const { language, setLanguage, t } = useI18n();
	const { isControlCenterOpen, setIsControlCenterOpen } = useShell();
	const { isDark, toggleTheme } = useTheme();

	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isControlCenterOpen) return;
		const handlePointerDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setIsControlCenterOpen(false);
			}
		};
		window.addEventListener('pointerdown', handlePointerDown);
		return () => window.removeEventListener('pointerdown', handlePointerDown);
	}, [isControlCenterOpen, setIsControlCenterOpen]);

	return (
		<div ref={ref} style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
			<button
				onClick={() => setIsControlCenterOpen(!isControlCenterOpen)}
				title={t('controlCenterTitle')}
				style={{
					padding: '2px 6px',
					borderRadius: '4px',
					background: isControlCenterOpen ? 'var(--fill-strong)' : 'transparent',
					cursor: 'default',
					color: 'inherit',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<SlidersHorizontal size={14} />
			</button>

			{isControlCenterOpen && (
				<div
					style={{
						position: 'absolute',
						top: '28px',
						right: 0,
						width: '300px',
						background: 'var(--menu-bg)',
						backdropFilter: 'var(--glass-blur-strong)',
						border: '1px solid var(--menu-border)',
						borderRadius: '14px',
						boxShadow: 'var(--menu-shadow)',
						padding: '14px',
						zIndex: 99999,
						fontSize: '13px',
						color: 'var(--text-primary)',
						display: 'flex',
						flexDirection: 'column',
						gap: '12px',
						userSelect: 'none',
						animation: 'modalSlideIn 150ms cubic-bezier(0.16, 1, 0.3, 1)',
					}}
				>
					{currentUser && (
						<ControlCenterAccountCard
							currentUser={currentUser}
							onLogout={() => {
								setIsControlCenterOpen(false);
								logout();
							}}
						/>
					)}

					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
						<button
							onClick={toggleTheme}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								padding: '8px 10px',
								borderRadius: '8px',
								background: 'var(--card-bg)',
								border: '1px solid var(--card-border)',
								cursor: 'default',
								color: 'inherit',
							}}
						>
							<div
								style={{
									width: '26px',
									height: '26px',
									borderRadius: '50%',
									background: isDark ? 'var(--accent-blue)' : 'var(--fill-strong)',
									color: isDark ? '#fff' : 'inherit',
									display: 'grid',
									placeItems: 'center',
									flexShrink: 0,
								}}
							>
								{isDark ? <Moon size={14} /> : <Sun size={14} />}
							</div>
							<div style={{ textAlign: 'left', minWidth: 0 }}>
								<div style={{ fontWeight: 600, fontSize: '11.5px', lineHeight: 1.2 }}>{t('darkMode')}</div>
								<div style={{ fontSize: '10.5px', opacity: 0.6 }}>
									{isDark ? t('darkModeOn') : t('darkModeOff')}
								</div>
							</div>
						</button>

						<button
							onClick={() => setLanguage(getNextLocale(language))}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								padding: '8px 10px',
								borderRadius: '8px',
								background: 'var(--card-bg)',
								border: '1px solid var(--card-border)',
								cursor: 'default',
								color: 'inherit',
							}}
						>
							<div
								style={{
									width: '26px',
									height: '26px',
									borderRadius: '50%',
									background: 'var(--accent-muted)',
									color: 'var(--accent-blue)',
									display: 'grid',
									placeItems: 'center',
									flexShrink: 0,
								}}
							>
								<Globe size={14} />
							</div>
							<div style={{ textAlign: 'left', minWidth: 0 }}>
								<div style={{ fontWeight: 600, fontSize: '11.5px', lineHeight: 1.2 }}>{t('language')}</div>
								<div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--accent-blue)' }}>
									{`${getLocaleDefinition(language).code.toUpperCase()} (${getLocaleDefinition(language).nativeName})`}
								</div>
							</div>
						</button>
					</div>

					<ControlCenterSliders />
				</div>
			)}
		</div>
	);
}
