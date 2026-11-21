import type { Language } from '@/lib/i18n';

export interface WafSimulatorCopy {
	attackScenariosTitle: string;
	attackScenariosSub: string;
	interceptionRateTitle: string;
	attacksRepelled: (blocked: number, total: number) => string;
	readyToTest: string;
	meanLatencyTitle: string;
	meanLatencySub: string;
	controlTitle: string;
	controlDesc: string;
	firingSuite: string;
	launchSuite: string;
	colScenario: string;
	colCategory: string;
	colEndpoint: string;
	colStatus: string;
	colProtection: string;
	colLatency: string;
	colInspect: string;
	intercepted: string;
	passed: string;
	idle: string;
	hide: string;
	payload: string;
	injectedPayloadLabel: string;
	telemetryResponseLabel: string;
}

export const WAF_SIM_I18N: Record<Language, WafSimulatorCopy> = {
	en: {
		attackScenariosTitle: 'Attack Scenarios',
		attackScenariosSub: 'SQLi, XSS, Traversal, Honeypots',
		interceptionRateTitle: 'WAF Interception Rate',
		attacksRepelled: (blocked, total) => `${blocked} of ${total} attacks repelled`,
		readyToTest: 'Ready to test active defenses',
		meanLatencyTitle: 'Mean Defense Latency',
		meanLatencySub: 'Inline WAF inspection speed',
		controlTitle: 'Red Team Automated Attack Fuzzer',
		controlDesc: 'Fires live offensive security vectors against panel routes to verify real-time WAF and IPS interception',
		firingSuite: 'Firing Attack Suite...',
		launchSuite: 'Launch Attack Suite',
		colScenario: 'Attack Scenario',
		colCategory: 'Category',
		colEndpoint: 'Target Endpoint',
		colStatus: 'HTTP Status',
		colProtection: 'WAF Protection',
		colLatency: 'Latency',
		colInspect: 'Inspect',
		intercepted: 'INTERCEPTED',
		passed: 'PASSED',
		idle: 'Idle',
		hide: 'Hide',
		payload: 'Payload',
		injectedPayloadLabel: 'Injected Malicious Payload:',
		telemetryResponseLabel: 'Server Defense Telemetry Response:',
	},
	tr: {
		attackScenariosTitle: 'Saldırı Senaryoları',
		attackScenariosSub: 'SQLi, XSS, Yol Atlama, Bal Küpleri',
		interceptionRateTitle: 'WAF Engelleme Oranı',
		attacksRepelled: (blocked, total) => `${total} saldırıdan ${blocked} tanesi püskürtüldü`,
		readyToTest: 'Aktif savunma testine hazır',
		meanLatencyTitle: 'Ortalama Savunma Gecikmesi',
		meanLatencySub: 'Hattı içi WAF denetleme hızı',
		controlTitle: 'Red Team Otomatik Saldırı Simülatörü',
		controlDesc: 'Gerçek zamanlı WAF ve IPS korumasını doğrulamak için panel rotalarına canlı saldırı vektörleri gönderir',
		firingSuite: 'Saldırılar Gönderiliyor...',
		launchSuite: 'Saldırı Testini Başlat',
		colScenario: 'Saldırı Senaryosu',
		colCategory: 'Kategori',
		colEndpoint: 'Hedef Uç Nokta',
		colStatus: 'HTTP Kodu',
		colProtection: 'WAF Koruması',
		colLatency: 'Gecikme',
		colInspect: 'İncele',
		intercepted: 'ENGELLENDİ',
		passed: 'GEÇTİ',
		idle: 'Beklemede',
		hide: 'Gizle',
		payload: 'Yük',
		injectedPayloadLabel: 'Enjekte Edilen Zararlı Yük:',
		telemetryResponseLabel: 'Sunucu Savunma Telemetri Yanıtı:',
	},
};
