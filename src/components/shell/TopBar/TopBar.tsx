'use client';

import { MenuBar } from './MenuBar';
import { WorkspaceApplet } from './WorkspaceApplet';
import { SmtpWarningBadge } from './SmtpWarningBadge';
import { DefconStatusBadge } from './DefconStatusBadge';
import { ControlCenterApplet } from './ControlCenterApplet';
import { ClockApplet } from './ClockApplet';
import { NotificationBell } from '@/components/shell/NotificationCenter/NotificationBell';
import { useShell } from '@/core/shell';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import { Search } from 'lucide-react';

export function TopBar() {
	const { isSpotlightOpen, setIsSpotlightOpen } = useShell();
	const { connectionState } = useSession();
	const { t } = useI18n();

	return (
		<header
			data-topbar=""
			style={{
				height: '28px',
				width: '100%',
				position: 'fixed',
				top: 0,
				left: 0,
				zIndex: 9999,
				background: 'var(--topbar-bg)',
				backdropFilter: 'var(--glass-blur-strong)',
				borderBottom: '1px solid var(--topbar-border)',
				color: 'var(--topbar-text)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				padding: '0 8px',
				userSelect: 'none',
			}}
		>
			{/* Left: Dynamic App Menus + Active App TopBar Controls */}
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', minWidth: 0 }}>
				<MenuBar />
				<div id="topbar-app-controls" style={{ display: 'flex', alignItems: 'center', height: '100%' }} />
			</div>

			{/* Right: Menu Bar Extras / Status Applets */}
			<div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '100%' }}>
				{/* DEFCON Cyber Defense Status for Admins */}
				<DefconStatusBadge />

				{/* SMTP Missing Warning for Admins */}
				<SmtpWarningBadge />

				{/* Live Connection Status Dot */}
				<div
					data-live-status={connectionState}
					title={
						connectionState === 'live'
							? t('topbarConnLive')
							: connectionState === 'reconnecting'
								? t('topbarConnReconnecting')
								: t('topbarConnOffline')
					}
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						padding: '0 4px',
						height: '100%',
					}}
				>
					<span
						style={{
							width: '6px',
							height: '6px',
							borderRadius: '50%',
							backgroundColor:
								connectionState === 'live'
									? 'var(--color-success, var(--success))'
									: connectionState === 'reconnecting'
										? 'var(--color-warning, var(--warning))'
										: 'var(--color-danger, var(--danger))',
							boxShadow:
								connectionState === 'live'
									? '0 0 6px color-mix(in srgb, var(--success) 60%, transparent)'
									: connectionState === 'reconnecting'
										? '0 0 6px color-mix(in srgb, var(--warning) 60%, transparent)'
										: 'none',
							transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
						}}
					/>
				</div>

				{/* The University Club Workspace Header Menu Applet */}
				<WorkspaceApplet />

				{/* Spotlight Search Icon */}
				<button
					onClick={() => setIsSpotlightOpen(!isSpotlightOpen)}
					title={t('topbarSpotlightTitle')}
					style={{
						background: isSpotlightOpen ? 'var(--fill-strong)' : 'transparent',
						border: 'none',
						color: 'inherit',
						padding: '2px 6px',
						borderRadius: '4px',
						cursor: 'default',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<Search size={14} />
				</button>

				{/* Notification center: one bell for approvals, announcements, events and to-dos */}
				<NotificationBell />

				{/* Control Center & Clock */}
				<ControlCenterApplet />
				<ClockApplet />
			</div>
		</header>
	);
}
