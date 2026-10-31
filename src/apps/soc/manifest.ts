import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'soc',
	title: 'SOC Defense Studio',
	shortTitle: 'SOC Defense',
	description: 'Autonomous threat radar, IP quarantine firewall, SIEM logs and test lab',
	en: {
		title: 'SOC Defense Studio',
		shortTitle: 'SOC Defense',
		description: 'Autonomous threat radar, IP quarantine firewall, SIEM logs and test lab',
	},
	tr: {
		title: 'SOC Siber Güvenlik Masası',
		shortTitle: 'SOC Savunma',
		description: 'Canlı tehdit radarı, IP karantina duvarı, SIEM log analizi ve test laboratuvarı',
	},
	category: 'Operations',
	icon: 'ShieldAlert',
	accentColor: '#ef4444',
	colors: { icon: '#ef4444', menu: '#ef4444', search: '#ef4444' },
	badge: { tr: 'DEFCON', en: 'DEFCON' },
	window: {
		width: 1120,
		height: 680,
		minWidth: 760,
		minHeight: 500,
		x: 140,
		y: 65,
	},
	component: { module: './index', export: 'SocApp' },
	shortcut: '⌘0',
	hotkey: '0',
	order: 15,
	dock: 15,
	permission: {
		sira: 15,
		ad: 'SOC Savunma',
		kullan: 'Canlı tehdit radarını, aktif oturumları, SIEM kayıtlarını ve test laboratuvarı ekranlarını izler.',
		yonet: 'IP karantinası uygular, şüpheli oturumları düşürür, Kalkan Modunu (Lockdown) yönetir ve API test paketini çalıştırır.',
		uyari: 'Kullanıcı oturumlarını sonlandırma ve IP engelleme yetkisi verir; yalnızca güvenlik yöneticilerine açılmalıdır.',
	},
	menu: {
		title: { tr: 'SOC Kalkanı', en: 'SOC Defense' },
		about: { id: 'about-soc', label: { tr: 'SOC Güvenlik Merkezi Hakkında', en: 'About SOC Security Center' }, permission: 'kullan', ac: true },
		categories: [
			{
				id: 'view',
				title: { tr: 'Görünüm', en: 'View' },
				items: [
					{ id: 'soc-tab-radar', label: { tr: 'Canlı Tehdit Radarı', en: 'Live Threat Radar' }, shortcut: '⌥1', permission: 'kullan', komut: 'tab-radar' },
					{ id: 'soc-tab-firewall', label: { tr: 'IP Karantina & Güvenlik Duvarı', en: 'IP Quarantine & Firewall' }, shortcut: '⌥2', permission: 'kullan', komut: 'tab-firewall' },
					{ id: 'soc-tab-sessions', label: { tr: 'Aktif Oturumlar & Kimlik Kalkanı', en: 'Active Sessions & Identity Shield' }, shortcut: '⌥3', permission: 'kullan', komut: 'tab-sessions' },
					{ id: 'soc-tab-siem', label: { tr: 'SIEM & Adli Log Analizi', en: 'SIEM & Log Forensics' }, shortcut: '⌥4', permission: 'kullan', komut: 'tab-siem' },
					{ id: 'soc-tab-inspection', label: { tr: 'Mavi Takım Teftiş', en: 'Blue Team Inspection' }, shortcut: '⌥5', permission: 'kullan', komut: 'tab-inspection' },
					{ id: 'soc-tab-audit', label: { tr: 'Değişiklik Geçmişi', en: 'Change History' }, shortcut: '⌥A', permission: 'yonet', komut: 'tab-audit' },
				],
			},
			{
				id: 'lab',
				title: { tr: 'Test Laboratuvarı', en: 'Test Lab' },
				items: [
					{ id: 'lab-oauth', label: { tr: 'OAuth 2.0 Simülatörü', en: 'OAuth 2.0 Simulator' }, shortcut: '⌥6', permission: 'yonet', komut: 'tab-oauth' },
					{ id: 'lab-api', label: { tr: 'API İzin & Test Paketi', en: 'API Permission Suite' }, shortcut: '⌥7', permission: 'kullan', komut: 'tab-api' },
					{ id: 'lab-health', label: { tr: 'Sistem Sağlık Teşhisleri', en: 'System Diagnostics' }, shortcut: '⌥8', permission: 'yonet', komut: 'tab-health' },
					{ id: 'lab-session', label: { tr: 'Oturum & İzin Röntgeni', en: 'Session Inspector' }, shortcut: '⌥9', permission: 'kullan', komut: 'tab-session' },
				],
			},
			{
				id: 'actions',
				title: { tr: 'Müdahale', en: 'Response' },
				items: [
					{ id: 'soc-refresh', label: { tr: 'Telemetriyi Yenile', en: 'Refresh Telemetry' }, shortcut: '⌘R', permission: 'kullan', komut: 'soc-refresh' },
					{ id: 'lab-run-all', label: { tr: 'Tüm API Testlerini Çalıştır', en: 'Run All API Tests' }, shortcut: '⌥⌘R', permission: 'yonet', komut: 'run-api-suite' },
					{ id: 'lab-refresh-health', label: { tr: 'Sağlık Teşhislerini Yenile', en: 'Refresh Diagnostics' }, shortcut: '⌥⌘H', permission: 'yonet', komut: 'refresh-health' },
				],
			},
		],
	},
} as const satisfies AppManifest;

export default manifest;
