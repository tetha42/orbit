'use client';

import React from 'react';
import { RadarView } from './components/views/RadarView';
import { FirewallView } from './components/views/FirewallView';
import { SessionsView } from './components/views/SessionsView';
import { SiemView } from './components/views/SiemView';
import { InspectionView } from './components/views/InspectionView';
import { SocAuditView } from './components/views/SocAuditView';
import { TestbenchView } from './components/views/TestbenchView';
import { SocContextMenu } from './components/ContextMenu/SocContextMenu';
import { LockdownModal } from './components/modals/LockdownModal';
import { ForensicPayloadModal } from './components/modals/ForensicPayloadModal';
import { WebhookModal } from './components/modals/WebhookModal';
import { CustomDateModal } from './components/modals/CustomDateModal';
import { SocCommandPalette } from './components/modals/SocCommandPalette';
import { isLabTab, type SocTab } from './types';

export function SocTabViews({ activeTab }: { activeTab: SocTab }) {
	return (
		<>
			{activeTab === 'radar' && <RadarView />}
			{activeTab === 'firewall' && <FirewallView />}
			{activeTab === 'sessions' && <SessionsView />}
			{activeTab === 'siem' && <SiemView />}
			{activeTab === 'inspection' && <InspectionView />}
			{activeTab === 'audit' && <SocAuditView />}
			{isLabTab(activeTab) && <TestbenchView />}
		</>
	);
}

export function SocStudioOverlays({
	commandPaletteOpen,
	onCloseCommandPalette,
}: {
	commandPaletteOpen: boolean;
	onCloseCommandPalette: () => void;
}) {
	return (
		<>
			<SocContextMenu />
			<LockdownModal />
			<ForensicPayloadModal />
			<WebhookModal />
			<CustomDateModal />
			<SocCommandPalette isOpen={commandPaletteOpen} onClose={onCloseCommandPalette} />
		</>
	);
}
