import type { Language } from '@/lib/i18n';
import type { SocTab } from '../../types';

export type DefconLevel = 1 | 2 | 3 | 4 | 5;

export interface ToolbarCopy {
	searchPlaceholder: (tab: SocTab) => string;
	clearSearch: string;
	defconTitle: (level: DefconLevel) => string;
	resetDefconTitle: string;
	lockdownActiveTitle: string;
	lockdownIdleTitle: string;
	lockdownOnLabel: string;
	lockdownOffLabel: string;
	timeWindowTitle: string;
	timeRangeLabels: Record<'15m' | '1h' | '6h' | '24h' | '7d' | 'all' | 'custom', string>;
	liveTailTitle: string;
	pollingTitle: string;
	pollingActiveLabel: string;
	pollingPausedLabel: string;
	exportCsvTitle: string;
	runAllTitle: string;
	runAllBusyLabel: string;
	runAllIdleLabel: string;
	clearHourFilterTitle: string;
	refreshTitle: string;
	refreshLabel: string;
	inspectorTitle: string;
}

const DEFCON_LABELS_EN: Record<DefconLevel, string> = {
	1: 'Lockdown / Under Attack',
	2: 'High Threat Level',
	3: 'Elevated Vigilance',
	4: 'Guarded',
	5: 'Peace Mode (Normal)',
};

const DEFCON_LABELS_TR: Record<DefconLevel, string> = {
	1: 'Saldırı Altındayız',
	2: 'Yüksek Tehdit',
	3: 'Artırılmış Dikkat',
	4: 'Tetik',
	5: 'Barış Hali (Standart)',
};

export const TOOLBAR_I18N: Record<Language, ToolbarCopy> = {
	en: {
		searchPlaceholder: (tab) => {
			if (tab === 'siem') return 'Search forensic logs, query terms, IP...';
			if (tab === 'inspection') return 'Filter API endpoints (/api/...)';
			return 'Quick search in studio...';
		},
		clearSearch: 'Clear search',
		defconTitle: (level) => `DEFCON ${level} Posture: ${DEFCON_LABELS_EN[level]}`,
		resetDefconTitle: 'Acknowledge alerts and restore DEFCON 5',
		lockdownActiveTitle: 'DEFCON 1 Lockdown Active: Click to Lift',
		lockdownIdleTitle: 'Emergency Lockdown: Suspend signups & double IPS strike rate',
		lockdownOnLabel: 'Lockdown ON',
		lockdownOffLabel: 'Lockdown',
		timeWindowTitle: 'Filter telemetry time window',
		timeRangeLabels: {
			'15m': 'Last 15m',
			'1h': 'Last 1h',
			'6h': 'Last 6h',
			'24h': 'Last 24h',
			'7d': 'Last 7d',
			all: 'All Time',
			custom: 'Custom...',
		},
		liveTailTitle: 'Toggle real-time SSE live tail log stream',
		pollingTitle: 'Toggle background telemetry polling (6s)',
		pollingActiveLabel: '6s',
		pollingPausedLabel: 'Paused',
		exportCsvTitle: 'Export SIEM logs as CSV',
		runAllTitle: 'Run complete API Security Suite (⌥⌘R)',
		runAllBusyLabel: 'Testing...',
		runAllIdleLabel: 'Run All',
		clearHourFilterTitle: 'Clear hour filter',
		refreshTitle: 'Refresh Telemetry (⌘R)',
		refreshLabel: 'Refresh',
		inspectorTitle: 'Toggle Forensic Inspector Drawer (⌥I)',
	},
	tr: {
		searchPlaceholder: (tab) => {
			if (tab === 'siem') return 'Adli kayıtlar, sorgular, IP ara...';
			if (tab === 'inspection') return 'Uç nokta ara (/api/...)';
			return 'Studio içinde hızlı ara...';
		},
		clearSearch: 'Aramayı temizle',
		defconTitle: (level) => `DEFCON ${level} Kalkanı: ${DEFCON_LABELS_TR[level]}`,
		resetDefconTitle: 'Alarmları onayla ve DEFCON 5 yap',
		lockdownActiveTitle: 'DEFCON 1 Kalkan Aktif: Kaldırmak için tıklayın',
		lockdownIdleTitle: 'Acil Durum Kalkanı: Kayıtları durdur ve IPS puanını 2x yap',
		lockdownOnLabel: 'Kalkan Aktif',
		lockdownOffLabel: 'Kalkan',
		timeWindowTitle: 'Telemetri zaman aralığı',
		timeRangeLabels: {
			'15m': 'Son 15 Dk',
			'1h': 'Son 1 Saat',
			'6h': 'Son 6 Saat',
			'24h': 'Son 24 Saat',
			'7d': 'Son 7 Gün',
			all: 'Tüm Zamanlar',
			custom: 'Özel...',
		},
		liveTailTitle: 'Canlı SSE log akışını aç/kapat',
		pollingTitle: '6 saniyelik arka plan telemetri akışını aç/kapat',
		pollingActiveLabel: '6sn',
		pollingPausedLabel: 'Duraklatıldı',
		exportCsvTitle: 'SIEM kayıtlarını CSV indir',
		runAllTitle: 'Tüm API Güvenlik Testlerini Çalıştır (⌥⌘R)',
		runAllBusyLabel: 'Test Ediliyor...',
		runAllIdleLabel: 'Tümünü Çalıştır',
		clearHourFilterTitle: 'Saat filtresini temizle',
		refreshTitle: 'Telemetriyi Yenile (⌘R)',
		refreshLabel: 'Yenile',
		inspectorTitle: 'Adli İnceleme Çekmecesini Aç/Kapat (⌥I)',
	},
};
