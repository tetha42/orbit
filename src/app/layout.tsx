import type { Metadata, Viewport } from 'next';
import { Inter, Josefin_Sans } from 'next/font/google';
import './globals.css';
import { WorkspaceProvider } from '@/state/workspaceStore';
import { DialogProvider } from '@/components/Common/DialogProvider';
import { MacOSSelectMenu } from '@/components/Common/MacOSSelectMenu';
import { PwaBootstrap } from '@/components/Common/PwaBootstrap';
import { ServiceWorkerRegister } from '@/components/Common/ServiceWorkerRegister';
import { ToastProvider } from '@/core/ui/Toast';
import { ThemeScript } from '@/components/Theme/ThemeScript';

const inter = Inter({
	subsets: ['latin', 'latin-ext'],
	display: 'swap',
	variable: '--font-inter',
});

const josefin = Josefin_Sans({
	subsets: ['latin', 'latin-ext'],
	display: 'swap',
	variable: '--font-josefin',
});

export const viewport: Viewport = {
	themeColor: '#0d1117',
	width: 'device-width',
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	viewportFit: 'cover',
};

export const metadata: Metadata = {
	title: 'Orbit — Community OS',
	description: 'Orbit Community OS by tetha42 — Modern Web-Desktop & Collaboration Suite',
	manifest: '/manifest.json',
	icons: {
		icon: [
			{ url: '/favicon.ico', sizes: 'any' },
			{ url: '/icon.png', type: 'image/png', sizes: '32x32' },
		],
		apple: '/assets/img/apple-touch-icon.png',
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: 'black-translucent',
		title: 'Orbit Community OS',
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		// The boot script below writes data-theme and the other appearance attributes on <html> before React
		// hydrates, so the server's markup (which has none) is expected to differ there.
		<html
			lang="en"
			className={`${inter.variable} ${josefin.variable}`}
			suppressHydrationWarning
			data-lenis-prevent
			data-lenis-prevent-wheel
			data-lenis-prevent-touch
		>
			<head>
				{/* Runs before the first paint: the saved theme, accent, transparency and motion, so a dark theme never flashes light. */}
				<ThemeScript />
			</head>
			<body
				className={`${inter.className} ${inter.variable} ${josefin.variable}`}
				data-lenis-prevent
				data-lenis-prevent-wheel
				data-lenis-prevent-touch
			>
				<WorkspaceProvider>
					{/* Inside the workspace provider so dialogs follow its language and theme,
					    and above every page so they also work before login. */}
					<DialogProvider>
						<ToastProvider>
						{/* Attaches the install-prompt listeners as soon as the bundle loads. */}
						<PwaBootstrap />
						<ServiceWorkerRegister />
						<MacOSSelectMenu />
						{children}
						</ToastProvider>
					</DialogProvider>
				</WorkspaceProvider>
			</body>
		</html>
	);
}
