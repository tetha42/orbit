export const SOC_SHELL_COPY = {
	tr: {
		restrictedTitle: 'SoC Komuta Merkezi Yetki Korumalı',
		restrictedBody:
			'Canlı tehdit telemetrisini, IP karantina duvarını ve SIEM adli kayıtlarını görüntülemek için SoC Güvenlik Merkezi yetkisine sahip olmalısınız.',
		lockdownTitle: 'DEFCON 1 KALKAN MODU AKTİF:',
		lockdownBody:
			'Yeni üye alımı ve şifre sıfırlama durduruldu; IPS tehdit puanı çarpanı 2x olarak uygulanıyor.',
		liftLockdown: 'Kalkanı Kaldır',
		defconHigh: 'YÜKSEK TEHDİT SEVİYESİ (Alarmlar Mevcut):',
		defconElevated: 'ARTIRILMIŞ GÜVENLİK DİKKATİ:',
		defconBody:
			'Tehdit alarmları ve karantina sayaçları aktif güvenlik olaylarına işaret ediyor. Alarmları onaylayarak barış moduna (DEFCON 5) dönebilirsiniz.',
		ackDefcon: 'Alarmları Onayla & DEFCON 5 Yap',
		navRadar: 'Radar',
		navFirewall: 'Karantina',
		navSessions: 'Oturumlar',
		navInspection: 'Teftiş',
		navAudit: 'Denetim',
	},
	en: {
		restrictedTitle: 'SoC Studio Restricted',
		restrictedBody:
			'You need SoC Security Center permission to view live threat telemetry, firewall rules, and SIEM forensics.',
		lockdownTitle: 'DEFCON 1 LOCKDOWN ACTIVE:',
		lockdownBody:
			'Public registration & password resets are suspended; IPS threat scoring multiplier is 2x.',
		liftLockdown: 'Lift Lockdown',
		defconHigh: 'HIGH THREAT LEVEL (Alerts Present):',
		defconElevated: 'ELEVATED VIGILANCE:',
		defconBody:
			'Threat baseline counters indicate active security strikes or bans. Acknowledge alerts to restore DEFCON 5 peace mode.',
		ackDefcon: 'Acknowledge & Reset DEFCON 5',
		navRadar: 'Radar',
		navFirewall: 'Firewall',
		navSessions: 'Sessions',
		navInspection: 'Inspection',
		navAudit: 'Audit',
	},
} as const;
