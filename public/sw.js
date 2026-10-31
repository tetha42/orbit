// Orbit Community OS — PWA Service Worker
const CACHE_NAME = 'orbit-os-v10';

const PRECACHE_ASSETS = [
	'/offline.html',
	'/manifest.json',
	'/manifest.webmanifest',
	'/favicon.ico',
	'/assets/img/logo-girdap.svg',
];

// Install: Cache offline page immediately
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(PRECACHE_ASSETS);
		}).then(() => self.skipWaiting())
	);
});

// Activate: Clean up older cache versions and claim clients
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(
				keys.map((key) => {
					if (key !== CACHE_NAME) {
						return caches.delete(key);
					}
				})
			);
		}).then(() => self.clients.claim())
	);
});

// Identity/icon update: drop cached install metadata and tell open windows to
// reload the new branding. The OS owns the installed icon, but this is the
// signal that makes the browser re-read the versioned manifest on its next check.
self.addEventListener('message', (event) => {
	const data = event.data;
	if (!data || data.type !== 'IDENTITY_UPDATED') return;
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			const requests = await cache.keys();
			await Promise.all(
				requests
					.filter((request) => {
						const url = new URL(request.url);
						return (
							url.pathname === '/manifest.webmanifest' ||
							url.pathname === '/icon.png' ||
							url.pathname === '/favicon.ico' ||
							url.pathname.startsWith('/api/identity/icon/') ||
							url.pathname.startsWith('/api/custom-assets/identity/')
						);
					})
					.map((request) => cache.delete(request))
			);
			const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of clients) {
				client.postMessage({ type: 'IDENTITY_UPDATED', version: data.version || null });
			}
		})()
	);
});

// Fetch: Intercept requests to provide offline fallback
self.addEventListener('fetch', (event) => {
	const request = event.request;

	// Only handle GET requests
	if (request.method !== 'GET') {
		return;
	}

	const url = new URL(request.url);

	// Bypass caching entirely in local development to avoid stale Turbopack chunk collisions
	if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.port === '3000') {
		return;
	}

	// 1. Navigation requests (HTML page visits): Network first -> Custom offline.html fallback
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.then((response) => {
					// If server returned 502/503/504 Bad Gateway / Service Unavailable, show offline page
					if (!response || response.status === 502 || response.status === 503 || response.status === 504) {
						return caches.match('/offline.html');
					}
					return response;
				})
				.catch(async () => {
					// Network failed (no internet or server connection refused)
					const cache = await caches.open(CACHE_NAME);
					const cachedOffline = await cache.match('/offline.html');
					if (cachedOffline) {
						return cachedOffline;
					}
					return new Response(
						'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Orbit Community OS — Offline</title></head><body style="background:#09090b;color:#fafafa;font-family:sans-serif;text-align:center;padding:50px;"><h2>Orbit Community OS</h2><p>Unable to reach the network or server.</p><button onclick="location.reload()">Retry</button></body></html>',
						{
							status: 503,
							headers: { 'Content-Type': 'text/html; charset=utf-8' },
						}
					);
				})
		);
		return;
	}

	// 2. API requests: Return JSON error on network failure instead of breaking the app
	if (url.pathname.startsWith('/api/')) {
		event.respondWith(
			fetch(request).catch(() => {
				return new Response(
					JSON.stringify({
						error: 'offline',
						offline: true,
						message: 'Unable to reach the server or network connection.',
					}),
					{
						status: 503,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			})
		);
		return;
	}

	// The installable manifest is dynamic (community name and icon); prefer the
	// network, then fall back to the static manifest bundled with the app.
	if (url.pathname === '/manifest.webmanifest') {
		event.respondWith(fetch(request).catch(() => caches.match('/manifest.json')));
		return;
	}

	// 3. Static assets, fonts & app icons
	if (
		url.pathname.startsWith('/_next/static/') ||
		url.pathname.startsWith('/fonts/') ||
		url.pathname.startsWith('/app-icons/') ||
		url.pathname.startsWith('/assets/') ||
		url.pathname.endsWith('.woff2') ||
		url.pathname.endsWith('.woff') ||
		url.pathname.endsWith('.ttf') ||
		url.pathname === '/favicon.ico' ||
		url.pathname === '/manifest.json'
	) {
		// Network-first for Next.js build chunks so client never receives stale module factories
		if (url.pathname.startsWith('/_next/static/')) {
			event.respondWith(
				fetch(request)
					.then((networkResponse) => {
						if (networkResponse && networkResponse.status === 200) {
							const responseToCache = networkResponse.clone();
							caches.open(CACHE_NAME).then((cache) => {
								cache.put(request, responseToCache);
							});
						}
						return networkResponse;
					})
					.catch(() => caches.match(request))
			);
			return;
		}

		// Cache-first for immutable static fonts, images, and icons
		event.respondWith(
			caches.match(request).then((cachedResponse) => {
				const fetchPromise = fetch(request)
					.then((networkResponse) => {
						if (networkResponse && networkResponse.status === 200) {
							const responseToCache = networkResponse.clone();
							caches.open(CACHE_NAME).then((cache) => {
								cache.put(request, responseToCache);
							});
						}
						return networkResponse;
					})
					.catch(() => cachedResponse);

				return cachedResponse || fetchPromise;
			})
		);
		return;
	}

	// Default: standard network fetch
	event.respondWith(
		fetch(request).catch(async () => {
			return caches.match(request);
		})
	);
});

// Notification Click: Focus the app and forward the record target so Chat can
// reveal the exact room/message instead of only focusing the window.
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const data = event.notification.data || {};
	event.waitUntil(
		(async () => {
			const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const client = clientList.find((candidate) => candidate.url);
			if (client && 'focus' in client) {
				await client.focus();
				client.postMessage({ type: 'ORBIT_NOTIFICATION_CLICK', data });
				return;
			}
			if (self.clients.openWindow) {
				const url = new URL('/', self.location.origin);
				if (data?.target?.appId === 'chat') {
					if (data.target.itemId) url.searchParams.set('chatRoom', data.target.itemId);
					if (data.target.parentId) url.searchParams.set('chatMessage', data.target.parentId);
				}
				await self.clients.openWindow(url.href);
			}
		})()
	);
});
