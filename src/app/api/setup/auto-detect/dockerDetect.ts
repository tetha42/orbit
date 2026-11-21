import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CandidateTarget {
	id: string;
	url: string;
	label: string;
	type: 'env' | 'docker' | 'baremetal';
}

interface StoredCandidate {
	url: string;
	expiresAt: number;
}

const CANDIDATE_TTL_MS = 10 * 60 * 1000;
const EXCLUDED_CONTAINERS = new Set(['orbit-ui-e2e-pg']);

const globalForDetect = globalThis as typeof globalThis & {
	__orbitDetectedDbCandidates?: Map<string, StoredCandidate>;
};

function getCandidateStore(): Map<string, StoredCandidate> {
	if (!globalForDetect.__orbitDetectedDbCandidates) {
		globalForDetect.__orbitDetectedDbCandidates = new Map();
	}
	return globalForDetect.__orbitDetectedDbCandidates;
}

export function rememberDetectedCandidate(id: string, url: string): void {
	const store = getCandidateStore();
	const now = Date.now();
	for (const [key, entry] of store.entries()) {
		if (entry.expiresAt <= now) store.delete(key);
	}
	store.set(id, { url, expiresAt: now + CANDIDATE_TTL_MS });
}

export function getDetectedCandidateUrl(id: string): string | null {
	const store = getCandidateStore();
	const entry = store.get(id);
	if (!entry) return null;
	if (entry.expiresAt <= Date.now()) {
		store.delete(id);
		return null;
	}
	return entry.url;
}

export function clearDetectedCandidates(): void {
	getCandidateStore().clear();
}

function parseContainerEnv(envList: unknown): Record<string, string> {
	const env: Record<string, string> = {};
	if (!Array.isArray(envList)) return env;
	for (const entry of envList) {
		if (typeof entry !== 'string') continue;
		const eqIdx = entry.indexOf('=');
		if (eqIdx > 0) {
			env[entry.slice(0, eqIdx)] = entry.slice(eqIdx + 1);
		}
	}
	return env;
}

function buildPostgresUrl(user: string, password: string, hostIp: string, hostPort: string, dbName: string): string {
	const encodedUser = encodeURIComponent(user);
	const auth = password ? `${encodedUser}:${encodeURIComponent(password)}` : encodedUser;
	return `postgresql://${auth}@${hostIp}:${hostPort}/${encodeURIComponent(dbName)}`;
}

async function inspectDockerPostgres(containerId: string, name: string): Promise<CandidateTarget | null> {
	try {
		const { stdout } = await execFileAsync('docker', ['inspect', '--format', '{{json .}}', containerId], {
			timeout: 2000,
		});
		const info = JSON.parse(stdout) as {
			NetworkSettings?: { Ports?: Record<string, Array<{ HostIp?: string; HostPort?: string }> | null> };
			Config?: { Env?: unknown };
		};
		const binding = info.NetworkSettings?.Ports?.['5432/tcp']?.[0];
		const hostPort = binding?.HostPort?.trim();
		if (!hostPort) return null;

		const rawIp = binding?.HostIp?.trim() || '';
		const hostIp = rawIp && rawIp !== '0.0.0.0' && rawIp !== '::' ? rawIp : '127.0.0.1';
		const env = parseContainerEnv(info.Config?.Env);
		const user = env.POSTGRES_USER?.trim() || 'postgres';
		const dbName = env.POSTGRES_DB?.trim() || user;
		const password = env.POSTGRES_PASSWORD ?? '';
		const cleanName = name.replace(/^\//, '').trim() || containerId.slice(0, 12);

		return {
			id: `docker:${cleanName}`,
			url: buildPostgresUrl(user, password, hostIp, hostPort, dbName),
			label: `Docker: ${cleanName}`,
			type: 'docker',
		};
	} catch {
		// Ignore containers that stopped or could not be inspected in time.
		return null;
	}
}

export async function discoverDevDockerPostgres(): Promise<CandidateTarget[]> {
	if (process.env.NODE_ENV !== 'development') {
		return [];
	}

	try {
		const { stdout } = await execFileAsync(
			'docker',
			['ps', '--filter', 'status=running', '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}'],
			{ timeout: 2000 }
		);
		const matches: Array<{ id: string; name: string }> = [];
		for (const rawLine of stdout.split(/\r?\n/)) {
			const line = rawLine.trim();
			if (!line) continue;
			const [id = '', name = '', image = '', ports = ''] = line.split('\t');
			if (!id || EXCLUDED_CONTAINERS.has(name)) continue;
			if (!/postgres|postgis|timescale/i.test(image) && !ports.includes('5432/tcp')) continue;
			matches.push({ id, name });
			if (matches.length >= 5) break;
		}
		if (matches.length === 0) return [];
		const inspected = await Promise.all(matches.map((m) => inspectDockerPostgres(m.id, m.name)));
		return inspected.filter((c): c is CandidateTarget => c !== null);
	} catch {
		// Docker CLI unavailable, daemon stopped, or timed out.
		return [];
	}
}
