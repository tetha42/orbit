import type { Language } from '@/lib/i18n';
import {
	formatAlertTemplate,
	formatSessionAndCsrfAlert,
	replaceLocalizedAlertTerm,
} from './alertSessionPatterns';

const REGEX_ALERT_PATTERNS: Array<{
	patterns: RegExp[];
	key: string;
	mapVars: (m: RegExpMatchArray) => Record<string, string>;
}> = [
	{
		patterns: [
			/^Yetkisiz uygulama erişim denemesi \(([^)]+)\): (.+)$/i,
			/^Unauthorized app access attempt \(([^)]+)\): (.+)$/i,
		],
		key: 'socAlertUnauthApp',
		mapVars: (m) => ({ app: m[1], detail: m[2] }),
	},
	{
		patterns: [
			/^Yetkisiz (\S+) erişim denemesi engellendi$/i,
			/^Unauthorized (\S+) access attempt blocked$/i,
		],
		key: 'socAlertUnauthEndpoint',
		mapVars: (m) => ({ endpoint: m[1] }),
	},
	{
		patterns: [
			/^Yetkisiz yönetici \(admin\) uç noktası erişim denemesi \(([^)]+)\): (.+)$/i,
			/^Unauthorized admin endpoint access attempt \(([^)]+)\): (.+)$/i,
		],
		key: 'socAlertUnauthAdminEndpoint',
		mapVars: (m) => ({ target: m[1], detail: m[2] }),
	},
	{
		patterns: [
			/^\[WAF\] Genel API saldırı imzası engellendi \(([^)]+)\): (.+)$/i,
			/^\[WAF\] Public API attack signature blocked \(([^)]+)\): (.+)$/i,
		],
		key: 'socAlertWafPublicApi',
		mapVars: (m) => ({ rule: m[1], detail: m[2] }),
	},
	{
		patterns: [
			/^\[WAF\] Saldırı imzası engellendi \(([^)]+)\): (.+)$/i,
			/^\[WAF\] Attack signature blocked \(([^)]+)\): (.+)$/i,
		],
		key: 'socAlertWafBlocked',
		mapVars: (m) => ({ rule: m[1], detail: m[2] }),
	},
	{
		patterns: [
			/^Failed login attempt \(unregistered email\): (.+)$/i,
			/^Başarısız giriş denemesi \(kayıtsız e-posta\): (.+)$/i,
		],
		key: 'socAlertFailLoginEmail',
		mapVars: (m) => ({ email: m[1] }),
	},
	{
		patterns: [
			/^Failed login attempt \(invalid password\): (.+)$/i,
			/^Başarısız giriş denemesi \(hatalı parola\): (.+)$/i,
		],
		key: 'socAlertFailLoginPass',
		mapVars: (m) => ({ email: m[1] }),
	},
	{
		patterns: [
			/^\[Honeypot\] Automated bot registration attempt blocked: (.+)$/i,
			/^\[Honeypot\] Otomatik bot kayıt denemesi engellendi: (.+)$/i,
		],
		key: 'socAlertHoneypotBot',
		mapVars: (m) => ({ detail: m[1] }),
	},
	{
		patterns: [
			/^Yetkisiz sohbet odası mesajlarını okuma denemesi \(IDOR: ([^)]+)\): (.+)$/i,
			/^Unauthorized chat room read attempt \(IDOR: ([^)]+)\): (.+)$/i,
		],
		key: 'socAlertIdorChatRead',
		mapVars: (m) => ({ room: m[1], detail: m[2] }),
	},
	{
		patterns: [
			/^Yetkisiz sohbet odasına mesaj gönderme denemesi \(IDOR: ([^)]+)\): (.+)$/i,
			/^Unauthorized chat room send attempt \(IDOR: ([^)]+)\): (.+)$/i,
		],
		key: 'socAlertIdorChatSend',
		mapVars: (m) => ({ room: m[1], detail: m[2] }),
	},
];

const IPS_BAN_PATTERNS = [
	/^\[IPS AUTO-BAN\] Saldırgan IP otomatik karantinaya alındı: (\S+)(?: \(Tehdit Puanı: (\d+)\))?/i,
	/^\[IPS AUTO-BAN\] Hostile IP auto-quarantined: (\S+)(?: \(Threat Score: (\d+)\))?/i,
];

const PHRASE_REPLACEMENT_KEYS = [
	'socAlertSessionIpMismatch',
	'socAlertUnauthWrite',
	'socAlertUnauthAdminWrite',
	'socAlert2faIpLimit',
	'socAlert2faUserLimit',
	'socAlertPwChangeInvalid',
	'socAlertIpsAutoQuarantinePrefix',
];

/**
 * Normalizes and localizes SoC alert and SIEM security messages
 * ensuring full bilingual (EN/TR) support even for historical logs.
 */
export function formatSocAlertMessage(message: string, language: Language): string {
	if (!message || typeof message !== 'string') return '';
	const trimmed = message.trim();

	for (const pattern of IPS_BAN_PATTERNS) {
		const match = trimmed.match(pattern);
		if (match) {
			const scorePart = match[2]
				? formatAlertTemplate(language, 'socAlertIpsAutoBanScore', { score: match[2] })
				: '';
			return formatAlertTemplate(language, 'socAlertIpsAutoBan', { ip: match[1], scorePart });
		}
	}

	for (const rule of REGEX_ALERT_PATTERNS) {
		for (const pattern of rule.patterns) {
			const match = trimmed.match(pattern);
			if (match) return formatAlertTemplate(language, rule.key, rule.mapVars(match));
		}
	}

	let phraseLocalized = trimmed;
	let matchedPhrase = false;
	for (const key of PHRASE_REPLACEMENT_KEYS) {
		const updated = replaceLocalizedAlertTerm(phraseLocalized, language, key);
		if (updated !== phraseLocalized) {
			phraseLocalized = updated;
			matchedPhrase = true;
		}
	}
	if (matchedPhrase) return phraseLocalized;

	return formatSessionAndCsrfAlert(trimmed, language) ?? trimmed;
}
