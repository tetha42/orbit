'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
	Search,
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
import { useSoc } from '../../context/SocContext';
import styles from './SocModals.module.css';

interface CommandItem {
	id: string;
	title: string;
	titleEn: string;
	category: 'Navigation' | 'Defense' | 'Forensics' | 'Diagnostics';
	shortcut?: string;
	icon: React.ReactNode;
	action: () => void;
}

interface SocCommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
}

export const SocCommandPalette: React.FC<SocCommandPaletteProps> = ({ isOpen, onClose }) => {
	const {
		setActiveTab,
		openLabTab,
		isEn,
		canManage,
		handleExportSiem,
		handleTriggerFimScan,
		handleResetDefcon,
		handleRevokeAnomalousSessions,
		setShowWebhookModal,
		handleToggleLockdown,
	} = useSoc();

	const [query, setQuery] = useState('');
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			setQuery('');
			setSelectedIndex(0);
			setTimeout(() => inputRef.current?.focus(), 50);
		}
	}, [isOpen]);

	const commands: CommandItem[] = [
		// Navigation
		{
			id: 'nav_radar',
			title: 'Canlı Tehdit Radarına Git',
			titleEn: 'Navigate to Live Threat Radar',
			category: 'Navigation',
			shortcut: '⌥1',
			icon: <Radio size={14} />,
			action: () => setActiveTab('radar'),
		},
		{
			id: 'nav_firewall',
			title: 'Güvenlik Duvarı ve Karantinaya Git',
			titleEn: 'Navigate to Firewall & Quarantine',
			category: 'Navigation',
			shortcut: '⌥2',
			icon: <ShieldBan size={14} />,
			action: () => setActiveTab('firewall'),
		},
		{
			id: 'nav_sessions',
			title: 'Aktif Oturumlara Git',
			titleEn: 'Navigate to Active Sessions',
			category: 'Navigation',
			shortcut: '⌥3',
			icon: <Users size={14} />,
			action: () => setActiveTab('sessions'),
		},
		{
			id: 'nav_siem',
			title: 'SIEM Adli Analiz Merkezine Git',
			titleEn: 'Navigate to SIEM Forensics',
			category: 'Navigation',
			shortcut: '⌥4',
			icon: <FileSearch size={14} />,
			action: () => setActiveTab('siem'),
		},
		{
			id: 'nav_inspection',
			title: 'Mavi Takım Teftişine Git (FIM & API Sec)',
			titleEn: 'Navigate to Blue Team Inspection (FIM & API Sec)',
			category: 'Navigation',
			shortcut: '⌥5',
			icon: <ShieldCheck size={14} />,
			action: () => setActiveTab('inspection'),
		},
		{
			id: 'nav_fuzzer',
			title: 'WAF & Red Team Saldırı Simülatörünü Aç',
			titleEn: 'Open WAF & Red Team Attack Fuzzer',
			category: 'Diagnostics',
			shortcut: '⌥6',
			icon: <Flame size={14} />,
			action: () => openLabTab('fuzzer'),
		},
		{
			id: 'nav_oauth',
			title: 'OAuth 2.0 Simülatörünü Aç',
			titleEn: 'Open OAuth 2.0 Lab Simulator',
			category: 'Diagnostics',
			icon: <Terminal size={14} />,
			action: () => openLabTab('oauth'),
		},
		{
			id: 'nav_api',
			title: 'API Güvenlik Paketini Aç',
			titleEn: 'Open API Security Suite',
			category: 'Diagnostics',
			icon: <Zap size={14} />,
			action: () => openLabTab('api'),
		},
		{
			id: 'nav_health',
			title: 'Sistem Sağlık Tanılarını Aç',
			titleEn: 'Open System Health Diagnostics',
			category: 'Diagnostics',
			icon: <Activity size={14} />,
			action: () => openLabTab('health'),
		},

		// Defense & Operations
		...(canManage
			? [
					{
						id: 'def_lockdown',
						title: 'Acil Durum Küresel Kilitleme (Lockdown)',
						titleEn: 'Engage Global Security Lockdown',
						category: 'Defense' as const,
						icon: <Lock size={14} style={{ color: '#d70015' }} />,
						action: () => void handleToggleLockdown(),
					},
					{
						id: 'def_reset_defcon',
						title: 'DEFCON Seviyesini Sıfırla (Barış Hali)',
						titleEn: 'Reset DEFCON Baseline (Peacetime)',
						category: 'Defense' as const,
						icon: <RotateCcw size={14} />,
						action: () => void handleResetDefcon(),
					},
					{
						id: 'def_revoke_anomalies',
						title: 'IP Anomalisi Olan Şüpheli Oturumları Düşür',
						titleEn: 'Drop All Anomalous Sessions',
						category: 'Defense' as const,
						icon: <ShieldBan size={14} style={{ color: '#ff9500' }} />,
						action: () => void handleRevokeAnomalousSessions(),
					},
					{
						id: 'def_webhook',
						title: 'Güvenlik Alarm Webhooklarını Yapılandır',
						titleEn: 'Configure Security Alert Webhooks',
						category: 'Defense' as const,
						icon: <Bell size={14} />,
						action: () => setShowWebhookModal(true),
					},
			  ]
			: []),

		// Forensics
		{
			id: 'for_fim_scan',
			title: 'FIM Dosya Bütünlüğü Taraması Başlat',
			titleEn: 'Trigger FIM Integrity Scan',
			category: 'Forensics',
			icon: <ShieldCheck size={14} />,
			action: () => void handleTriggerFimScan(),
		},
		{
			id: 'for_export_csv',
			title: 'SIEM Loglarını Dışa Aktar (CSV)',
			titleEn: 'Export SIEM Logs (CSV)',
			category: 'Forensics',
			icon: <Download size={14} />,
			action: () => handleExportSiem('csv'),
		},
		{
			id: 'for_export_json',
			title: 'SIEM Loglarını Dışa Aktar (Adli JSON)',
			titleEn: 'Export SIEM Logs (Forensic JSON)',
			category: 'Forensics',
			icon: <Download size={14} />,
			action: () => handleExportSiem('json'),
		},
	];

	const filteredCommands = commands.filter((cmd) => {
		const matchTr = cmd.title.toLowerCase().includes(query.toLowerCase());
		const matchEn = cmd.titleEn.toLowerCase().includes(query.toLowerCase());
		const matchCat = cmd.category.toLowerCase().includes(query.toLowerCase());
		return matchTr || matchEn || matchCat;
	});

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			setSelectedIndex((prev) => (prev + 1 < filteredCommands.length ? prev + 1 : 0));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredCommands.length - 1));
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const cmd = filteredCommands[selectedIndex];
			if (cmd) {
				cmd.action();
				onClose();
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	};

	if (!isOpen) return null;

	return (
		<div className={styles.backdrop} onClick={onClose}>
			<div
				className={styles.modal}
				style={{ maxWidth: '580px', borderRadius: '12px', overflow: 'hidden' }}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Search Input Bar */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '10px',
						padding: '14px 18px',
						borderBottom: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
						background: 'var(--window-titlebar, var(--fill-softer))',
					}}
				>
					<Search size={16} style={{ color: 'var(--text-secondary)' }} />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setSelectedIndex(0);
						}}
						onKeyDown={handleKeyDown}
						placeholder={isEn ? 'Type a command, search views, or run actions...' : 'Komut yazın, sekmeleri arayın veya aksiyon çalıştırın...'}
						style={{
							flex: 1,
							border: 'none',
							background: 'transparent',
							outline: 'none',
							fontSize: '13px',
							color: 'var(--text-primary)',
						}}
					/>
					<span
						style={{
							fontSize: '10.5px',
							fontWeight: 600,
							padding: '2px 6px',
							borderRadius: '4px',
							background: 'var(--fill-soft)',
							color: 'var(--text-secondary)',
						}}
					>
						ESC
					</span>
				</div>

				{/* Results List */}
				<div style={{ maxHeight: '380px', overflowY: 'auto', padding: '6px' }}>
					{filteredCommands.length === 0 ? (
						<div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
							{isEn ? 'No commands match your query.' : 'Aramanızla eşleşen bir komut bulunamadı.'}
						</div>
					) : (
						filteredCommands.map((cmd, idx) => {
							const isSelected = idx === selectedIndex;
							return (
								<div
									key={cmd.id}
									onClick={() => {
										cmd.action();
										onClose();
									}}
									onMouseEnter={() => setSelectedIndex(idx)}
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										padding: '9px 12px',
										borderRadius: '6px',
										cursor: 'pointer',
										background: isSelected ? 'var(--fill-strong, rgba(0, 0, 0, 0.08))' : 'transparent',
										transition: 'background-color 80ms ease',
									}}
								>
									<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
										<div
											style={{
												color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
												display: 'grid',
												placeItems: 'center',
											}}
										>
											{cmd.icon}
										</div>
										<div>
											<div style={{ fontSize: '12px', fontWeight: isSelected ? 700 : 500 }}>
												{isEn ? cmd.titleEn : cmd.title}
											</div>
											<div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
												{cmd.category}
											</div>
										</div>
									</div>

									{cmd.shortcut && (
										<span
											style={{
												fontSize: '10px',
												fontFamily: 'monospace',
												fontWeight: 700,
												padding: '2px 6px',
												borderRadius: '4px',
												background: 'var(--fill-soft)',
												color: 'var(--text-secondary)',
											}}
										>
											{cmd.shortcut}
										</span>
									)}
								</div>
							);
						})
					)}
				</div>

				{/* Footer Hint */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '8px 14px',
						borderTop: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
						background: 'var(--fill-softer)',
						fontSize: '11px',
						color: 'var(--text-secondary)',
					}}
				>
					<span>{isEn ? 'Navigate with ↑ ↓ and press ↵' : '↑ ↓ ile gezinin, ↵ ile çalıştırın'}</span>
					<span>⌘K / Ctrl+K</span>
				</div>
			</div>
		</div>
	);
};
export default SocCommandPalette;
