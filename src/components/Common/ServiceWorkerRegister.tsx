'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function ServiceWorkerRegister() {
	const [isOffline, setIsOffline] = useState(false);
	const [showBackOnline, setShowBackOnline] = useState(false);

	useEffect(() => {
		// 1. Service Worker lifecycle:
		// In development, unregister any active service worker and purge caches to prevent
		// Turbopack / HMR stale chunk collisions ("module factory is not available").
		// In production, register the service worker for PWA offline capabilities.
		let removeLoadListener: (() => void) | null = null;
		if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
			if (process.env.NODE_ENV === 'development') {
				navigator.serviceWorker.getRegistrations().then((registrations) => {
					for (const registration of registrations) {
						registration.unregister();
					}
				});
				if ('caches' in window) {
					caches.keys().then((keys) => {
						for (const key of keys) caches.delete(key);
					});
				}
			} else {
				const register = () => {
					navigator.serviceWorker
						.register('/sw.js', { scope: '/', updateViaCache: 'none' })
						.then((reg) => {
							console.log('[PWA] Service Worker aktif:', reg.scope);
						})
						.catch((err) => {
							console.warn('[PWA] Service Worker kayıt uyarısı:', err);
						});
				};

				if (document.readyState === 'complete') {
					register();
				} else {
					window.addEventListener('load', register, { once: true });
					removeLoadListener = () => window.removeEventListener('load', register);
				}
			}
		}

		// 2. Connectivity listeners with deferred / event-driven state dispatch
		let onlineTimer: ReturnType<typeof setTimeout> | null = null;
		let initialTimer: ReturnType<typeof setTimeout> | null = null;

		const handleOnline = () => {
			setIsOffline(false);
			setShowBackOnline(true);
			if (onlineTimer) clearTimeout(onlineTimer);
			onlineTimer = setTimeout(() => setShowBackOnline(false), 3500);
		};

		const handleOffline = () => {
			setIsOffline(true);
			setShowBackOnline(false);
		};

		// Deferred initial check to avoid synchronous setState warning in effect body
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			initialTimer = setTimeout(() => {
				setIsOffline(true);
			}, 0);
		}

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			if (initialTimer) clearTimeout(initialTimer);
			if (onlineTimer) clearTimeout(onlineTimer);
			removeLoadListener?.();
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, []);

	if (!isOffline && !showBackOnline) {
		return null;
	}

	return (
		<div
			style={{
				position: 'fixed',
				top: '36px',
				left: '50%',
				transform: 'translateX(-50%)',
				zIndex: 99999,
				pointerEvents: 'none',
				animation: 'macosMenuFade 200ms ease-out',
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					padding: '6px 14px',
					borderRadius: '20px',
					background: isOffline ? 'rgba(239, 68, 68, 0.92)' : 'rgba(52, 199, 89, 0.92)',
					backdropFilter: 'var(--glass-blur)',
					color: '#fff',
					fontSize: '12px',
					fontWeight: 600,
					boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
					border: '1px solid rgba(255, 255, 255, 0.2)',
				}}
			>
				{isOffline ? (
					<>
						<WifiOff size={14} />
						<span>İnternet bağlantısı kesildi. Çevrimdışı moddasınız.</span>
					</>
				) : (
					<>
						<Wifi size={14} />
						<span>Bağlantı yeniden kuruldu.</span>
					</>
				)}
			</div>
		</div>
	);
}
