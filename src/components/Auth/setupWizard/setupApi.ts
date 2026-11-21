import type { DetectedCandidate } from './setupTypes';
import { isOrganizationArchetype, type OrganizationArchetype } from '@/lib/archetypes';

export interface SetupProbeResult {
	ready: boolean;
	dbConnected: boolean;
	dbName?: string;
	brand?: {
		studioName?: string;
		communityName?: string;
		domain?: string;
		archetype?: OrganizationArchetype;
	};
}

export interface DbTestOutcome {
	ok: boolean;
	message: string;
	databaseName?: string;
	alreadyInitialized?: boolean;
	requiresUnlock?: boolean;
}

export interface SetupUnlockStatus {
	tokenRequired: boolean;
	unlocked: boolean;
}

export interface CompleteSetupPayload {
	dbUrl?: string;
	archetype: OrganizationArchetype;
	studioName: string;
	communityName: string;
	domain: string;
	name: string;
	surname: string;
	email: string;
	password: string;
	smtpHost?: string;
	smtpPort: number;
	smtpUser?: string;
	smtpPassword?: string;
	smtpFrom?: string;
}

export function redirectHomeOrComplete(onComplete: () => void): void {
	if (typeof window !== 'undefined') {
		// eslint-disable-next-line @next/next/no-location-assign-relative-destination
		window.location.href = '/';
	} else {
		onComplete();
	}
}

export async function fetchInitialSetupProbe(): Promise<SetupProbeResult | null> {
	const res = await fetch('/api/setup', { cache: 'no-store' });
	const data = res.ok ? await res.json().catch(() => null) : null;
	if (!data) return null;

	return {
		ready: data.ready === true,
		dbConnected: Boolean(data.dbStatus?.connected),
		dbName: data.dbStatus?.databaseName,
		brand: data.brand
			? {
					studioName: data.brand.studioName,
					communityName: data.brand.communityName,
					domain: data.brand.domain,
					archetype: isOrganizationArchetype(data.brand.archetype) ? data.brand.archetype : undefined,
				}
			: undefined,
	};
}

export async function fetchAutoDetectCandidates(): Promise<DetectedCandidate[]> {
	const res = await fetch('/api/setup/auto-detect', { cache: 'no-store' });
	const data = await res.json().catch(() => ({}));
	if (res.ok && Array.isArray(data?.candidates)) {
		return data.candidates as DetectedCandidate[];
	}
	return [];
}

export function readSetupTokenFromUrl(): string {
	if (typeof window === 'undefined') return '';
	try {
		const hashToken = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')?.trim();
		if (hashToken) return hashToken;
		return new URLSearchParams(window.location.search).get('token')?.trim() || '';
	} catch {
		// Ignore malformed browser query or hash parameters
		return '';
	}
}

export function getSetupTokenHeaders(): Record<string, string> {
	const token = readSetupTokenFromUrl();
	return token ? { 'x-orbit-setup-token': token } : {};
}

export function scrubSetupTokenFromUrl(): void {
	if (typeof window === 'undefined') return;
	try {
		const currentUrl = new URL(window.location.href);
		let changed = false;
		if (currentUrl.searchParams.has('token')) {
			currentUrl.searchParams.delete('token');
			changed = true;
		}
		const rawHash = currentUrl.hash.replace(/^#/, '');
		let nextHash = currentUrl.hash;
		if (rawHash) {
			const hashParams = new URLSearchParams(rawHash);
			if (hashParams.has('token')) {
				hashParams.delete('token');
				const serializedHash = hashParams.toString();
				nextHash = serializedHash ? `#${serializedHash}` : '';
				changed = true;
			}
		}
		if (!changed) return;
		const nextSearch = currentUrl.searchParams.toString();
		const cleanRelative = `${currentUrl.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash}`;
		window.history.replaceState(null, '', cleanRelative);
	} catch {
		// Ignore history replacement failures in restricted environments
	}
}

export async function fetchSetupUnlockStatus(): Promise<SetupUnlockStatus> {
	const res = await fetch('/api/setup/unlock', {
		cache: 'no-store',
		credentials: 'same-origin',
	});
	const data = await res.json().catch(() => {
		/* Treat malformed unlock status replies as locked */
		return {};
	});
	if (!res.ok) {
		return { tokenRequired: true, unlocked: false };
	}
	return {
		tokenRequired: data.tokenRequired !== false,
		unlocked: data.unlocked === true,
	};
}

export async function requestSetupUnlock(
	token: string,
): Promise<{ ok: boolean; error?: string }> {
	const cleanToken = token.trim();
	const res = await fetch('/api/setup/unlock', {
		method: 'POST',
		credentials: 'same-origin',
		headers: {
			'Content-Type': 'application/json',
			'x-orbit-setup-token': cleanToken,
		},
		body: JSON.stringify({ token: cleanToken }),
	});
	const data = await res.json().catch(() => {
		/* Handle non-JSON responses during unlock request */
		return {};
	});
	if (!res.ok || !data.ok) {
		return {
			ok: false,
			error: String(data.error || 'Invalid or missing setup token.'),
		};
	}
	return { ok: true };
}

export async function requestDbTest(
	body: { url: string } | { candidateId: string; type: string } | { useConfigured: true; type: string },
	fallbackSuccessMessage: string,
	fallbackErrorMessage: string,
): Promise<DbTestOutcome> {
	const res = await fetch('/api/setup/test-db', {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json', ...getSetupTokenHeaders() },
		body: JSON.stringify(body),
	});
	const data = await res.json().catch(() => {
		/* Treat unreadable test-db responses as error payload */
		return {};
	});
	if (res.ok && data.ok) {
		return {
			ok: true,
			message: data.message || fallbackSuccessMessage,
			databaseName: data.databaseName,
			alreadyInitialized: Boolean(data.alreadyInitialized),
		};
	}
	return {
		ok: false,
		message: data.error || fallbackErrorMessage,
		requiresUnlock: res.status === 403 && data?.code === 'SETUP_TOKEN_REQUIRED',
	};
}

export async function requestCompleteSetup(
	payload: CompleteSetupPayload,
): Promise<{ ok: true } | { ok: false; error: string; requiresUnlock?: boolean }> {
	const res = await fetch('/api/setup/complete', {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json', ...getSetupTokenHeaders() },
		body: JSON.stringify(payload),
	});
	const data = await res.json().catch(() => {
		/* Handle non-JSON responses during setup completion */
		return {};
	});
	if (!res.ok) {
		return {
			ok: false,
			error: String(data.error || 'Setup could not be completed.'),
			requiresUnlock: res.status === 403 && data?.code === 'SETUP_TOKEN_REQUIRED',
		};
	}
	return { ok: true };
}

export function createGeneratedDbPassword(): string {
	if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
		const buf = new Uint8Array(16);
		window.crypto.getRandomValues(buf);
		return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
	}
	return 'change_this_password';
}

export function downloadTextFile(filename: string, content: string): void {
	const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
