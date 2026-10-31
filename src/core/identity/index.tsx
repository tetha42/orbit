'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
	defaultIconForSize,
	identityIconUrl,
	identityIconVersion,
	identityManifestUrl,
} from '@/lib/identityIcon';

export interface PublicIdentity {
	appName: 'Orbit';
	studio: 'tetha42';
	siteName: string;
	siteShortName: string;
	descriptionTr: string;
	descriptionEn: string;
	domain: string;
	iconUrl: string | null;
	brandVersion: string;
}

export const DEFAULT_IDENTITY: PublicIdentity = {
	appName: 'Orbit',
	studio: 'tetha42',
	siteName: 'Orbit Community',
	siteShortName: 'Orbit',
	descriptionTr:
		'Tetha42 tarafından geliştirilen kendi sunucunuzda barındırılan topluluk işletim sistemi.',
	descriptionEn: 'Self-hosted community operating system engineered by tetha42.',
	domain: 'orbit.local',
	iconUrl: null,
	brandVersion: 'default',
};

interface IdentityContextValue {
	identity: PublicIdentity;
	/** Re-reads the public branding after Settings saves a change. */
	refreshIdentity: () => Promise<void>;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);
const IDENTITY_CHANNEL = 'orbit-identity';
const IDENTITY_STORAGE_KEY = 'orbit-identity-version';

function ensureLink(selector: string, rel: string, href: string, type?: string): void {
	let link = document.querySelector<HTMLLinkElement>(selector);
	if (!link) {
		link = document.createElement('link');
		link.rel = rel;
		document.head.appendChild(link);
	}
	link.href = href;
	if (type) link.type = type;
}

/**
 * The browser icon, Apple touch icon and manifest link all follow the uploaded
 * community icon. The manifest URL is versioned too, so a browser that caches
 * install metadata notices that something changed.
 */
function applyDocumentBranding(identity: PublicIdentity): void {
	if (typeof document === 'undefined') return;
	document.title = `${identity.siteName} — ${identity.appName} by ${identity.studio}`;

	const version = identity.brandVersion || identityIconVersion(identity.iconUrl);
	const hasCustomIcon = Boolean(identity.iconUrl);
	const favicon = hasCustomIcon
		? identityIconUrl(32, version)
		: defaultIconForSize(32);
	const appleTouchIcon = hasCustomIcon
		? identityIconUrl(180, version)
		: '/assets/img/apple-touch-icon.png';

	const links = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');
	if (links.length === 0) {
		ensureLink('link[rel="icon"]', 'icon', favicon, 'image/png');
	} else {
		links.forEach((link) => {
			link.href = favicon;
			link.type = 'image/png';
		});
	}

	ensureLink(
		'link[rel="apple-touch-icon"]',
		'apple-touch-icon',
		appleTouchIcon,
		'image/png'
	);
	document
		.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon-precomposed"]')
		.forEach((link) => {
			link.href = appleTouchIcon;
			link.type = 'image/png';
		});

	ensureLink(
		'link[rel="manifest"]',
		'manifest',
		identityManifestUrl(version)
	);
}

/**
 * Tells every open tab, the service worker and the browser's PWA installer
 * machinery that the icon/metadata changed. Installed app icons are ultimately
 * owned by the OS, but a versioned manifest + updated SW is what makes it pick
 * the new icon on its next update check.
 */
async function announceIdentityUpdate(version: string): Promise<void> {
	if (typeof window === 'undefined') return;
	try {
		const channel = new BroadcastChannel(IDENTITY_CHANNEL);
		channel.postMessage({ type: 'IDENTITY_UPDATED', version });
		channel.close();
	} catch {
		// BroadcastChannel is optional; storage + service-worker messages still work.
	}
	try {
		localStorage.setItem(IDENTITY_STORAGE_KEY, version);
	} catch {
		// Private mode can reject storage; the current tab is already updated.
	}
	if (!('serviceWorker' in navigator)) return;
	try {
		const registration = await navigator.serviceWorker.getRegistration();
		registration?.active?.postMessage({ type: 'IDENTITY_UPDATED', version });
		registration?.waiting?.postMessage({ type: 'IDENTITY_UPDATED', version });
		await registration?.update();
	} catch {
		// A missing or not-yet-activated worker must not break the settings save.
	}
}

/**
 * Public site identity (community name, descriptions, icon) shared by the
 * sign-in screen, the desktop shell and standalone pages. The product name and
 * studio are constants in the API — this provider only renders them.
 */
export function IdentityProvider({ children }: { children: React.ReactNode }) {
	const [identity, setIdentity] = useState<PublicIdentity>(DEFAULT_IDENTITY);
	const loadedFromServerRef = useRef(false);
	const seenServerIdentityRef = useRef(false);
	const previousIconVersionRef = useRef<string | null>(null);

	const refreshIdentity = useCallback(async () => {
		try {
			const res = await fetch('/api/identity', { cache: 'no-store' });
			if (!res.ok) return;
			const data = (await res.json()) as { identity?: PublicIdentity };
			if (data.identity) {
				loadedFromServerRef.current = true;
				setIdentity(data.identity);
			}
		} catch {
			// Keep the defaults; branding is decorative and must never block boot.
		}
	}, []);

	useEffect(() => {
		void refreshIdentity();
	}, [refreshIdentity]);

	useEffect(() => {
		const version = identity.brandVersion || identityIconVersion(identity.iconUrl);
		const shouldAnnounce =
			seenServerIdentityRef.current &&
			previousIconVersionRef.current !== null &&
			previousIconVersionRef.current !== version;
		applyDocumentBranding(identity);
		if (loadedFromServerRef.current) seenServerIdentityRef.current = true;
		previousIconVersionRef.current = version;
		if (shouldAnnounce) void announceIdentityUpdate(version);
	}, [identity]);

	useEffect(() => {
		const refresh = () => void refreshIdentity();
		let channel: BroadcastChannel | null = null;
		try {
			channel = new BroadcastChannel(IDENTITY_CHANNEL);
			channel.addEventListener('message', refresh);
		} catch {
			channel = null;
		}
		const onStorage = (event: StorageEvent) => {
			if (event.key === IDENTITY_STORAGE_KEY) refresh();
		};
		window.addEventListener('storage', onStorage);
		navigator.serviceWorker?.addEventListener('message', refresh);
		return () => {
			channel?.removeEventListener('message', refresh);
			channel?.close();
			window.removeEventListener('storage', onStorage);
			navigator.serviceWorker?.removeEventListener('message', refresh);
		};
	}, [refreshIdentity]);

	const value = useMemo<IdentityContextValue>(
		() => ({ identity, refreshIdentity }),
		[identity, refreshIdentity]
	);

	return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity(): IdentityContextValue {
	const ctx = useContext(IdentityContext);
	if (!ctx) throw new Error('useIdentity must be used within IdentityProvider');
	return ctx;
}
