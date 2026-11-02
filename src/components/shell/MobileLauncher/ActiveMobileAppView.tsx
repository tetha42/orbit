'use client';

import { useEffect, useState } from 'react';
import { AppID } from '@/types/workspace';
import { ALL_APPS_CONFIG } from '@/configs/apps.config';
import { ArrowLeft } from 'lucide-react';
import { AppContent } from '@/core/apps/registry';
import { MOBILE_SUBVIEW_EVENT } from '@/lib/client/useMobileSubView';

interface ActiveMobileAppViewProps {
	activeMobileApp: AppID;
	onClose: () => void;
}

export function ActiveMobileAppView({ activeMobileApp, onClose }: ActiveMobileAppViewProps) {
	const meta = ALL_APPS_CONFIG[activeMobileApp];
	const [hasSubViewHeader, setHasSubViewHeader] = useState(false);

	useEffect(() => {
		const handleSubView = (e: Event) => {
			const customEvent = e as CustomEvent<{ active?: boolean }>;
			setHasSubViewHeader(Boolean(customEvent.detail?.active));
		};
		const handleClose = () => {
			onClose();
		};

		window.addEventListener(MOBILE_SUBVIEW_EVENT, handleSubView);
		window.addEventListener('clubpanel:close-mobile-app', handleClose);
		return () => {
			window.removeEventListener(MOBILE_SUBVIEW_EVENT, handleSubView);
			window.removeEventListener('clubpanel:close-mobile-app', handleClose);
		};
	}, [onClose]);

	// Reset subview header state when active app changes
	const [prevApp, setPrevApp] = useState(activeMobileApp);
	if (activeMobileApp !== prevApp) {
		setPrevApp(activeMobileApp);
		setHasSubViewHeader(false);
	}

	return (
		<div
			style={{
				position: 'relative',
				zIndex: 1,
				height: '100dvh',
				maxHeight: '100dvh',
				display: 'flex',
				flexDirection: 'column',
				background: 'var(--window-bg)',
				color: 'var(--text-primary)',
				fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
				overflow: 'hidden',
			}}
		>
			{/* Mobile Navigation Header (suppressed when app provides its own subview/detail header) */}
			{!hasSubViewHeader && (
				<div
					style={{
						height: '52px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '0 16px',
						background: '#121216',
						borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
						position: 'sticky',
						top: 0,
						zIndex: 9999,
						flexShrink: 0,
					}}
				>
					<button
						onClick={onClose}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '6px',
							background: 'rgba(255, 255, 255, 0.1)',
							border: '1px solid rgba(255, 255, 255, 0.15)',
							borderRadius: '20px',
							padding: '6px 14px',
							color: '#fff',
							fontSize: '13px',
							fontWeight: 600,
							cursor: 'pointer',
						}}
					>
						<ArrowLeft size={16} />
						<span>Geri</span>
					</button>

					<div style={{ fontSize: '15px', fontWeight: 700 }}>
						{meta?.shortTitle || meta?.title || ''}
					</div>

					<div style={{ width: '60px' }} />
				</div>
			)}

			{/* App Content */}
			<div
				className="mini-app-frame"
				data-app-id={activeMobileApp}
				data-lenis-prevent
				data-lenis-prevent-wheel
				data-lenis-prevent-touch
				style={{
					flex: 1,
					minHeight: 0,
					overflowY:
						activeMobileApp === 'terminal' ||
						activeMobileApp === 'settings' ||
						activeMobileApp === 'database' ||
						activeMobileApp === 'chat' ||
						activeMobileApp === 'mail' ||
						activeMobileApp === 'events' ||
						activeMobileApp === 'notes' ||
						activeMobileApp === 'budget' ||
						activeMobileApp === 'members' ||
						activeMobileApp === 'inventory' ||
						activeMobileApp === 'projects' ||
						activeMobileApp === 'certificates' ||
						activeMobileApp === 'soc' ||
						activeMobileApp === 'teams'
							? 'hidden'
							: 'auto',
					overflowX: 'hidden',
					WebkitOverflowScrolling: 'touch',
					touchAction: 'pan-y',
					overscrollBehaviorY: 'contain',
					width: '100%',
					padding: 0,
					paddingBottom: 0,
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				<AppContent appId={activeMobileApp} close={onClose} />
			</div>
		</div>
	);
}
