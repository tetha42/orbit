'use client';

import React, { useMemo } from 'react';
import {
	Radio,
	ShieldBan,
	Users,
	FileSearch,
	ShieldCheck,
	Flame,
	Lock,
	RotateCcw,
	Download,
	Bell,
	Activity,
	Terminal,
	Zap,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSoc } from '../../../context/SocContext';
import { COMMAND_PALETTE_I18N } from '../i18nCommands';

export interface CommandItem {
	id: string;
	title: string;
	searchAlt: string;
	category: 'Navigation' | 'Defense' | 'Forensics' | 'Diagnostics';
	shortcut?: string;
	icon: React.ReactNode;
	action: () => void;
}

export function useSocCommands() {
	const {
		setActiveTab,
		openLabTab,
		canManage,
		handleExportSiem,
		handleTriggerFimScan,
		handleResetDefcon,
		handleRevokeAnomalousSessions,
		setShowWebhookModal,
		handleToggleLockdown,
	} = useSoc();
	const { language } = useI18n();
	const copy = COMMAND_PALETTE_I18N[language] ?? COMMAND_PALETTE_I18N.en;
	const altCopy =
		({ en: COMMAND_PALETTE_I18N.tr, tr: COMMAND_PALETTE_I18N.en } as const)[language] ??
		COMMAND_PALETTE_I18N.tr;

	const commands = useMemo<CommandItem[]>(() => {
		const base: CommandItem[] = [
			{
				id: 'nav_radar',
				title: copy.navRadar,
				searchAlt: altCopy.navRadar,
				category: 'Navigation',
				shortcut: '⌥1',
				icon: <Radio size={14} />,
				action: () => setActiveTab('radar'),
			},
			{
				id: 'nav_firewall',
				title: copy.navFirewall,
				searchAlt: altCopy.navFirewall,
				category: 'Navigation',
				shortcut: '⌥2',
				icon: <ShieldBan size={14} />,
				action: () => setActiveTab('firewall'),
			},
			{
				id: 'nav_sessions',
				title: copy.navSessions,
				searchAlt: altCopy.navSessions,
				category: 'Navigation',
				shortcut: '⌥3',
				icon: <Users size={14} />,
				action: () => setActiveTab('sessions'),
			},
			{
				id: 'nav_siem',
				title: copy.navSiem,
				searchAlt: altCopy.navSiem,
				category: 'Navigation',
				shortcut: '⌥4',
				icon: <FileSearch size={14} />,
				action: () => setActiveTab('siem'),
			},
			{
				id: 'nav_inspection',
				title: copy.navInspection,
				searchAlt: altCopy.navInspection,
				category: 'Navigation',
				shortcut: '⌥5',
				icon: <ShieldCheck size={14} />,
				action: () => setActiveTab('inspection'),
			},
			{
				id: 'nav_fuzzer',
				title: copy.navFuzzer,
				searchAlt: altCopy.navFuzzer,
				category: 'Diagnostics',
				shortcut: '⌥6',
				icon: <Flame size={14} />,
				action: () => openLabTab('fuzzer'),
			},
			{
				id: 'nav_oauth',
				title: copy.navOauth,
				searchAlt: altCopy.navOauth,
				category: 'Diagnostics',
				icon: <Terminal size={14} />,
				action: () => openLabTab('oauth'),
			},
			{
				id: 'nav_api',
				title: copy.navApi,
				searchAlt: altCopy.navApi,
				category: 'Diagnostics',
				icon: <Zap size={14} />,
				action: () => openLabTab('api'),
			},
			{
				id: 'nav_health',
				title: copy.navHealth,
				searchAlt: altCopy.navHealth,
				category: 'Diagnostics',
				icon: <Activity size={14} />,
				action: () => openLabTab('health'),
			},
		];

		if (canManage) {
			base.push(
				{
					id: 'def_lockdown',
					title: copy.defLockdown,
					searchAlt: altCopy.defLockdown,
					category: 'Defense',
					icon: <Lock size={14} style={{ color: 'var(--danger)' }} />,
					action: () => void handleToggleLockdown(),
				},
				{
					id: 'def_reset_defcon',
					title: copy.defResetDefcon,
					searchAlt: altCopy.defResetDefcon,
					category: 'Defense',
					icon: <RotateCcw size={14} />,
					action: () => void handleResetDefcon(),
				},
				{
					id: 'def_revoke_anomalies',
					title: copy.defRevokeAnomalies,
					searchAlt: altCopy.defRevokeAnomalies,
					category: 'Defense',
					icon: <ShieldBan size={14} style={{ color: 'var(--warning)' }} />,
					action: () => void handleRevokeAnomalousSessions(),
				},
				{
					id: 'def_webhook',
					title: copy.defWebhook,
					searchAlt: altCopy.defWebhook,
					category: 'Defense',
					icon: <Bell size={14} />,
					action: () => setShowWebhookModal(true),
				}
			);
		}

		base.push(
			{
				id: 'for_fim_scan',
				title: copy.forFimScan,
				searchAlt: altCopy.forFimScan,
				category: 'Forensics',
				icon: <ShieldCheck size={14} />,
				action: () => void handleTriggerFimScan(),
			},
			{
				id: 'for_export_csv',
				title: copy.forExportCsv,
				searchAlt: altCopy.forExportCsv,
				category: 'Forensics',
				icon: <Download size={14} />,
				action: () => handleExportSiem('csv'),
			},
			{
				id: 'for_export_json',
				title: copy.forExportJson,
				searchAlt: altCopy.forExportJson,
				category: 'Forensics',
				icon: <Download size={14} />,
				action: () => handleExportSiem('json'),
			}
		);

		return base;
	}, [
		copy,
		altCopy,
		canManage,
		setActiveTab,
		openLabTab,
		handleToggleLockdown,
		handleResetDefcon,
		handleRevokeAnomalousSessions,
		setShowWebhookModal,
		handleTriggerFimScan,
		handleExportSiem,
	]);

	return { commands, copy };
}
