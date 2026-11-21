import type { Language } from '@/lib/i18n';

export interface AuditCopy {
	dateLocale: 'en-GB' | 'tr-TR';
	shortDateLocale: 'en-US' | 'tr-TR';
	title: string;
	subtitle: string;
	eventsCount: string;
	refreshTitle: string;
	refresh: string;
	exporting: string;
	clearLog: string;
	csvExported: string;
	searchPlaceholder: string;
	clearSearchTitle: string;
	catAll: string;
	catRoles: string;
	catMembers: string;
	catSecurity: string;
	dateAll: string;
	dateToday: string;
	date7d: string;
	date30d: string;
	colActionEvent: string;
	colDiffSummary: string;
	colInspect: string;
	inspectEventTitle: string;
	details: string;
	justNow: string;
	minsAgoSuffix: string;
	hoursAgoSuffix: string;
	daysAgoSuffix: string;
	diffRolePrefix: string;
	diffPermChangesSuffix: string;
	diffUpdatedSuffix: string;
	diffFieldsModifiedSuffix: string;
	copyActor: string;
	copyTarget: string;
	copyIp: string;
	pivotSiem: string;
	tabDiff: string;
	tabRaw: string;
	copied: string;
	copyJson: string;
	roleAdminFallback: string;
	roleBoardFallback: string;
	roleMemberFallback: string;
	roleAlumniFallback: string;
}

export const AUDIT_I18N: Record<Language, AuditCopy> = {
	en: {
		dateLocale: 'en-GB',
		shortDateLocale: 'en-US',
		title: 'Change History & Security Audit',
		subtitle:
			'Immutable, zero-trust audit trail of role permission mutations, lifecycle events, and administrative actions',
		eventsCount: '{n} Events',
		refreshTitle: 'Refresh log',
		refresh: 'Refresh',
		exporting: 'Exporting…',
		clearLog: 'Clear Log',
		csvExported: 'Audit log exported as CSV.',
		searchPlaceholder: 'Filter by actor, target, action or IP address…',
		clearSearchTitle: 'Clear search',
		catAll: 'All',
		catRoles: 'Roles & Perms',
		catMembers: 'Members',
		catSecurity: 'Security & System',
		dateAll: 'All Time',
		dateToday: 'Today',
		date7d: '7 Days',
		date30d: '30 Days',
		colActionEvent: 'Action / Event',
		colDiffSummary: 'Diff Summary',
		colInspect: 'Inspect',
		inspectEventTitle: 'Inspect event diff',
		details: 'Details',
		justNow: 'Just now',
		minsAgoSuffix: 'm ago',
		hoursAgoSuffix: 'h ago',
		daysAgoSuffix: 'd ago',
		diffRolePrefix: 'Role',
		diffPermChangesSuffix: 'perm changes',
		diffUpdatedSuffix: 'updated',
		diffFieldsModifiedSuffix: 'fields modified',
		copyActor: 'Copy actor',
		copyTarget: 'Copy target',
		copyIp: 'Copy IP',
		pivotSiem: 'Pivot into SIEM logs',
		tabDiff: 'Field Diffs',
		tabRaw: 'Forensics JSON',
		copied: 'Copied!',
		copyJson: 'Copy JSON',
		roleAdminFallback: 'Administrator',
		roleBoardFallback: 'Board Member',
		roleMemberFallback: 'Member',
		roleAlumniFallback: 'Alumni',
	},
	tr: {
		dateLocale: 'tr-TR',
		shortDateLocale: 'tr-TR',
		title: 'Değişiklik Geçmişi & Güvenlik Denetimi',
		subtitle: 'Yönetimsel yetki değişiklikleri, rol atamaları ve üye yaşam döngüsünün adli denetim kayıtları',
		eventsCount: '{n} Olay',
		refreshTitle: 'Kayıtları yenile',
		refresh: 'Yenile',
		exporting: 'İndiriliyor…',
		clearLog: 'Temizle',
		csvExported: 'Denetim günlüğü CSV olarak indirildi.',
		searchPlaceholder: 'Yapan, hedef, işlem veya IP adresi ara…',
		clearSearchTitle: 'Aramayı temizle',
		catAll: 'Tümü',
		catRoles: 'Rol & Yetkiler',
		catMembers: 'Üyeler',
		catSecurity: 'Güvenlik & Sistem',
		dateAll: 'Tümü',
		dateToday: 'Bugün',
		date7d: '7 Gün',
		date30d: '30 Gün',
		colActionEvent: 'İşlem / Olay',
		colDiffSummary: 'Değişiklik Özeti',
		colInspect: 'İncele',
		inspectEventTitle: 'Olay detayını incele',
		details: 'İncele',
		justNow: 'Az önce',
		minsAgoSuffix: 'dk önce',
		hoursAgoSuffix: 'sa önce',
		daysAgoSuffix: 'g önce',
		diffRolePrefix: 'Rol',
		diffPermChangesSuffix: 'yetki değişti',
		diffUpdatedSuffix: 'güncellendi',
		diffFieldsModifiedSuffix: 'alan değişti',
		copyActor: 'Yapanı kopyala',
		copyTarget: 'Hedefi kopyala',
		copyIp: 'IP kopyala',
		pivotSiem: 'SIEM kayıtlarında filtrele',
		tabDiff: 'Değişiklik Detayı',
		tabRaw: 'Adli JSON Kaydı',
		copied: 'Kopyalandı!',
		copyJson: 'JSON Kopyala',
		roleAdminFallback: 'Yönetici',
		roleBoardFallback: 'Yönetim Kurulu Üyesi',
		roleMemberFallback: 'Üye',
		roleAlumniFallback: 'Mezun',
	},
};
