import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { teardownContractTestResources } from './helper.mjs';

let cssHookInstalled = false;
function ensureCssModuleStubHook() {
	if (cssHookInstalled) return;
	cssHookInstalled = true;
	registerHooks({
		load(url, context, nextLoad) {
			if (url.startsWith('file://') && url.endsWith('.css')) {
				return {
					format: 'module',
					source: 'export default new Proxy({}, { get: (_target, prop) => String(prop) });',
					shortCircuit: true,
				};
			}
			return nextLoad(url, context);
		},
	});
}

after(teardownContractTestResources);

function createStorageMock() {
	const store = new Map();
	return {
		get length() {
			return store.size;
		},
		key: (i) => Array.from(store.keys())[i] ?? null,
		getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
		setItem: (k, v) => {
			store.set(String(k), String(v));
		},
		removeItem: (k) => {
			store.delete(String(k));
		},
		clear: () => {
			store.clear();
		},
	};
}

function createEventTargetMixin() {
	const map = new Map();
	return {
		addEventListener(type, fn) {
			if (!map.has(type)) map.set(type, new Set());
			map.get(type).add(fn);
		},
		removeEventListener(type, fn) {
			map.get(type)?.delete(fn);
		},
		dispatchEvent(ev) {
			const type = typeof ev === 'string' ? ev : ev?.type;
			const eventObj = typeof ev === 'string' ? { type } : ev;
			for (const fn of Array.from(map.get(type) || [])) {
				fn(eventObj);
			}
			return true;
		},
	};
}

