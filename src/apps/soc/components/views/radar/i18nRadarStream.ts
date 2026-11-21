import type { Language } from '@/lib/i18n';

export interface RadarStreamCopy {
	telemetryTitle: string;
	telemetrySub: string;
	collapse: string;
	expand: string;
	pgPoolLabel: string;
	pgPoolSubTemplate: string;
	heapLabel: string;
	ramLabel: string;
	totalRamPrefix: string;
	cpuLabel: string;
	uptimePrefix: string;
	attackersTitle: string;
	attackersSub: string;
	attackersEmptySearch: string;
	attackersEmptyDefault: string;
	colScore: string;
	colStatus: string;
	colLastAlert: string;
	colAction: string;
	dblClickIp: string;
	riskHigh: string;
	statusBanned: string;
	statusWhitelist: string;
	statusMonitored: string;
	unbanBtn: string;
	banBtn: string;
	youBadge: string;
	manualQuarantineTemplate: string;
	rateLimitsTitle: string;
	rateLimitsSub: string;
	activeSuffix: string;
	colKey: string;
	colHits: string;
	colRetryAfter: string;
	colResetAt: string;
	colOp: string;
	dblClickKey: string;
	resetLimitBtn: string;
	streamTitle: string;
	streamSub: string;
	openFullSiem: string;
	hourFilterNoticeTemplate: string;
	clearFilter: string;
	streamEmptySearch: string;
	streamEmptyDefault: string;
	colTime: string;
	colLevel: string;
	colService: string;
	colMessage: string;
	dblClickTimestamp: string;
	dblClickLevel: string;
	dblClickService: string;
	dblClickMessage: string;
}

