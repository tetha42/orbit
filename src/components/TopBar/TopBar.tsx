'use client';

import { MenuBar } from './MenuBar';
import { WorkspaceApplet } from './WorkspaceApplet';
import { SmtpWarningBadge } from './SmtpWarningBadge';
import { DefconStatusBadge } from './DefconStatusBadge';
import { ControlCenterApplet } from './ControlCenterApplet';
import { ClockApplet } from './ClockApplet';
import { NotificationBell } from '@/components/NotificationCenter/NotificationBell';
import { useShell } from '@/core/shell';
import { Search } from 'lucide-react';

export function TopBar() {
	const { isSpotlightOpen, setIsSpotlightOpen } = useShell();

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

				{/* The University Club Workspace Header Menu Applet */}
				<WorkspaceApplet />

				{/* Spotlight Search Icon */}
				<button
					onClick={() => setIsSpotlightOpen(!isSpotlightOpen)}
					title="Spotlight Search (Shift+Space / ⌘Space)"
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
