/**
 * The pages of the Settings app.
 *
 * One list, shared by the app (which tab ids are valid deep-link targets) and by
 * search (what a user can type to reach a page) and by the sidebar. `sistem`
 * pages manage the club rather than the member's own account: they exist only
 * for roles that manage Settings — in the sidebar and in search alike.
 */
export const SETTINGS_TAB_IDS = [
	'account',
	'wallpaper',
	'dock',
	'appearance',
	'storage',
	'language',
	'security',
	'community',
	'roles',
	'smtp',
	'integrations',
] as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number];

export interface SettingsSection {
	id: SettingsTabId;
	tr: string;
	en: string;
	/** Extra words that should find this page, in both languages. */
	keywords: string[];
	/** The sidebar label (i18n key). */
	labelKey: string;
	/** Sidebar group; a divider separates groups. */
	group: 'kisisel' | 'hesap' | 'sistem';
	/** Requires Settings at the manage level. */
	sistem?: boolean;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
	{ id: 'account', tr: 'Hesabım', en: 'My Account', keywords: ['profil', 'profile', 'fotoğraf', 'photo', 'şifre değiştir', 'change password', 'bölüm', 'biyografi', 'seviye', 'xp'], labelKey: 'acTab', group: 'kisisel' },
	{ id: 'wallpaper', tr: 'Duvar Kağıdı', en: 'Wallpaper', keywords: ['arka plan', 'background', 'manzara', 'tema resmi', 'uzay', 'space', 'galaksi'], labelKey: 'tabWallpaper', group: 'kisisel' },
	{ id: 'dock', tr: 'Dock ve Pencereler', en: 'Dock & Windows', keywords: ['otomatik gizle', 'auto hide', 'shift tab', 'pencere değiştir', 'switch windows'], labelKey: 'tabDock', group: 'kisisel' },
	{ id: 'appearance', tr: 'Görünüm', en: 'Appearance', keywords: ['tema', 'theme', 'karanlık', 'dark', 'aydınlık', 'light', 'parlaklık', 'brightness', 'ekran', 'display', 'ses', 'sound', 'ses seviyesi', 'volume', 'sessiz', 'mute', 'efekt'], labelKey: 'tabAppearance', group: 'kisisel' },
	{ id: 'storage', tr: 'Depolama ve Sıfırlama', en: 'Storage & Reset', keywords: ['sıfırla', 'reset', 'oturum', 'önbellek'], labelKey: 'tabStorage', group: 'hesap' },
	{ id: 'language', tr: 'Dil', en: 'Language', keywords: ['türkçe', 'english', 'lang'], labelKey: 'tabLanguage', group: 'hesap' },
	{ id: 'security', tr: 'Güvenlik', en: 'Security', keywords: ['iki adımlı', '2fa', 'passkey', 'şifre', 'parola', 'doğrulama'], labelKey: 'tabSecurity', group: 'hesap' },
	{ id: 'community', tr: 'Topluluk Kimliği', en: 'Community Identity', keywords: ['topluluk', 'community', 'stüdyo', 'studio', 'tetha42', 'domain', 'imza', 'başkan', 'danışman'], labelKey: 'tabCommunity', group: 'sistem', sistem: true },
	{ id: 'roles', tr: 'Roller ve Yetkiler', en: 'Roles & Permissions', keywords: ['role', 'role', 'permission', 'permission', 'izin', 'admin', 'erişim'], labelKey: 'tabRoles', group: 'sistem', sistem: true },
	{ id: 'smtp', tr: 'E-posta Hesabı', en: 'Email Account', keywords: ['mail', 'posta', 'smtp', 'gmail', 'uygulama şifresi', 'app password', 'bildirim e-postası'], labelKey: 'tabSmtp', group: 'sistem', sistem: true },
	{ id: 'integrations', tr: 'Entegre Uygulamalar', en: 'Connected Apps', keywords: ['oauth', 'api', 'sso', 'client', 'secret', 'entegrasyon', 'harici uygulama', 'account centre'], labelKey: 'tabIntegrations', group: 'sistem', sistem: true },
];