export const RADAR_STREAM_I18N: Record<Language, RadarStreamCopy> = {
	en: {
		telemetryTitle: 'Host & PostgreSQL Connection Pool Telemetry',
		telemetrySub: 'Real-time database connection saturation, host memory, and CPU load',
		collapse: 'Collapse',
		expand: 'Expand',
		pgPoolLabel: 'PG Pool Active / Max',
		pgPoolSubTemplate: '{idle} idle, {waiting} queued',
		heapLabel: 'Process Memory (Heap)',
		ramLabel: 'Host System RAM',
		totalRamPrefix: 'Total Host RAM:',
		cpuLabel: 'CPU Load Average',
		uptimePrefix: 'Uptime:',
		attackersTitle: 'Top Attacking IPs & Threat Scores (24h)',
		attackersSub: 'IPs reaching 100 points within 15m are automatically quarantined',
		attackersEmptySearch: 'No hostile IP activity matching your search query.',
		attackersEmptyDefault: 'No hostile IP activity recorded in the last 24 hours.',
		colScore: 'Score',
		colStatus: 'Status',
		colLastAlert: 'Last Alert',
		colAction: 'Action',
		dblClickIp: 'Double-click to select IP',
		riskHigh: 'High',
		statusBanned: 'BANNED',
		statusWhitelist: 'WHITELIST',
		statusMonitored: 'MONITORED',
		unbanBtn: 'Unban',
		banBtn: 'Ban',
		youBadge: 'You',
		manualQuarantineTemplate: 'Manual quarantine via SoC Radar ({count} events)',
		rateLimitsTitle: 'Active Rate Limits & Throttled Keys',
		rateLimitsSub: 'In-memory sliding window limits currently restricting requests',
		activeSuffix: 'ACTIVE',
		colKey: 'Key / Identifier',
		colHits: 'Hits / Failures',
		colRetryAfter: 'Retry After',
		colResetAt: 'Reset At',
		colOp: 'Action',
		dblClickKey: 'Double-click to select key',
		resetLimitBtn: 'Reset Limit',
		streamTitle: 'Live Security Event Stream',
		streamSub: 'Real-time stream of latest WAF, IPS, authentication, terminal, and database security events',
		openFullSiem: 'Open Full SIEM',
		hourFilterNoticeTemplate: 'Filtering live security events for time window: {hour}',
		clearFilter: 'Clear Filter',
		streamEmptySearch: 'No security events match your current filter.',
		streamEmptyDefault: 'No security events recorded yet.',
		colTime: 'Time',
		colLevel: 'Level',
		colService: 'Service',
		colMessage: 'Event Message',
		dblClickTimestamp: 'Double-click to select timestamp',
		dblClickLevel: 'Double-click to select level',
		dblClickService: 'Double-click to select service',
		dblClickMessage: 'Double-click to select message',
	},
	tr: {
		telemetryTitle: 'Sunucu & PostgreSQL Bağlantı Havuzu Telemetrisi',
		telemetrySub: 'Gerçek zamanlı veritabanı havuz doyum seviyesi, sunucu RAM kullanımı ve CPU yükü',
		collapse: 'Daralt',
		expand: 'Genişlet',
		pgPoolLabel: 'PG Havuz Aktif / Limit',
		pgPoolSubTemplate: '{idle} boşta, {waiting} sırada',
		heapLabel: 'Node.js Bellek (Heap)',
		ramLabel: 'Sunucu RAM Kullanımı',
		totalRamPrefix: 'Toplam RAM:',
		cpuLabel: 'CPU Yük Ortalaması',
		uptimePrefix: 'Çalışma Süresi:',
		attackersTitle: 'En Saldırgan IP Adresleri & Tehdit Skorları (24s)',
		attackersSub: '15 dakika içinde 100 tehdit puanına ulaşan IP adresleri otomatik karantinaya alınır',
		attackersEmptySearch: 'Arama kriterine uygun şüpheli veya saldırgan IP bulunamadı.',
		attackersEmptyDefault: 'Son 24 saatte şüpheli veya saldırgan IP aktivitesi tespit edilmedi.',
		colScore: 'Puan',
		colStatus: 'Durum',
		colLastAlert: 'Son İhlal',
		colAction: 'Müdahale',
		dblClickIp: 'IP adresini seçmek için çift tıklayın',
		riskHigh: 'Yüksek',
		statusBanned: 'KARANTİNA',
		statusWhitelist: 'WHITELIST',
		statusMonitored: 'İZLENİYOR',
		unbanBtn: 'Kaldır',
		banBtn: 'Engelle',
		youBadge: 'Siz',
		manualQuarantineTemplate: 'SoC Radar üzerinden manuel karantina ({count} olay)',
		rateLimitsTitle: 'Aktif Hız Sınırı ve Kilitlenmiş İstemciler',
		rateLimitsSub: 'İstekleri geçici olarak durduran gerçek zamanlı bellek-içi hız sınırları',
		activeSuffix: 'AKTİF',
		colKey: 'Hedef / Anahtar',
		colHits: 'Sayaç / Deneme',
		colRetryAfter: 'Kalan Süre',
		colResetAt: 'Sıfırlanma',
		colOp: 'İşlem',
		dblClickKey: 'Anahtarı seçmek için çift tıklayın',
		resetLimitBtn: 'Hız Sınırını Sıfırla',
		streamTitle: 'Canlı Güvenlik Olay Akışı',
		streamSub: 'WAF, IPS, kimlik doğrulama, terminal ve veritabanı güvenlik olaylarının anlık akışı',
		openFullSiem: 'Tüm SIEM Kayıtları',
		hourFilterNoticeTemplate: 'Canlı güvenlik olayları {hour} zaman aralığına göre filtreleniyor',
		clearFilter: 'Filtreyi Temizle',
		streamEmptySearch: 'Arama ve zaman kriterine uygun güvenlik olayı bulunamadı.',
		streamEmptyDefault: 'Henüz kaydedilmiş güvenlik olayı bulunmuyor.',
		colTime: 'Zaman',
		colLevel: 'Seviye',
		colService: 'Servis',
		colMessage: 'Olay Mesajı',
		dblClickTimestamp: 'Zaman damgasını seçmek için çift tıklayın',
		dblClickLevel: 'Seviyeyi seçmek için çift tıklayın',
		dblClickService: 'Servisi seçmek için çift tıklayın',
		dblClickMessage: 'Mesajı seçmek için çift tıklayın',
	},
};
