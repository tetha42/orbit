export interface AppleNote {
	id: string;
	title: string;
	body: string;
	folderId: string;
	isPinned: boolean;
	isDeleted?: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface NoteFolder {
	id: string;
	name: string;
	isSystem?: boolean;
	iconType?: 'all' | 'quick' | 'club' | 'teknofest' | 'workshops' | 'personal' | 'trash' | 'custom';
}

export interface ServerNoteRecord {
	id: string;
	baslik?: string;
	icerik?: string;
	renk?: string;
	sabitliMi?: number | boolean;
	klasorId?: string;
	copteMi?: number | boolean;
	olusturma?: number | string;
	guncellenme?: number | string;
}

export interface NoteColors {
	appBg: string;
	appText: string;
	textSecondary: string;
	textTertiary: string;
	borderSubtle: string;
	borderDivider: string;
	toolbarBg: string;
	toolbarBorder: string;
	btnHover: string;
	btnActive: string;
	pillContainerBg: string;
	sidebarBg: string;
	folderHover: string;
	folderActiveBg: string;
	folderActiveText: string;
	listBg: string;
	searchBg: string;
	searchBorder: string;
	cardSelectedBg: string;
	cardSelectedBorder: string;
	cardSelectedTitle: string;
	cardHoverBg: string;
	gridCardBg: string;
	gridCardBorder: string;
	editorBg: string;
	editorText: string;
	editorTitleText: string;
	editorPlaceholder: string;
	metaBarText: string;
	popoverBg: string;
	popoverBorder: string;
	popoverShadow: string;
	tableBg: string;
	tableBorder: string;
	codeBg: string;
	accentGold: string;
}

export function getNoteColors(isDark: boolean): NoteColors {
	return {
		appBg: isDark ? '#1c1c1f' : '#ffffff',
		appText: isDark ? '#f5f5f7' : '#1d1d1f',
		textSecondary: isDark ? '#98989f' : '#86868b',
		textTertiary: isDark ? '#636366' : '#a1a1a6',
		borderSubtle: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
		borderDivider: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
		toolbarBg: isDark ? 'rgba(28, 28, 32, 0.96)' : 'rgba(246, 246, 246, 0.96)',
		toolbarBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
		btnHover: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
		btnActive: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
		pillContainerBg: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(120, 120, 130, 0.12)',
		sidebarBg: isDark ? '#18181b' : '#f2f2f7',
		folderHover: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
		folderActiveBg: 'var(--accent-subtle)',
		folderActiveText: 'var(--accent)',
		listBg: isDark ? '#1e1e22' : '#fbfbfd',
		searchBg: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(120, 120, 130, 0.1)',
		searchBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
		cardSelectedBg: 'var(--accent-subtle)',
		cardSelectedBorder: 'var(--accent)',
		cardSelectedTitle: 'var(--text-primary)',
		cardHoverBg: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
		gridCardBg: isDark ? '#242428' : '#ffffff',
		gridCardBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
		editorBg: isDark ? '#1c1c1f' : '#ffffff',
		editorText: isDark ? '#e5e5ea' : '#1d1d1f',
		editorTitleText: isDark ? '#ffffff' : '#1d1d1f',
		editorPlaceholder: isDark ? '#636366' : '#a1a1a6',
		metaBarText: isDark ? '#98989f' : '#86868b',
		popoverBg: isDark ? '#2c2c31' : '#ffffff',
		popoverBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
		popoverShadow: isDark ? '0 12px 32px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.14)',
		tableBg: isDark ? '#232327' : '#f9f9fb',
		tableBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : '#e5e5ea',
		codeBg: isDark ? '#25252a' : '#f4f4f6',
		accentGold: 'var(--accent)',
	};
}
