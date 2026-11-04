import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'certificates',
	title: 'Credentials & Badges',
	shortTitle: 'Credentials',
	description: 'Verifiable digital credentials, achievement badges and skill certificates',
	en: {
		title: 'Credentials & Badges',
		shortTitle: 'Credentials',
		description: 'Verifiable digital credentials, achievement badges and skill certificates',
	},
	tr: {
		title: 'Sertifikalar & Rozetler',
		shortTitle: 'Sertifikalar',
		description: 'Doğrulanabilir dijital sertifikalar, başarı rozetleri ve seviyeler',
	},
	category: 'Community',
	icon: 'Award',
	accentColor: '#ff9500',
	dockIcon: '/app-icons/keynote/256.png',
	badge: { tr: 'Yeni', en: 'New' },
	window: {
		width: 820,
		height: 560,
		minWidth: 640,
		minHeight: 420,
		x: 190,
		y: 80,
	},
	component: { module: './index', export: 'CertificatesApp' },
	shortcut: '⌘5',
	hotkey: '5',
	order: 4,
	dock: 6,
	notifications: { certificate: 'use' },
	permission: {
		order: 4,
		name: 'Sertifikalar',
		use: 'Kendi sertifikalarını ve rozetlerini görür, PDF indirir.',
		manage: 'Sertifika verir/siler, imzacıları düzenler.',
	},
	menu: {
		title: { tr: 'Sertifikalar', en: 'Credentials' },
		about: { id: 'about-certs', label: { tr: 'Sertifika Doğrulama Hakkında', en: 'About Credential Verification' }, permission: 'use', ac: true },
	},
} as const satisfies AppManifest;

export default manifest;