function installDomHarness() {
	const savedStorageDescs = {
		localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
		sessionStorage: Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage'),
	};
	const saved = {
		IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
		window: globalThis.window,
		document: globalThis.document,
		Node: globalThis.Node,
		Element: globalThis.Element,
		HTMLElement: globalThis.HTMLElement,
		HTMLIFrameElement: globalThis.HTMLIFrameElement,
		CustomEvent: globalThis.CustomEvent,
		EventSource: globalThis.EventSource,
		MutationObserver: globalThis.MutationObserver,
		getComputedStyle: globalThis.getComputedStyle,
		fetch: globalThis.fetch,
	};

	const activeObservers = new Set();
	const notifyObservers = (targetNode) => {
		for (const obs of Array.from(activeObservers)) {
			if (!obs.root) continue;
			let cur = targetNode;
			let inside = false;
			while (cur) {
				if (cur === obs.root) {
					inside = true;
					break;
				}
				cur = cur.parentNode;
			}
			if (inside) obs.callback([], obs);
		}
	};

	class FakeMutationObserver {
		constructor(callback) {
			this.callback = callback;
			this.root = null;
		}
		observe(root) {
			this.root = root;
			activeObservers.add(this);
		}
		disconnect() {
			activeObservers.delete(this);
			this.root = null;
		}
	}

	function matchesSelector(el, sel) {
		if (!el || el.nodeType !== 1) return false;
		let remaining = sel.trim();
		const classMatch = remaining.match(/^\.([A-Za-z0-9_-]+)/);
		if (classMatch) {
			if (!el.classList?.contains(classMatch[1])) return false;
			remaining = remaining.slice(classMatch[0].length);
		}
		const attrMatches = [...remaining.matchAll(/\[([^=\]]+)="([^"]*)"\]/g)];
		if (attrMatches.length === 0 && !classMatch) return false;
		for (const m of attrMatches) {
			const expected = m[2].replace(/\\(["\\])/g, '$1');
			if (el.getAttribute?.(m[1]) !== expected) return false;
		}
		return true;
	}

	class FakeNode {
		constructor(nodeType, nodeName) {
			this.nodeType = nodeType;
			this.nodeName = nodeName;
			this.childNodes = [];
			this.parentNode = null;
			this.attributes = new Map();
		}
		get parentElement() {
			return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
		}
		appendChild(child) {
			child.parentNode = this;
			this.childNodes.push(child);
			notifyObservers(this);
			return child;
		}
		removeChild(child) {
			this.childNodes = this.childNodes.filter((c) => c !== child);
			child.parentNode = null;
			notifyObservers(this);
			return child;
		}
		insertBefore(child, ref) {
			const idx = ref ? this.childNodes.indexOf(ref) : -1;
			child.parentNode = this;
			if (idx >= 0) this.childNodes.splice(idx, 0, child);
			else this.childNodes.push(child);
			notifyObservers(this);
			return child;
		}
		addEventListener() {}
		removeEventListener() {}
		setAttribute(k, v) {
			this.attributes.set(String(k), String(v));
			notifyObservers(this);
		}
		removeAttribute(k) {
			this.attributes.delete(String(k));
			notifyObservers(this);
		}
		getAttribute(k) {
			return this.attributes.has(String(k)) ? this.attributes.get(String(k)) : null;
		}
		querySelector(sel) {
			for (const c of this.childNodes) {
				if (matchesSelector(c, sel)) return c;
				if (typeof c.querySelector === 'function') {
					const found = c.querySelector(sel);
					if (found) return found;
				}
			}
			return null;
		}
		get ownerDocument() {
			return globalThis.document;
		}
	}
	class FakeElement extends FakeNode {
		constructor(tag) {
			super(1, tag.toUpperCase());
			this.tagName = tag.toUpperCase();
			this.style = {};
			this.textContent = '';
			this._classes = new Set();
			this._overflowY = 'visible';
			this.scrollTop = 0;
			this.scrollHeight = 100;
			this.clientHeight = 100;
			this.offsetWidth = 10;
			this._rect = { top: 0, bottom: 20, height: 20 };
			this.classList = {
				add: (...names) => names.forEach((n) => this._classes.add(n)),
				remove: (...names) => names.forEach((n) => this._classes.delete(n)),
				contains: (n) => this._classes.has(n),
			};
		}
		setAttribute(k, v) {
			if (String(k) === 'class') {
				this._classes = new Set(String(v).split(/\s+/).filter(Boolean));
			}
			super.setAttribute(k, v);
		}
		getBoundingClientRect() {
			return this._rect;
		}
	}
	class FakeText extends FakeNode {
		constructor(t) {
			super(3, '#text');
			this.nodeValue = t;
			this.textContent = t;
		}
	}
	class FakeCustomEvent {
		constructor(type, init) {
			this.type = type;
			this.detail = init?.detail;
		}
	}

	const eventSources = [];
	class FakeEventSource {
		constructor(url) {
			this.url = url;
			this.closed = false;
			this.listeners = new Map();
			eventSources.push(this);
		}
		addEventListener(type, fn) {
			if (!this.listeners.has(type)) this.listeners.set(type, new Set());
			this.listeners.get(type).add(fn);
		}
		removeEventListener(type, fn) {
			this.listeners.get(type)?.delete(fn);
		}
		close() {
			this.closed = true;
		}
		emit(type, payload = {}) {
			if (this.closed) return;
			for (const fn of Array.from(this.listeners.get(type) || [])) {
				fn({ type, data: JSON.stringify(payload) });
			}
		}
	}

	const localStore = createStorageMock();
	const sessionStore = createStorageMock();
	const rootEl = new FakeElement('div');
	const winEvents = createEventTargetMixin();
	const docEvents = createEventTargetMixin();

	const win = {
		...winEvents,
		location: { pathname: '/', search: '' },
		localStorage: localStore,
		sessionStorage: sessionStore,
		HTMLIFrameElement: class {},
		CustomEvent: FakeCustomEvent,
		EventSource: FakeEventSource,
	};
	const doc = {
		...docEvents,
		nodeType: 9,
		defaultView: win,
		activeElement: null,
		hidden: false,
		documentElement: rootEl,
		querySelector: (sel) => rootEl.querySelector(sel),
		createElement: (t) => new FakeElement(t),
		createElementNS: (_ns, t) => new FakeElement(t),
		createTextNode: (t) => new FakeText(t),
		createComment: (_t) => new FakeNode(8, '#comment'),
	};

	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.Node = FakeNode;
	globalThis.Element = FakeElement;
	globalThis.HTMLElement = FakeElement;
	globalThis.HTMLIFrameElement = win.HTMLIFrameElement;
	globalThis.CustomEvent = FakeCustomEvent;
	Object.defineProperty(globalThis, 'localStorage', { value: localStore, configurable: true, writable: true });
	Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStore, configurable: true, writable: true });
	globalThis.EventSource = FakeEventSource;
	globalThis.MutationObserver = FakeMutationObserver;
	globalThis.getComputedStyle = (el) => ({ overflowY: el?._overflowY || 'visible' });
	globalThis.window = win;
	globalThis.document = doc;

	return {
		rootEl,
		doc,
		win,
		eventSources,
		restore() {
			activeObservers.clear();
			for (const [k, v] of Object.entries(saved)) {
				if (v === undefined) delete globalThis[k];
				else globalThis[k] = v;
			}
			for (const [k, desc] of Object.entries(savedStorageDescs)) {
				if (desc) Object.defineProperty(globalThis, k, desc);
				else delete globalThis[k];
			}
		},
	};
}

test('session-probe: probeSession coalesces concurrent fetches and classifies auth, conflict, ipMismatch, lockdown, and network failures', async (t) => {
	const dom = installDomHarness();
	t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
	let stopPolling = null;
	try {
		const { probeSession, startSessionPolling } = await import('../../src/core/session/probe.ts');

		let fetchCount = 0;
		let mode = 'user';
		globalThis.fetch = async (url) => {
			assert.strictEqual(url, '/api/auth/me');
			fetchCount += 1;
			await Promise.resolve();
			if (mode === 'network_error') throw new Error('offline');
			if (mode === 'user') {
				return new Response(
					JSON.stringify({ authenticated: true, user: { id: 'u1', name: 'Ada', role: 'admin', permissions: { soc: 'manage' } } }),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
			if (mode === 'conflict') {
				return new Response(JSON.stringify({ conflict: true }), { status: 401 });
			}
			if (mode === 'ip_mismatch') {
				return new Response(JSON.stringify({ code: 'SESSION_IP_MISMATCH' }), { status: 401 });
			}
			if (mode === 'lockdown') {
				return new Response(JSON.stringify({ code: 'LOCKDOWN_ACTIVE', error: 'Shield ON' }), { status: 503 });
			}
			return new Response(JSON.stringify({ authenticated: false }), { status: 200 });
		};

		// 1. Singleflight coalescing across 5 concurrent callers
		const batch = await Promise.all(Array.from({ length: 5 }, () => probeSession()));
		assert.strictEqual(fetchCount, 1, 'Concurrent probeSession calls must coalesce into 1 fetch');
		assert.ok(batch.every((r) => r.kind === 'user' && r.user.id === 'u1'));

		// 2. Subsequent call after resolution issues fresh fetch + handles conflict/ipMismatch/lockdown/failed
		mode = 'conflict';
		assert.deepStrictEqual(await probeSession(), { kind: 'ended', conflict: true, ipMismatch: false });
		assert.strictEqual(fetchCount, 2);

		mode = 'ip_mismatch';
		assert.deepStrictEqual(await probeSession(), { kind: 'ended', conflict: false, ipMismatch: true });

		mode = 'lockdown';
		assert.deepStrictEqual(await probeSession(), { kind: 'lockdown', message: 'Shield ON' });

		mode = 'network_error';
		assert.deepStrictEqual(await probeSession(), { kind: 'failed' });

		// 3. Recovery after failed probe works cleanly (inFlightProbe cleared)
		mode = 'user';
		const recovered = await probeSession();
		assert.strictEqual(recovered.kind, 'user');

		// 4. startSessionPolling reacts to SSE lifecycle & visibilitychange without polling on notification
		let polls = 0;
		const states = [];
		const stop = startSessionPolling(
			() => {
				polls += 1;
			},
			(s) => states.push(s)
		);
		stopPolling = stop;
		assert.strictEqual(dom.eventSources.length, 1);
		const es = dom.eventSources[0];
		es.emit('open');
		assert.strictEqual(states.at(-1), 'live');
		assert.strictEqual(polls, 0, 'Initial SSE open must not double-probe');

		es.emit('notification');
		assert.strictEqual(polls, 0, 'Notification SSE frame must not trigger session probe');

		es.emit('permission-changed');
		assert.strictEqual(polls, 1, 'permission-changed must trigger immediate session probe');

		es.emit('soc_updated');
		assert.strictEqual(polls, 2, 'soc_updated must trigger immediate session probe');

		// Drop & reconnect triggers catch-up probe
		es.emit('error');
		assert.strictEqual(states.at(-1), 'reconnecting');
		// Visibility wake triggers probe
		dom.doc.hidden = false;
		dom.doc.dispatchEvent('visibilitychange');
		assert.strictEqual(polls, 3);

		stop();
		stopPolling = null;
		assert.strictEqual(es.closed, true);
		es.emit('permission-changed');
		assert.strictEqual(polls, 3, 'Stopped poller must not respond to events');
	} finally {
		stopPolling?.();
		t.mock.timers.reset();
		dom.restore();
	}
});

test('singleflight: fetchJsonDeduplicated ref-counts AbortSignals and invalidateResource clears cache', async () => {
	const dom = installDomHarness();
	try {
		const {
			fetchJsonDeduplicated,
			invalidateResource,
			invalidationListeners,
			RESOURCE_CACHE,
		} = await import('../../src/core/data/jsonResource/cacheStore.ts');

		let fetchCalls = 0;
		let underlyingAborted = false;
		let resolveFetch;
		globalThis.fetch = (_url, init) => {
			fetchCalls += 1;
			init?.signal?.addEventListener('abort', () => {
				underlyingAborted = true;
			});
			return new Promise((resolve, reject) => {
				resolveFetch = () => resolve(new Response(JSON.stringify({ ok: true, n: fetchCalls }), { status: 200 }));
				init?.signal?.addEventListener('abort', () => {
					const err = new Error('Aborted');
					err.name = 'AbortError';
					reject(err);
				});
			});
		};

		const ac1 = new AbortController();
		const ac2 = new AbortController();
		const p1 = fetchJsonDeduplicated('/api/test-singleflight', ac1.signal);
		const p2 = fetchJsonDeduplicated('/api/test-singleflight', ac2.signal);
		assert.strictEqual(fetchCalls, 1);

		// Aborting 1 of 2 callers must NOT cancel the shared underlying fetch
		ac1.abort();
		assert.strictEqual(underlyingAborted, false);
		resolveFetch();
		const r2 = await p2;
		assert.deepStrictEqual(r2, { status: 200, payload: { ok: true, n: 1 } });
		await p1.catch(() => {});

		// Aborting ALL callers cancels underlying fetch
		underlyingAborted = false;
		const ac3 = new AbortController();
		const p3 = fetchJsonDeduplicated('/api/test-singleflight', ac3.signal);
		ac3.abort();
		assert.strictEqual(underlyingAborted, true);
		await assert.rejects(() => p3, (e) => e?.name === 'AbortError');

		// invalidateResource removes matching cached keys & notifies listeners
		RESOURCE_CACHE.set('/api/soc?action=all', { data: { stale: true }, timestamp: Date.now(), status: 200, failure: null });
		let notifiedPattern = null;
		const listener = (pat) => {
			notifiedPattern = pat;
		};
		invalidationListeners.add(listener);
		try {
			invalidateResource('/api/soc');
			assert.strictEqual(RESOURCE_CACHE.has('/api/soc?action=all'), false);
			assert.strictEqual(notifiedPattern, '/api/soc');
		} finally {
			invalidationListeners.delete(listener);
			RESOURCE_CACHE.clear();
		}
	} finally {
		dom.restore();
	}
});

test('focus-target & windows hooks: useWindowFocusTarget delivers per-app targets with zero spurious cross-app re-renders', async (t) => {
	const dom = installDomHarness();
	t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
	let root = null;
	try {
		globalThis.fetch = async (url) => {
			if (url === '/api/auth/me') {
				return new Response(
					JSON.stringify({
						authenticated: true,
						user: {
							id: 'u_admin',
							name: 'Admin',
							surname: 'User',
							email: 'admin@orbit.local',
							role: 'admin',
							admin: true,
							permissions: { soc: 'manage', chat: 'use', teams: 'use' },
						},
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
			return new Response('{}', { status: 200 });
		};

		const { I18nProvider } = await import('../../src/core/i18n/index.ts');
		const { SoundProvider } = await import('../../src/core/sound/index.ts');
		const { SessionProvider } = await import('../../src/core/session/index.ts');
		const {
			WindowsProvider,
			useWindow,
			useWindowActions,
			useWindowFocusTarget,
		} = await import('../../src/core/windows/index.ts');

		const stats = {
			socRenders: 0,
			chatRenders: 0,
			teamsRenders: 0,
			socTarget: null,
			chatTarget: null,
			socClear: null,
			actions: null,
		};

		function SocSpy() {
			stats.socRenders += 1;
			const { focusTarget, clearFocusTarget } = useWindowFocusTarget('soc');
			stats.socTarget = focusTarget;
			stats.socClear = clearFocusTarget;
			stats.actions = useWindowActions();
			return null;
		}
		function ChatSpy() {
			stats.chatRenders += 1;
			const { focusTarget } = useWindowFocusTarget('chat');
			stats.chatTarget = focusTarget;
			return null;
		}
		function TeamsSpy() {
			stats.teamsRenders += 1;
			useWindow('teams');
			return null;
		}

		root = createRoot(dom.rootEl);
		await React.act(async () => {
			root.render(
				React.createElement(
					I18nProvider,
					null,
					React.createElement(
						SoundProvider,
						null,
						React.createElement(
							SessionProvider,
							null,
							React.createElement(
								WindowsProvider,
								null,
								React.createElement(SocSpy),
								React.createElement(ChatSpy),
								React.createElement(TeamsSpy)
							)
						)
					)
				)
			);
		});
		await React.act(async () => {
			await Promise.resolve();
			t.mock.timers.tick(20);
			await Promise.resolve();
		});

		const baseSoc = stats.socRenders;
		const baseChat = stats.chatRenders;
		const baseTeams = stats.teamsRenders;

		// Focus target directed at 'soc' must update SocSpy without re-rendering ChatSpy or TeamsSpy
		await React.act(async () => {
			stats.actions.openApp('soc', { section: 'siem', kind: 'ip', itemId: '198.51.100.77' });
		});
		assert.strictEqual(stats.socTarget?.appId, 'soc');
		assert.strictEqual(stats.socTarget?.section, 'siem');
		assert.strictEqual(stats.socTarget?.itemId, '198.51.100.77');
		assert.strictEqual(stats.chatTarget, null);
		assert.strictEqual(stats.socRenders, baseSoc + 1);
		assert.strictEqual(stats.chatRenders, baseChat, 'Chat focus hook must not re-render for soc focus target');
		assert.strictEqual(stats.teamsRenders, baseTeams, 'Unrelated Teams window hook must not re-render when soc opens');

		// Clearing with wrong nonce is ignored; matching nonce clears target
		const nonce = stats.socTarget.nonce;
		await React.act(async () => {
			stats.socClear(nonce + 999);
		});
		assert.strictEqual(stats.socTarget?.nonce, nonce);

		await React.act(async () => {
			stats.socClear(nonce);
		});
		assert.strictEqual(stats.socTarget, null);
		assert.strictEqual(stats.chatRenders, baseChat);

		await React.act(async () => {
			root.unmount();
			root = null;
		});
	} finally {
		if (root) {
			await React.act(async () => {
				root.unmount();
			});
		}
		t.mock.timers.reset();
		dom.restore();
	}
});

test('soc-hooks: useSocOverviewSlice + useSocRefreshEffects + useSocFocusTargetSlice do not loop and respect hidden tabs', async (t) => {
	const dom = installDomHarness();
	t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
	let root = null;
	try {
		let socFetchCount = 0;
		globalThis.fetch = async (url) => {
			const u = String(url);
			if (u === '/api/auth/me') {
				return new Response(
					JSON.stringify({
						authenticated: true,
						user: {
							id: 'u_soc',
							name: 'Soc',
							surname: 'Analyst',
							email: 'soc@orbit.local',
							role: 'admin',
							admin: true,
							permissions: { soc: 'manage' },
						},
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
			if (u.startsWith('/api/soc?')) {
				socFetchCount += 1;
				return new Response(
					JSON.stringify({
						overview: { defconLevel: 4, totalRequests: 100 },
						bans: [],
						sessions: [],
						incidents: [],
						siem: [],
						siemMeta: { totalCount: 0, page: 1, limit: 50, totalPages: 1, histogram: [] },
						currentUserId: 'u_soc',
						callerIp: '127.0.0.1',
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
			return new Response('{}', { status: 200 });
		};

		const { I18nProvider } = await import('../../src/core/i18n/index.ts');
		const { SoundProvider } = await import('../../src/core/sound/index.ts');
		const { SessionProvider } = await import('../../src/core/session/index.ts');
		const { WindowsProvider, useWindowActions } = await import('../../src/core/windows/index.ts');
		const { useSocOverviewSlice } = await import('../../src/apps/soc/context/slices/useSocOverviewSlice.ts');
		const { useSocRefreshEffects } = await import('../../src/apps/soc/context/slices/useSocRefreshEffects.ts');
		const { useSocFocusTargetSlice } = await import('../../src/apps/soc/context/slices/useSocFocusTargetSlice.ts');

		let renderCount = 0;
		let appliedTab = '';
		let appliedIp = '';
		let actionsRef = null;
		const noop = () => {};
		const stableDialog = { confirm: async () => true, alert: async () => {}, prompt: async () => null };
		const stableQueryParams = () => new URLSearchParams({ page: '1' });
		const modalRef = { current: false };
		const noopInspection = async () => {};

		function SocHarness() {
			renderCount += 1;
			actionsRef = useWindowActions();
			const slice = useSocOverviewSlice({
				canView: true,
				canManage: true,
				showNotice: noop,
				dialog: stableDialog,
				buildSiemQueryParams: stableQueryParams,
				setIsLoading: noop,
				setIsSubmitting: noop,
				setBanner: noop,
				setIngressDiagnostics: noop,
				setBans: noop,
				setSessions: noop,
				setIncidents: noop,
				setSiemLogs: noop,
				setSiemTotalCount: noop,
				setSiemPage: noop,
				setSiemTotalPages: noop,
				setSiemHistogram: noop,
				setCurrentUserId: noop,
				setCallerIp: noop,
				setWebhookConfig: noop,
				showWebhookModalRef: modalRef,
			});

			useSocRefreshEffects({
				canView: true,
				autoRefresh: false,
				activeTab: 'radar',
				fimTarget: 'repo',
				fetchAll: slice.fetchAll,
				fetchInspectionData: noopInspection,
			});

			useSocFocusTargetSlice({
				setActiveTabState: (tab) => {
					appliedTab = tab;
				},
				setSiemSearch: noop,
				setSiemSearchField: noop,
				setSiemSearchOp: noop,
				setSiemIp: (ip) => {
					appliedIp = ip;
				},
				setSiemIpOp: noop,
				setFwIp: noop,
			});
			return null;
		}

		root = createRoot(dom.rootEl);
		await React.act(async () => {
			root.render(
				React.createElement(
					I18nProvider,
					null,
					React.createElement(
						SoundProvider,
						null,
						React.createElement(
							SessionProvider,
							null,
							React.createElement(WindowsProvider, null, React.createElement(SocHarness))
						)
					)
				)
			);
		});
		await React.act(async () => {
			await Promise.resolve();
			t.mock.timers.tick(5);
			await Promise.resolve();
		});

		assert.strictEqual(socFetchCount, 1, `Expected exactly 1 initial /api/soc fetch, got ${socFetchCount}`);
		assert.ok(renderCount <= 5, `Expected bounded initial renders without loop, got ${renderCount}`);

		// Live SSE soc_updated triggers 1 silent refresh when visible
		const es = dom.eventSources[0];
		assert.ok(es, 'Expected EventSource to be opened by SessionProvider');
		await React.act(async () => {
			es.emit('soc_updated');
			await Promise.resolve();
			t.mock.timers.tick(5);
			await Promise.resolve();
		});
		assert.strictEqual(socFetchCount, 2);

		// Hidden tab skips soc_updated refresh
		dom.doc.hidden = true;
		await React.act(async () => {
			es.emit('soc_updated');
			await Promise.resolve();
			t.mock.timers.tick(5);
			await Promise.resolve();
		});
		assert.strictEqual(socFetchCount, 2, 'Hidden tab must skip SSE soc_updated refetch');

		// Focus target switches SOC tab and applies IP filter then clears nonce
		dom.doc.hidden = false;
		await React.act(async () => {
			actionsRef.openApp('soc', { section: 'siem', kind: 'ip', itemId: '203.0.113.99' });
			await Promise.resolve();
			t.mock.timers.tick(5);
			await Promise.resolve();
		});
		assert.strictEqual(appliedTab, 'siem');
		assert.strictEqual(appliedIp, '203.0.113.99');

		await React.act(async () => {
			root.unmount();
			root = null;
		});
	} finally {
		if (root) {
			await React.act(async () => {
				root.unmount();
			});
		}
		t.mock.timers.reset();
		dom.restore();
	}
});

test('soc-context: useSocOverviewSlice and SocProvider keep fetchAll stable across re-renders without refetch loops', async (t) => {
	ensureCssModuleStubHook();
	const dom = installDomHarness();
	t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
	let directRoot = null;
	let ctxRoot = null;
	try {
		let socFetchCount = 0;
		let socPostCount = 0;
		globalThis.fetch = async (url, init) => {
			const u = String(url);
			if (u === '/api/auth/me') {
				return new Response(
					JSON.stringify({
						authenticated: true,
						user: {
							id: 'u_soc_ctx',
							name: 'Soc',
							surname: 'Director',
							email: 'soc-ctx@orbit.local',
							role: 'admin',
							admin: true,
							permissions: { soc: 'manage' },
						},
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
			if (u.startsWith('/api/soc?')) {
				socFetchCount += 1;
				return new Response(
					JSON.stringify({
						overview: {
							defcon: 5,
							defconLevel: 5,
							lockdown: { active: false, reason: '' },
							emergencySwitches: { disableRegistrations: false, disableUploads: false, passkeyOnly: false },
							totalRequests: 100 + socFetchCount,
						},
						bans: [],
						sessions: [],
						incidents: [],
						siem: [],
						siemMeta: { totalCount: 0, page: 1, limit: 50, totalPages: 1, histogram: [] },
						currentUserId: 'u_soc_ctx',
						callerIp: '127.0.0.1',
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
			if (u === '/api/soc' && (init?.method || 'GET').toUpperCase() === 'POST') {
				socPostCount += 1;
				return new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			if (u.startsWith('/api/soc/testbench?')) {
				return new Response(JSON.stringify({ authenticated: true }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
		};

		const { I18nProvider } = await import('../../src/core/i18n/index.ts');
		const { SoundProvider } = await import('../../src/core/sound/index.ts');
		const { SessionProvider } = await import('../../src/core/session/index.ts');
		const { WindowsProvider } = await import('../../src/core/windows/index.ts');
		const { DialogProvider } = await import('../../src/components/Common/DialogProvider.tsx');
		const { SocProvider, useSoc } = await import('../../src/apps/soc/context/SocContext.tsx');
		const { useSocOverviewSlice } = await import('../../src/apps/soc/context/slices/useSocOverviewSlice.ts');
		const { useSocRefreshEffects } = await import('../../src/apps/soc/context/slices/useSocRefreshEffects.ts');

		// Part 1: Direct useSocOverviewSlice stability across forced parent re-renders and state updates
		let directRenderCount = 0;
		let directFetchCountAfterReady = 0;
		const directFetchAllRefs = new Set();
		let triggerDirectRerender = null;
		let directSliceRef = null;
		const noop = () => {};
		const stableDialog = {
			confirm: async () => true,
			alert: async () => {},
			prompt: async () => null,
			select: async () => null,
		};
		const stableQueryParams = () => new URLSearchParams({ page: '1' });
		const modalRef = { current: false };
		const noopInspection = async () => {};

		function DirectOverviewHarness() {
			const [tick, setTick] = React.useState(0);
			triggerDirectRerender = () => setTick((n) => n + 1);
			directRenderCount += 1;
			const slice = useSocOverviewSlice({
				canView: true,
				canManage: true,
				showNotice: noop,
				dialog: stableDialog,
				buildSiemQueryParams: stableQueryParams,
				setIsLoading: noop,
				setIsSubmitting: noop,
				setBanner: noop,
				setIngressDiagnostics: noop,
				setBans: noop,
				setSessions: noop,
				setIncidents: noop,
				setSiemLogs: noop,
				setSiemTotalCount: noop,
				setSiemPage: noop,
				setSiemTotalPages: noop,
				setSiemHistogram: noop,
				setCurrentUserId: noop,
				setCallerIp: noop,
				setWebhookConfig: noop,
				showWebhookModalRef: modalRef,
			});
			directSliceRef = slice;
			if (tick >= 0) directFetchAllRefs.add(slice.fetchAll);
			useSocRefreshEffects({
				canView: true,
				autoRefresh: false,
				activeTab: 'radar',
				fimTarget: 'repo',
				fetchAll: slice.fetchAll,
				fetchInspectionData: noopInspection,
			});
			return null;
		}

		const directHost = dom.doc.createElement('div');
		dom.rootEl.appendChild(directHost);
		directRoot = createRoot(directHost);
		await React.act(async () => {
			directRoot.render(
				React.createElement(I18nProvider, null, React.createElement(DirectOverviewHarness))
			);
		});
		await React.act(async () => {
			await Promise.resolve();
			t.mock.timers.tick(5);
			await Promise.resolve();
		});
		directFetchCountAfterReady = socFetchCount;
		assert.strictEqual(directFetchCountAfterReady, 1);

		for (let i = 0; i < 4; i++) {
			await React.act(async () => {
				triggerDirectRerender();
				directSliceRef.setOverview((prev) => (prev ? { ...prev, totalRequests: 200 + i } : prev));
				await Promise.resolve();
				t.mock.timers.tick(5);
				await Promise.resolve();
			});
		}
		assert.strictEqual(directFetchAllRefs.size, 1, 'useSocOverviewSlice.fetchAll must preserve referential stability across re-renders');
		assert.strictEqual(socFetchCount, 1, `Re-renders and setOverview must not re-trigger fetchAll (got ${socFetchCount})`);
		assert.ok(directRenderCount >= 5);

		await React.act(async () => {
			directRoot.unmount();
			directRoot = null;
		});

		// Part 2: Real SocProvider + useSoc() end-to-end callback stability
		socFetchCount = 0;
		let ctxRenders = 0;
		let latestSoc = null;
		let bumpParent = null;
		const postReadyFetchAllRefs = new Set();

		function SocSpy() {
			ctxRenders += 1;
			const soc = useSoc();
			latestSoc = soc;
			if (soc.canView) {
				postReadyFetchAllRefs.add(soc.fetchAll);
			}
			return null;
		}

		function ProviderHarness() {
			const [, setCounter] = React.useState(0);
			bumpParent = () => setCounter((c) => c + 1);
			return React.createElement(
				I18nProvider,
				null,
				React.createElement(
					SoundProvider,
					null,
					React.createElement(
						SessionProvider,
						null,
						React.createElement(
							WindowsProvider,
							null,
							React.createElement(DialogProvider, null, React.createElement(SocProvider, null, React.createElement(SocSpy)))
						)
					)
				)
			);
		}

		const ctxHost = dom.doc.createElement('div');
		dom.rootEl.appendChild(ctxHost);
		ctxRoot = createRoot(ctxHost);

		await React.act(async () => {
			ctxRoot.render(React.createElement(ProviderHarness));
		});
		await React.act(async () => {
			await Promise.resolve();
			t.mock.timers.tick(5);
			await Promise.resolve();
		});

		assert.strictEqual(latestSoc?.canView, true);
		assert.strictEqual(socFetchCount, 1, `SocProvider initial mount must fetch /api/soc?action=all once, got ${socFetchCount}`);
		assert.strictEqual(postReadyFetchAllRefs.size, 1, 'SocProvider fetchAll reference must remain stable after data hydration');

		// Trigger multiple consumer state updates & parent re-renders without causing extra fetchAll calls
		await React.act(async () => {
			bumpParent();
			latestSoc.setActiveTab('siem');
			latestSoc.setFwIp('192.0.2.50');
			latestSoc.setSiemPage(2);
			await Promise.resolve();
			t.mock.timers.tick(5);
			await Promise.resolve();
		});
		await React.act(async () => {
			bumpParent();
			latestSoc.setActiveTab('radar');
			await Promise.resolve();
			t.mock.timers.tick(5);
			await Promise.resolve();
		});

		assert.strictEqual(
			postReadyFetchAllRefs.size,
			1,
			`SocProvider fetchAll reference changed across re-renders (${postReadyFetchAllRefs.size} unique refs)`
		);
		assert.strictEqual(socFetchCount, 1, `Expected no refetch loop on SocProvider re-renders, got ${socFetchCount}`);
		assert.ok(ctxRenders <= 12, `Expected bounded SocProvider renders without loop, got ${ctxRenders}`);

		// Explicit action triggers exactly 1 follow-up fetchAll(true) and preserves fetchAll identity
		await React.act(async () => {
			const ok = await latestSoc.runSocAction({ action: 'unban', ip: '192.0.2.50' }, 'Unbanned');
			assert.strictEqual(ok, true);
			await Promise.resolve();
			t.mock.timers.tick(5);
			await Promise.resolve();
		});
		assert.strictEqual(socPostCount, 1);
		assert.strictEqual(socFetchCount, 2);
		assert.strictEqual(postReadyFetchAllRefs.size, 1);

		await React.act(async () => {
			ctxRoot.unmount();
			ctxRoot = null;
		});
	} finally {
		if (directRoot) {
			await React.act(async () => {
				directRoot.unmount();
			});
		}
		if (ctxRoot) {
			await React.act(async () => {
				ctxRoot.unmount();
			});
		}
		t.mock.timers.reset();
		dom.restore();
	}
});

test('focus-target DOM lifecycle: useFocusTarget waits for ready, observes late element via MutationObserver, scrolls, flashes, and falls back on missing target', async (t) => {
	const dom = installDomHarness();
	t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
	let root = null;
	try {
		globalThis.fetch = async (url) => {
			if (url === '/api/auth/me') {
				return new Response(
					JSON.stringify({
						authenticated: true,
						user: {
							id: 'u_admin',
							name: 'Admin',
							surname: 'User',
							email: 'admin@orbit.local',
							role: 'admin',
							admin: true,
							permissions: { members: 'manage', soc: 'manage' },
						},
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
			return new Response('{}', { status: 200 });
		};

		const { I18nProvider } = await import('../../src/core/i18n/index.ts');
		const { SoundProvider } = await import('../../src/core/sound/index.ts');
		const { SessionProvider } = await import('../../src/core/session/index.ts');
		const { WindowsProvider, useWindowActions } = await import('../../src/core/windows/index.ts');
		const { useFocusTarget } = await import('../../src/lib/client/useFocusTarget.ts');

		// Build DOM window frame + scrollable container inside documentElement
		const windowFrame = dom.doc.createElement('div');
		windowFrame.setAttribute('data-window-frame', 'members');
		const miniAppFrame = dom.doc.createElement('div');
		miniAppFrame.classList.add('mini-app-frame');
		miniAppFrame.setAttribute('data-app-id', 'members');
		miniAppFrame._overflowY = 'auto';
		miniAppFrame.scrollHeight = 800;
		miniAppFrame.clientHeight = 200;
		miniAppFrame._rect = { top: 100, bottom: 300, height: 200 };
		windowFrame.appendChild(miniAppFrame);
		dom.rootEl.appendChild(windowFrame);

		let actionsRef = null;
		let appliedTargets = [];
		let refetchCount = 0;
		let currentPending = null;
		let setReadyRef = null;

		function FocusHarness() {
			const [ready, setReady] = React.useState(false);
			setReadyRef = setReady;
			actionsRef = useWindowActions();
			currentPending = useFocusTarget('members', {
				ready,
				apply: (target) => appliedTargets.push(target),
				refetch: () => {
					refetchCount += 1;
				},
			});
			return null;
		}

		const mountHost = dom.doc.createElement('div');
		dom.rootEl.appendChild(mountHost);
		root = createRoot(mountHost);

		await React.act(async () => {
			root.render(
				React.createElement(
					I18nProvider,
					null,
					React.createElement(
						SoundProvider,
						null,
						React.createElement(
							SessionProvider,
							null,
							React.createElement(WindowsProvider, null, React.createElement(FocusHarness))
						)
					)
				)
			);
		});
		await React.act(async () => {
			await Promise.resolve();
			t.mock.timers.tick(20);
			await Promise.resolve();
		});

		// 1. Target opened while ready === false must wait (not applied or cleared)
		await React.act(async () => {
			actionsRef.openApp('members', { kind: 'member', itemId: 'u_42' });
		});
		assert.strictEqual(appliedTargets.length, 0);
		assert.strictEqual(currentPending?.itemId, 'u_42');

		// 2. Flip ready === true -> apply runs immediately; insert target element AFTER SETTLE_MS via MutationObserver
		await React.act(async () => {
			setReadyRef(true);
		});
		assert.strictEqual(appliedTargets.length, 1);
		assert.strictEqual(appliedTargets[0].itemId, 'u_42');

		// Advance past SETTLE_MS (260ms) so MutationObserver is armed
		await React.act(async () => {
			t.mock.timers.tick(320);
		});
		assert.ok(currentPending, 'Target must stay pending while awaiting element mount');

		const rowEl = dom.doc.createElement('div');
		rowEl.setAttribute('data-focus-id', 'member:u_42');
		rowEl._rect = { top: 450, bottom: 490, height: 40 };
		await React.act(async () => {
			miniAppFrame.appendChild(rowEl);
			await Promise.resolve();
		});

		assert.strictEqual(rowEl.classList.contains('focus-flash'), true, 'Found target must receive focus-flash class');
		assert.ok(miniAppFrame.scrollTop > 0, `Scrollable container must scroll target into view (got ${miniAppFrame.scrollTop})`);
		assert.strictEqual(currentPending, null, 'Target must clear after element is found and flashed');
		assert.strictEqual(refetchCount, 0);

		// Advance past flash timer (1000ms) cleanup before testing give-up fallback
		await React.act(async () => {
			t.mock.timers.tick(1050);
		});
		assert.strictEqual(rowEl.classList.contains('focus-flash'), false, 'focus-flash must auto-clear after FLASH_MS');

		// 3. Missing element fallback: triggers refetch (~1200ms) and flashWindowFrame (~3000ms)
		await React.act(async () => {
			actionsRef.openApp('members', { kind: 'member', itemId: 'missing_999' });
		});
		assert.strictEqual(appliedTargets.length, 2);

		await React.act(async () => {
			t.mock.timers.tick(260);
			t.mock.timers.tick(1090);
		});
		assert.strictEqual(refetchCount, 1, 'Missing element must trigger one refetch');

		await React.act(async () => {
			t.mock.timers.tick(1850);
		});
		assert.strictEqual(
			windowFrame.classList.contains('focus-flash--window'),
			true,
			'Missing target must flash the window frame before clearing'
		);
		assert.strictEqual(currentPending, null, 'Target must clear after GIVE_UP_MS fallback');

		// Advance past window flash timer to end cleanly before unmount
		await React.act(async () => {
			t.mock.timers.tick(1050);
			root.unmount();
			root = null;
		});
	} finally {
		if (root) {
			await React.act(async () => {
				root.unmount();
			});
		}
		t.mock.timers.reset();
		dom.restore();
	}
});
