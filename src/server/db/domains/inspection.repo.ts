import { spawn, spawnSync, execFileSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	chmodSync,
	statSync,
	readdirSync,
	readFileSync,
	writeFileSync,
	type Dirent,
} from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { logSystemEvent } from './logs.repo';
import { recordSecurityStrike } from './security.repo';

export interface FimSuspiciousMatch {
	path: string;
	matchedRule: string;
	severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
	line: number;
	snippet: string;
}

export interface FimAnomaly {
	path: string;
	type: 'added' | 'modified' | 'deleted';
	oldHash?: string;
	newHash?: string;
}

export interface FimScanResult {
	targetDir: string;
	targetKey: string;
	scannedFiles: number;
	durationMs: number;
	timestamp: number;
	suspiciousFiles: FimSuspiciousMatch[];
	anomalies: FimAnomaly[];
	baselineSaved: boolean;
	errors: string[];
}

export interface RouteSecurityReport {
	endpoint: string;
	category: 'auth' | 'public' | 'data' | 'terminal' | 'soc' | 'core';
	isPublicExpected: boolean;
	unauthStatus: number;
	authGuarded: boolean;
	wafIntercepted: boolean;
	wafStatus: number;
	hasSecurityHeaders: boolean;
	headers: {
		xContentTypeOptions: boolean;
		xFrameOptions: boolean;
		csp: boolean;
	};
	status: 'PASS' | 'WARN' | 'FAIL';
	latencyMs: number;
	message: string;
}

export interface AppSecSummary {
	totalTested: number;
	passed: number;
	warned: number;
	failed: number;
	score: number;
	grade: 'A+' | 'A' | 'B' | 'C' | 'F';
	wafActiveCount: number;
	durationMs: number;
	timestamp: number;
	routes: RouteSecurityReport[];
}

// In-memory caches to prevent server thrashing
interface CacheEntry<T> {
	timestamp: number;
	data: T;
}

const fimCache = new Map<string, CacheEntry<FimScanResult>>();
let appSecCache: CacheEntry<AppSecSummary> | null = null;
const CACHE_TTL_MS = 15_000; // 15 seconds

const ROOT_DIR = process.cwd();
const FIM_BINARY_PATH = join(ROOT_DIR, 'tools', 'bin', 'fim-scanner');
const FIM_GO_SOURCE = join(ROOT_DIR, 'tools', 'fim', 'main.go');
const FIM_BASELINE_PATH = join(ROOT_DIR, 'tools', 'fim', 'baseline.json');
const BUILD_SCRIPT_PATH = join(ROOT_DIR, 'scripts', 'build-fim.mjs');

function hasGoCompiler(): boolean {
	try {
		const res = spawnSync('go', ['version'], { stdio: 'ignore' });
		return res.status === 0;
	} catch {
		return false;
	}
}

/**
 * Ensures the Go binary exists and is executable. Never attempts runtime compilation
 * in production environments or when the Go compiler is missing.
 */
export async function ensureFimBinary(): Promise<string | null> {
	if (existsSync(FIM_BINARY_PATH)) {
		try {
			chmodSync(FIM_BINARY_PATH, 0o755);
		} catch {}

		// In production or when Go is absent, always use the existing pre-compiled binary
		if (process.env.NODE_ENV === 'production' || !hasGoCompiler()) {
			return FIM_BINARY_PATH;
		}

		// In development with Go present, recompile only if main.go is newer
		if (existsSync(FIM_GO_SOURCE)) {
			try {
				const binMtime = statSync(FIM_BINARY_PATH).mtimeMs;
				const srcMtime = statSync(FIM_GO_SOURCE).mtimeMs;
				if (srcMtime <= binMtime) {
					return FIM_BINARY_PATH;
				}
			} catch {
				return FIM_BINARY_PATH;
			}
		} else {
			return FIM_BINARY_PATH;
		}
	}

	// Binary does not exist; if in production or no Go compiler, do not attempt build
	if (process.env.NODE_ENV === 'production' || !hasGoCompiler()) {
		return null;
	}

	const binDir = join(ROOT_DIR, 'tools', 'bin');
	if (!existsSync(binDir)) {
		mkdirSync(binDir, { recursive: true });
	}

	try {
		execFileSync(process.execPath, [BUILD_SCRIPT_PATH], {
			cwd: ROOT_DIR,
			timeout: 20_000,
		});
		if (existsSync(FIM_BINARY_PATH)) {
			chmodSync(FIM_BINARY_PATH, 0o755);
			return FIM_BINARY_PATH;
		}
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		console.warn(`[FIM] Go binary derleme atlandı (${message}), Pure Node motoru devrede.`);
		return null;
	}

	return null;
}

/**
 * Sanitizes and maps target directory keys to safe filesystem paths.
 */
export function resolveTargetDir(target: string): { key: string; path: string } {
	const trimmed = (target || 'repo').trim().toLowerCase();

	if (trimmed === 'uploads') {
		const uploadsDir = join(ROOT_DIR, 'data', 'uploads');
		if (!existsSync(uploadsDir)) {
			mkdirSync(uploadsDir, { recursive: true });
		}
		return { key: 'uploads', path: uploadsDir };
	}

	if (trimmed === 'tmp') {
		return { key: 'tmp', path: '/tmp' };
	}

	if (trimmed === 'repo' || trimmed === 'src') {
		return { key: 'repo', path: ROOT_DIR };
	}

	// Validate custom relative or absolute path
	const resolved = resolve(/*turbopackIgnore: true*/ ROOT_DIR, target);
	const repoWithSlash = ROOT_DIR.endsWith('/') ? ROOT_DIR : ROOT_DIR + '/';
	const isInsideRepo = resolved === ROOT_DIR || resolved.startsWith(repoWithSlash);
	const isInsideTmp = resolved === '/tmp' || resolved.startsWith('/tmp/');

	if (!isInsideRepo && !isInsideTmp) {
		throw new Error('Erişim reddedildi: Belirtilen dizin repo kökü veya /tmp dışında.');
	}

	return { key: 'custom', path: resolved };
}

/**
 * Runs the compiled FIM binary using streaming child_process.spawn with timeout handling.
 */
function runFimProcessViaSpawn(binPath: string, args: string[], cwd: string, timeoutMs = 30_000): Promise<string> {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(binPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		const timer = setTimeout(() => {
			try {
				child.kill('SIGTERM');
				setTimeout(() => {
					try {
						child.kill('SIGKILL');
					} catch {}
				}, 2000);
			} catch {}
			rejectPromise(new Error(`FIM taraması zaman aşımına uğradı (${timeoutMs}ms)`));
		}, timeoutMs);

		child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

		child.on('error', (err) => {
			clearTimeout(timer);
			rejectPromise(err);
		});

		child.on('close', (code) => {
			clearTimeout(timer);
			const stdoutStr = Buffer.concat(stdoutChunks).toString('utf-8');
			const stderrStr = Buffer.concat(stderrChunks).toString('utf-8');
			if (code !== 0 && !stdoutStr.trim()) {
				rejectPromise(new Error(`FIM binary çıkış kodu ${code}: ${stderrStr || 'Bilinmeyen hata'}`));
			} else {
				resolvePromise(stdoutStr);
			}
		});
	});
}

interface HeuristicRuleDef {
	name: string;
	severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
	pattern: RegExp;
	extensions?: string[];
}

const PHP_EXTENSIONS = ['.php', '.phtml', '.php5', '.phar', '.inc'];
const NODE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.tsx'];

const PURE_HEURISTIC_RULES: HeuristicRuleDef[] = [
	{
		name: 'PHP_EVAL_BASE64',
		severity: 'CRITICAL',
		pattern: /(?:eval\s*\(|assert\s*\(\s*["']|\$\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*|create_function\s*\(|preg_replace\s*\(\s*["'][^"']*\/e["'])/i,
		extensions: PHP_EXTENSIONS,
	},
	{
		name: 'SHELL_COMMAND_EXEC',
		severity: 'CRITICAL',
		pattern: /(?:passthru|shell_exec|system|popen|proc_open|pcntl_exec)\s*\(/i,
		extensions: PHP_EXTENSIONS,
	},
	{
		name: 'NODE_CHILD_PROCESS_EXEC',
		severity: 'CRITICAL',
		pattern: /(?:child_process\.(?:exec|spawn|fork|execSync|spawnSync|execFile|execFileSync)\s*\(|require\s*\(\s*["'](?:node:)?child_process["']\)|import\s*\(\s*["'](?:node:)?child_process["']\)|(?:exec|spawn|execFile)\s*\(\s*["'](?:\/bin\/(?:ba)?sh|sh|bash|cmd(?:\.exe)?|powershell))/i,
		extensions: NODE_EXTENSIONS,
	},
	{
		name: 'BACKDOOR_FILE_WRITE',
		severity: 'HIGH',
		pattern: /(?:fs\.writeFileSync|fs\.writeFile|file_put_contents)\s*\([^,]+(?:\.php|\.phtml|\.phar|\.sh|\.bash|\.elf|\.exe|\.cgi)/i,
	},
	{
		name: 'REVERSE_SHELL_NET',
		severity: 'CRITICAL',
		pattern: /(?:\/dev\/(?:tcp|udp)\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d+|(?:nc|ncat|netcat)\s+.*-[eE]\s+|(?:nc|ncat|netcat)\s+-[eE]\s+|python(?:\d)?\s+-c\s+['"].*(?:socket.*connect|pty\.spawn)|perl\s+-e\s+['"].*socket.*connect|ruby\s+-e\s+['"].*TCPSocket|mkfifo\s+\/tmp)/i,
	},
	{
		name: 'POWERSHELL_OR_CURL_PIPE',
		severity: 'HIGH',
		pattern: /(?:powershell(?:\.exe)?\s+-(?:enc|encodedcommand)\s+[a-zA-Z0-9+/=]{16,}|(?:curl|wget)\s+-[sS]?\s+.*\|\s*(?:bash|sh))/i,
	},
	{
		name: 'OBFUSCATED_PAYLOAD',
		severity: 'HIGH',
		pattern: /(?:\\x[0-9a-fA-F]{2}){8,}|base64_decode\s*\(\s*['"]?[a-zA-Z0-9+/=]{24,}|(?:gzinflate|gzuncompress|gzdecode|str_rot13|hex2bin)\s*\(/i,
	},
	{
		name: 'INTERACTIVE_SHELL_SPAWN',
		severity: 'CRITICAL',
		pattern: /(?:pty\.spawn\s*\(\s*["'](?:\/bin\/)?(?:ba)?sh["']|execve\s*\(\s*["']\/bin\/(?:ba)?sh|bash\s+-i\s+>&|\/bin\/(?:ba)?sh\s+-i\s+>&)/i,
	},
];

const SCANNABLE_EXTENSIONS = new Set([
	'.php', '.phtml', '.php5', '.phar', '.inc',
	'.sh', '.bash', '.js', '.mjs', '.cjs', '.ts', '.tsx',
	'.py', '.pl', '.rb', '.jsp', '.asp', '.aspx', '.cgi',
	'.html', '.htm',
]);

function scanBufferForSuspicious(filePath: string, buffer: Buffer): FimSuspiciousMatch[] {
	const ext = extname(filePath).toLowerCase();
	const isUploadOrTmp = filePath.includes('data/uploads') || filePath.startsWith('/tmp');

	if (!isUploadOrTmp && !SCANNABLE_EXTENSIONS.has(ext)) {
		return [];
	}

	if (
		filePath.endsWith('tools/fim/main.go') ||
		filePath.endsWith('scripts/security-e2e-test.mjs') ||
		filePath.endsWith('tools/fim/baseline.json')
	) {
		return [];
	}

	// Check if binary file contains executable ELF or MZ/PE headers in data/uploads
	if (buffer.includes(0)) {
		if (filePath.includes('data/uploads')) {
			if (
				(buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) ||
				(buffer[0] === 0x4d && buffer[1] === 0x5a)
			) {
				return [
					{
						path: filePath,
						matchedRule: 'EXECUTABLE_BINARY_IN_UPLOADS',
						severity: 'CRITICAL',
						line: 1,
						snippet: '[Compiled ELF / PE binary executable file detected in uploads directory]',
					},
				];
			}
		}
		return [];
	}

	if (buffer.length > 5 * 1024 * 1024) {
		return [];
	}

	const content = buffer.toString('utf-8');
	const lines = content.split('\n');
	const matches: FimSuspiciousMatch[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line || line.trim().length === 0) continue;

		for (const rule of PURE_HEURISTIC_RULES) {
			if (!isUploadOrTmp && rule.extensions && rule.extensions.length > 0) {
				if (!rule.extensions.includes(ext)) {
					continue;
				}
			}

			if (rule.pattern.test(line)) {
				let snippet = line.trim();
				if (snippet.length > 160) {
					snippet = snippet.slice(0, 157) + '...';
				}
				matches.push({
					path: filePath,
					matchedRule: rule.name,
					severity: rule.severity,
					line: i + 1,
					snippet,
				});
				break;
			}
		}
	}

	return matches;
}

function walkFimDirectory(
	dirPath: string,
	excludes: string[],
	onFile: (filePath: string) => void
): void {
	if (!existsSync(dirPath)) return;

	function walk(current: string) {
		let entries: Dirent[];
		try {
			entries = readdirSync(current, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			const fullPath = join(current, entry.name);
			const norm = fullPath.replace(/\\/g, '/');

			const isExcluded = excludes.some((excl) => {
				const e = excl.replace(/\\/g, '/');
				return (
					norm.includes('/' + e + '/') ||
					norm.endsWith('/' + e) ||
					norm === e ||
					norm.startsWith(e + '/')
				);
			});

			if (isExcluded) continue;

			if (entry.isDirectory()) {
				walk(fullPath);
			} else if (entry.isFile()) {
				onFile(fullPath);
			}
		}
	}

	walk(dirPath);
}

export async function runPureNodeFimScan(
	targetDir: string,
	baselinePath: string,
	saveBaseline = false
): Promise<FimScanResult> {
	const startTime = Date.now();
	const res: FimScanResult = {
		targetDir: resolve(/*turbopackIgnore: true*/ ROOT_DIR, targetDir),
		targetKey: 'repo',
		scannedFiles: 0,
		durationMs: 0,
		timestamp: Date.now(),
		suspiciousFiles: [],
		anomalies: [],
		baselineSaved: false,
		errors: [],
	};

	let existingBaseline: Record<string, string> = {};
	if (baselinePath && existsSync(baselinePath)) {
		try {
			existingBaseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
		} catch {
			existingBaseline = {};
		}
	}

	const currentHashes: Record<string, string> = {};
	const excludes = ['.git', 'node_modules', '.next', 'dist', 'tools/bin'];

	try {
		walkFimDirectory(res.targetDir, excludes, (filePath) => {
			try {
				const buffer = readFileSync(filePath);
				const hash = createHash('sha256').update(buffer).digest('hex');
				currentHashes[filePath] = hash;
				res.scannedFiles++;

				const matches = scanBufferForSuspicious(filePath, buffer);
				if (matches.length > 0) {
					res.suspiciousFiles.push(...matches);
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				res.errors.push(`hash error ${filePath}: ${msg}`);
			}
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		res.errors.push(`walk error: ${msg}`);
	}

	// Compare with baseline if baseline exists
	if (Object.keys(existingBaseline).length > 0) {
		for (const [path, oldHash] of Object.entries(existingBaseline)) {
			const newHash = currentHashes[path];
			if (newHash !== undefined) {
				if (oldHash !== newHash) {
					res.anomalies.push({ path, type: 'modified', oldHash, newHash });
				}
			} else {
				res.anomalies.push({ path, type: 'deleted', oldHash });
			}
		}
		for (const [path, newHash] of Object.entries(currentHashes)) {
			if (existingBaseline[path] === undefined) {
				res.anomalies.push({ path, type: 'added', newHash });
			}
		}
	}

	// Save baseline if requested
	if (saveBaseline && baselinePath) {
		try {
			const dir = dirname(baselinePath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			writeFileSync(baselinePath, JSON.stringify(currentHashes, null, 2), 'utf-8');
			res.baselineSaved = true;
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			res.errors.push(`failed to save baseline: ${msg}`);
		}
	}

	res.durationMs = Date.now() - startTime;
	return res;
}

/**
 * Runs the FIM scanner on the target directory. Prefers native Go binary if available
 * and functional; transparently falls back to Pure Node.js engine on container environments.
 */
export async function runFimScan(
	targetKeyOrPath = 'repo',
	options: { force?: boolean; saveBaseline?: boolean } = {}
): Promise<FimScanResult> {
	const { key, path: resolvedTarget } = resolveTargetDir(targetKeyOrPath);

	if (!options.force && !options.saveBaseline) {
		const cached = fimCache.get(key);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
			return cached.data;
		}
	}

	let parsed: FimScanResult | null = null;
	const binPath = await ensureFimBinary();

	if (binPath) {
		const args = [`--dir=${resolvedTarget}`, `--baseline=${FIM_BASELINE_PATH}`, `--workers=8`];
		if (options.saveBaseline) {
			args.push('--save-baseline');
		}

		try {
			const stdout = await runFimProcessViaSpawn(binPath, args, ROOT_DIR, 30_000);
			parsed = JSON.parse(stdout.trim());
		} catch (binErr: unknown) {
			const msg = binErr instanceof Error ? binErr.message : String(binErr);
			console.warn(`[FIM] Native binary hatası (${msg}), Pure Node motoruna devredildi.`);
			parsed = null;
		}
	}

	if (!parsed) {
		parsed = await runPureNodeFimScan(resolvedTarget, FIM_BASELINE_PATH, options.saveBaseline);
	}

	parsed.targetKey = key;

	// Alert SOC if critical suspicious files found
	if (parsed.suspiciousFiles && parsed.suspiciousFiles.length > 0) {
		void logSystemEvent({
			servis: 'security',
			seviye: 'ERROR',
			mesaj: `[FIM Web Shell Uyarısı] ${parsed.suspiciousFiles.length} şüpheli dosya/arka kapı tespit edildi (${key})!`,
			detay: {
				target: key,
				count: parsed.suspiciousFiles.length,
				preview: parsed.suspiciousFiles.slice(0, 5),
			},
		});
	}

	fimCache.set(key, { timestamp: Date.now(), data: parsed });
	return parsed;
}

const AUDIT_ENDPOINTS: Array<{
	endpoint: string;
	category: 'auth' | 'public' | 'data' | 'terminal' | 'soc' | 'core';
	isPublic: boolean;
	method?: 'GET' | 'POST';
	expectHoneypot?: boolean;
	expectedUnauthStatus?: number | number[];
}> = [
	// 1. Kimlik, Oturum & Doğrulama (19 Endpoint)
	{ endpoint: '/api/auth/me', category: 'auth', isPublic: false, method: 'GET' },
	{ endpoint: '/api/auth/login', category: 'auth', isPublic: true, method: 'POST' },
	{ endpoint: '/api/auth/register', category: 'auth', isPublic: true, method: 'POST' },
	{ endpoint: '/api/auth/logout', category: 'auth', isPublic: false, method: 'POST', expectedUnauthStatus: [200, 400, 401] },
	{ endpoint: '/api/auth/verify-password', category: 'auth', isPublic: false, method: 'POST' },
	{ endpoint: '/api/auth/reset-password', category: 'auth', isPublic: true, method: 'POST' },
	{ endpoint: '/api/auth/2fa/challenge', category: 'auth', isPublic: true, method: 'POST' },
	{ endpoint: '/api/auth/2fa/status', category: 'auth', isPublic: false, method: 'GET' },
	{ endpoint: '/api/auth/2fa/setup', category: 'auth', isPublic: false, method: 'POST' },
	{ endpoint: '/api/auth/2fa/enable', category: 'auth', isPublic: false, method: 'POST' },
	{ endpoint: '/api/auth/2fa/disable', category: 'auth', isPublic: false, method: 'POST' },
	{ endpoint: '/api/auth/passkey', category: 'auth', isPublic: false, method: 'GET' },
	{ endpoint: '/api/auth/passkey/login/options', category: 'auth', isPublic: true, method: 'POST' },
	{ endpoint: '/api/auth/passkey/login/verify', category: 'auth', isPublic: true, method: 'POST' },
	{ endpoint: '/api/auth/passkey/register/options', category: 'auth', isPublic: false, method: 'POST' },
	{ endpoint: '/api/auth/passkey/register/verify', category: 'auth', isPublic: false, method: 'POST' },
	{ endpoint: '/api/profile', category: 'auth', isPublic: false, method: 'GET' },
	{ endpoint: '/api/profile/photo', category: 'auth', isPublic: false, method: 'POST' },
	{ endpoint: '/api/profile/password', category: 'auth', isPublic: false, method: 'POST' },

	// 2. Dışa Açık ve Genel Servisler (8 Endpoint)
	{ endpoint: '/api/public/v1/news', category: 'public', isPublic: true, method: 'GET' },
	{ endpoint: '/api/public/v1/news/e2e-test-slug', category: 'public', isPublic: true, method: 'GET' },
	{ endpoint: '/api/public/v1/events', category: 'public', isPublic: true, method: 'GET' },
	{ endpoint: '/api/news', category: 'public', isPublic: true, method: 'GET' },
	{ endpoint: '/api/certificates', category: 'public', isPublic: true, method: 'GET' },
	{ endpoint: '/api/certificates/TEST-E2E-CERT', category: 'public', isPublic: true, method: 'GET' },
	{ endpoint: '/api/oauth/jwks', category: 'public', isPublic: true, method: 'GET' },
	{ endpoint: '/.well-known/openid-configuration', category: 'public', isPublic: true, method: 'GET' },

	// 3. Sistem, Çekirdek & OAuth Yönetimi (13 Endpoint)
	{ endpoint: '/api/setup', category: 'core', isPublic: true, method: 'GET' },
	{ endpoint: '/api/admin/config', category: 'core', isPublic: false, expectHoneypot: true, method: 'GET' },
	{ endpoint: '/api/admin/pending-approvals', category: 'core', isPublic: false, method: 'GET' },
	{ endpoint: '/api/admin/approve', category: 'core', isPublic: false, method: 'POST' },
	{ endpoint: '/api/notifications', category: 'core', isPublic: false, method: 'GET' },
	{ endpoint: '/api/search', category: 'core', isPublic: false, method: 'GET' },
	{ endpoint: '/api/settings/smtp', category: 'core', isPublic: false, method: 'GET' },
	{ endpoint: '/api/settings/smtp/test', category: 'core', isPublic: false, method: 'POST' },
	{ endpoint: '/api/community', category: 'core', isPublic: false, method: 'GET' },
	{ endpoint: '/api/oauth/authorize', category: 'core', isPublic: false, method: 'GET', expectedUnauthStatus: [400, 401, 403, 302] },
	{ endpoint: '/api/oauth/clients', category: 'core', isPublic: false, method: 'GET' },
	{ endpoint: '/api/oauth/token', category: 'core', isPublic: true, method: 'POST' },
	{ endpoint: '/api/oauth/userinfo', category: 'core', isPublic: false, method: 'GET' },
	{ endpoint: '/api/stream', category: 'core', isPublic: false, method: 'GET' },
	{ endpoint: '/api/olaylar', category: 'core', isPublic: false, method: 'GET' },

	// 4. Veritabanı Studio & Kulüp Modülleri (35 Endpoint)
	{ endpoint: '/api/database/tables', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/database/query', category: 'data', isPublic: false, method: 'POST' },
	{ endpoint: '/api/database/mutate', category: 'data', isPublic: false, method: 'POST' },
	{ endpoint: '/api/database/data', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/database/schema', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/database/import', category: 'data', isPublic: false, method: 'POST' },
	{ endpoint: '/api/database/auth', category: 'data', isPublic: false, method: 'POST' },
	{ endpoint: '/api/database/audit', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/members', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/roles', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/budget', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/budget/vaults', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/inventory', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/events', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/events/e2e-test-id/attendance', category: 'data', isPublic: false, method: 'GET', expectedUnauthStatus: [401, 403, 404] },
	{ endpoint: '/api/events/e2e-test-id/checkin-code', category: 'data', isPublic: false, method: 'GET', expectedUnauthStatus: [401, 403, 404] },
	{ endpoint: '/api/projects', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/projects/e2e-test-id', category: 'data', isPublic: false, method: 'GET', expectedUnauthStatus: [401, 403, 404] },
	{ endpoint: '/api/decisions', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/notes', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/notes/folders', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/upload', category: 'data', isPublic: false, method: 'POST' },
	{ endpoint: '/api/uploads/1700000000_abcdef0123456789ab.jpg', category: 'data', isPublic: false, method: 'GET', expectedUnauthStatus: [401, 403, 404] },
	{ endpoint: '/api/chat/rooms', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/chat/messages', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/chat/poll', category: 'data', isPublic: false, method: 'POST' },
	{ endpoint: '/api/chat/stream', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/mail', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/mail/action', category: 'data', isPublic: false, method: 'POST' },
	{ endpoint: '/api/mail/test', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/mail/e2e-test-uid', category: 'data', isPublic: false, method: 'GET', expectedUnauthStatus: [401, 403, 404] },
	{ endpoint: '/api/posta', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/posta/alicilar', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/posta/ayarlar', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/posta/okunmamis', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/posta/e2e-test-id', category: 'data', isPublic: false, method: 'GET', expectedUnauthStatus: [401, 403, 404] },
	{ endpoint: '/api/messages', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/messages/recipients', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/messages/settings', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/messages/unread', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/messages/e2e-test-id', category: 'data', isPublic: false, method: 'GET', expectedUnauthStatus: [401, 403, 404] },
	{ endpoint: '/api/teams', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/teams/tasks/e2e-test-id', category: 'data', isPublic: false, method: 'GET', expectedUnauthStatus: [401, 403, 404] },
	{ endpoint: '/api/teams/discover', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/soc/testbench', category: 'data', isPublic: false, method: 'GET' },

	// 5. Linux PTY Terminal (4 Endpoint)
	{ endpoint: '/api/terminal/session', category: 'terminal', isPublic: false, method: 'POST' },
	{ endpoint: '/api/terminal/input', category: 'terminal', isPublic: false, method: 'POST' },
	{ endpoint: '/api/terminal/resize', category: 'terminal', isPublic: false, method: 'POST' },
	{ endpoint: '/api/terminal/stream', category: 'terminal', isPublic: false, method: 'GET' },

	// 6. SoC Siber Savunma & Adli Bilişim (6 Endpoint)
	{ endpoint: '/api/soc', category: 'soc', isPublic: false, method: 'GET' },
	{ endpoint: '/api/soc/export', category: 'soc', isPublic: false, method: 'GET' },
	{ endpoint: '/api/soc/inspection', category: 'soc', isPublic: false, method: 'GET' },
	{ endpoint: '/api/soc/stream', category: 'soc', isPublic: false, method: 'GET' },
	{ endpoint: '/api/audit', category: 'soc', isPublic: false, method: 'GET' },
];

/**
 * Resolves the optimal base URL for self-auditing internal API routes.
 * Inside container environments (Docker, Kubernetes, Coolify), external domain or IP
 * requests from inside the container often fail due to lack of NAT loopback / hairpinning.
 * We resolve the internal loopback (127.0.0.1:PORT) while preserving the original Host header.
 */
export async function resolveWorkingAuditBase(
	baseUrl: string
): Promise<{ targetBase: string; hostHeader?: string }> {
	let hostPort = process.env.PORT || '3000';
	let originalHost = '';

	try {
		const parsed = new URL(baseUrl);
		originalHost = parsed.host;
		if (parsed.port) {
			hostPort = parsed.port;
		}
	} catch {}

	const candidates = [
		`http://127.0.0.1:${hostPort}`,
		`http://localhost:${hostPort}`,
		baseUrl.replace(/\/+$/, ''),
	];

	const uniqueCandidates = Array.from(new Set(candidates));

	for (const candidate of uniqueCandidates) {
		try {
			const res = await fetch(`${candidate}/api/setup`, {
				method: 'GET',
				headers: {
					'Accept': 'application/json',
					...(originalHost ? { 'Host': originalHost } : {}),
				},
				signal: AbortSignal.timeout(1000),
			});
			if (res.status > 0) {
				return { targetBase: candidate, hostHeader: originalHost || undefined };
			}
		} catch {
			// Candidate not reachable, try next
		}
	}

	// Default fallback to 127.0.0.1 loopback
	return { targetBase: `http://127.0.0.1:${hostPort}`, hostHeader: originalHost || undefined };
}

export async function testSingleEndpoint(
	targetBase: string,
	hostHeader: string | undefined,
	def: {
		endpoint: string;
		category: 'auth' | 'public' | 'data' | 'terminal' | 'soc' | 'core';
		isPublic: boolean;
		method?: 'GET' | 'POST';
		expectHoneypot?: boolean;
		expectedUnauthStatus?: number | number[];
	}
): Promise<RouteSecurityReport> {
	const t0 = Date.now();
	let unauthStatus = 0;
	let wafStatus = 0;
	let authGuarded = false;
	let wafIntercepted = false;
	let hasSecurityHeaders = false;
	const headersCheck = { xContentTypeOptions: false, xFrameOptions: false, csp: false };
	const method = def.method || 'GET';

	const requestHeaders: Record<string, string> = {
		'Accept': 'application/json',
		...(hostHeader ? { 'Host': hostHeader } : {}),
	};

	try {
		// Probe 1: Unauthenticated request (Auth check)
		const unauthUrl = `${targetBase}${def.endpoint}`;
		const unauthRes = await fetch(unauthUrl, {
			method,
			headers: {
				...requestHeaders,
				'X-AppSec-Probe': 'auth-check',
				...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
			},
			body: method === 'POST' ? JSON.stringify({}) : undefined,
			signal: AbortSignal.timeout(4000),
		});

		unauthStatus = unauthRes.status;

		// Security Headers Inspection
		headersCheck.xContentTypeOptions = !!unauthRes.headers.get('x-content-type-options');
		headersCheck.xFrameOptions = !!(
			unauthRes.headers.get('x-frame-options') ||
			unauthRes.headers.get('content-security-policy')?.includes('frame-ancestors')
		);
		headersCheck.csp = !!unauthRes.headers.get('content-security-policy');
		hasSecurityHeaders = headersCheck.xContentTypeOptions || headersCheck.xFrameOptions || headersCheck.csp;

		if (def.isPublic) {
			authGuarded = true; // Intentionally public
		} else if (def.expectHoneypot) {
			authGuarded = unauthStatus === 403 || unauthStatus === 404;
		} else if (def.expectedUnauthStatus) {
			const expected = Array.isArray(def.expectedUnauthStatus)
				? def.expectedUnauthStatus
				: [def.expectedUnauthStatus];
			authGuarded = expected.includes(unauthStatus) || unauthStatus === 401 || unauthStatus === 403 || unauthStatus === 404;
		} else {
			authGuarded = unauthStatus === 401 || unauthStatus === 403 || unauthStatus === 404;
		}

		// Probe 2: WAF resilience check (benign probe parameter)
		const wafUrl = `${targetBase}${def.endpoint}${def.endpoint.includes('?') ? '&' : '?'}probe=%3Cscript%3Ealert(1)%3C/script%3E`;
		const wafRes = await fetch(wafUrl, {
			method,
			headers: {
				...requestHeaders,
				'X-AppSec-Probe': 'waf-check',
				...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
			},
			body: method === 'POST' ? JSON.stringify({ probe: '<script>alert(1)</script>' }) : undefined,
			signal: AbortSignal.timeout(4000),
		});
		wafStatus = wafRes.status;
		wafIntercepted = wafStatus === 403;
	} catch {
		// Network or timeout
	}

	const latencyMs = Date.now() - t0;

	let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
	let message = 'Güvenlik kontrolleri başarılı.';

	if (unauthStatus === 0) {
		status = 'WARN';
		message = 'Uç noktaya bağlanılamadı (İç ağ / loopback bağlantı hatası: HTTP 0).';
	} else if (!def.isPublic && unauthStatus === 200 && !authGuarded) {
		status = 'FAIL';
		message = 'Kritik Permission Açığı: Korumalı rota kimliksiz 200 OK döndü!';
	} else if (unauthStatus >= 500 || wafStatus >= 500) {
		status = 'WARN';
		message = `Sunucu hatası tetiklendi (HTTP ${unauthStatus || wafStatus}).`;
	} else if (!authGuarded) {
		status = 'WARN';
		message = `Beklenmeyen status kodu: HTTP ${unauthStatus}.`;
	} else if (wafIntercepted) {
		message = 'WAF kalkanı tarafından başarıyla korundu (HTTP 403).';
	}

	return {
		endpoint: def.endpoint,
		category: def.category,
		isPublicExpected: def.isPublic,
		unauthStatus,
		authGuarded,
		wafIntercepted,
		wafStatus,
		hasSecurityHeaders,
		headers: headersCheck,
		status,
		latencyMs,
		message,
	};
}

/**
 * Executes dynamic security audit against all registered application API routes.
 */
export async function runApiSecurityScan(
	baseUrl: string,
	options: { force?: boolean } = {}
): Promise<AppSecSummary> {
	if (!options.force && appSecCache && Date.now() - appSecCache.timestamp < CACHE_TTL_MS) {
		return appSecCache.data;
	}

	const startTime = Date.now();
	const { targetBase, hostHeader } = await resolveWorkingAuditBase(baseUrl);

	// Execute tests in batches of 6 to avoid connection flooding
	const reports: RouteSecurityReport[] = [];
	for (let i = 0; i < AUDIT_ENDPOINTS.length; i += 6) {
		const batch = AUDIT_ENDPOINTS.slice(i, i + 6);
		const batchResults = await Promise.all(
			batch.map((def) => testSingleEndpoint(targetBase, hostHeader, def))
		);
		reports.push(...batchResults);
	}

	const passed = reports.filter((r) => r.status === 'PASS').length;
	const warned = reports.filter((r) => r.status === 'WARN').length;
	const failed = reports.filter((r) => r.status === 'FAIL').length;
	const totalTested = reports.length;
	const wafActiveCount = reports.filter((r) => r.wafIntercepted).length;

	let score = 100;
	score -= failed * 30;
	score -= warned * 6;
	if (score < 0) score = 0;

	let grade: 'A+' | 'A' | 'B' | 'C' | 'F' = 'A+';
	if (score >= 95) grade = 'A+';
	else if (score >= 85) grade = 'A';
	else if (score >= 70) grade = 'B';
	else if (score >= 50) grade = 'C';
	else grade = 'F';

	const summary: AppSecSummary = {
		totalTested,
		passed,
		warned,
		failed,
		score,
		grade,
		wafActiveCount,
		durationMs: Date.now() - startTime,
		timestamp: Date.now(),
		routes: reports,
	};

	if (failed > 0) {
		void logSystemEvent({
			servis: 'security',
			seviye: 'ERROR',
			mesaj: `[AppSec Zafiyet Uyarısı] API taramasında ${failed} kritik permission sızıntısı tespit edildi!`,
			detay: {
				failedRoutes: reports.filter((r) => r.status === 'FAIL').map((r) => r.endpoint),
			},
		});
	}

	appSecCache = { timestamp: Date.now(), data: summary };
	return summary;
}

/**
 * Probes a single endpoint on-demand for live security inspection.
 */
export async function probeSingleRoute(
	baseUrl: string,
	endpoint: string
): Promise<RouteSecurityReport> {
	const { targetBase, hostHeader } = await resolveWorkingAuditBase(baseUrl);
	const found = AUDIT_ENDPOINTS.find((e) => e.endpoint === endpoint) || {
		endpoint,
		category: 'core' as const,
		isPublic: false,
		method: 'GET' as const,
	};
	return testSingleEndpoint(targetBase, hostHeader, found);
}

/**
 * Generates an executive-ready Cybersecurity & AppSec Audit Report in Markdown format.
 */
export async function generateExecutiveAuditReport(baseUrl: string): Promise<string> {
	const appSec = await runApiSecurityScan(baseUrl, { force: true });
	const now = new Date().toISOString();
	let md = `# Orbit Security Operations Center — Executive Security Audit Report\n\n`;
	md += `**Generated At:** ${now}\n`;
	md += `**Overall Security Grade:** ${appSec.grade} (Score: ${appSec.score}/100)\n`;
	md += `**Total Audited Routes:** ${appSec.totalTested}\n`;
	md += `**Secure (PASS):** ${appSec.passed} | **Warning (WARN):** ${appSec.warned} | **Vulnerable (FAIL):** ${appSec.failed}\n`;
	md += `**Active WAF Shield:** ${appSec.wafActiveCount}/${appSec.totalTested} routes protected by WAF during adversarial probe\n\n`;
	md += `## Endpoint Security Posture\n\n`;
	md += `| Route | Category | Status | Unauth HTTP | WAF Shield | Security Headers | Latency |\n`;
	md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: |\n`;
	for (const r of appSec.routes) {
		const statusIcon = r.status === 'PASS' ? '✅ PASS' : r.status === 'WARN' ? '⚠️ WARN' : '❌ FAIL';
		const wafIcon = r.wafIntercepted ? '🛡️ Active (403)' : '⚪ Passthrough';
		const headersIcon = r.hasSecurityHeaders ? '🔒 Present' : '⚪ None';
		md += `| \`${r.endpoint}\` | ${r.category} | ${statusIcon} | ${r.unauthStatus} | ${wafIcon} | ${headersIcon} | ${r.latencyMs}ms |\n`;
	}
	md += `\n---\n*This report was generated autonomously by Orbit Security Operations Center (SoC).*\n`;
	return md;
}

const fimWatcherState = globalThis as { __fimBackgroundWatcher?: boolean };

const fimAlertedFiles = new Set<string>();

/**
 * Periodically monitors sensitive runtime directories (`data/uploads/` and `/tmp/`)
 * for unauthorized webshells or binaries using the Go FIM scanner.
 * Disabled by default to avoid unneeded CPU/disk I/O and logs unless ENABLE_BACKGROUND_FIM=1.
 */
export function scheduleBackgroundFimCheck(intervalMs = 30 * 60_000): void {
	if (fimWatcherState.__fimBackgroundWatcher) return;
	if (process.env.ENABLE_BACKGROUND_FIM !== '1') return;
	fimWatcherState.__fimBackgroundWatcher = true;

	const runCheck = async () => {
		try {
			const targets = ['uploads', 'tmp'];
			for (const target of targets) {
				const result = await runFimScan(target, { force: true });
				const criticalFiles = (result.suspiciousFiles || []).filter(
					(f) => f.severity === 'CRITICAL'
				);
				if (criticalFiles.length > 0) {
					const newCritical = criticalFiles.filter(
						(f) => !fimAlertedFiles.has(`${target}:${f.path}:${f.matchedRule}`)
					);
					for (const file of newCritical) {
						fimAlertedFiles.add(`${target}:${file.path}:${file.matchedRule}`);
						await logSystemEvent({
							servis: 'security',
							seviye: 'CRITICAL',
							mesaj: `🚨 [FIM CRITICAL ALARM] Dizin nöbetçisi tarafından şüpheli dosya veya webshell tespit edildi (${target}): ${file.path} (${file.matchedRule})`,
							detay: { target, file },
							ip: '127.0.0.1',
						});
					}
					if (newCritical.length > 0) {
						void recordSecurityStrike({
							ip: '127.0.0.1',
							points: 100,
							reason: `FIM CRITICAL: ${newCritical.length} şüpheli dosya/webshell (${target})`,
							path: `/fim/${target}`,
						});
					}
				} else {
					// Clean up cached alerts for this target if files were remediated
					for (const key of Array.from(fimAlertedFiles)) {
						if (key.startsWith(`${target}:`)) {
							fimAlertedFiles.delete(key);
						}
					}
				}
			}
		} catch (err) {
			console.error('[FIM Background Watcher] Tarama hatası:', err);
		}
	};

	setTimeout(runCheck, 10_000).unref?.();
	setInterval(runCheck, intervalMs).unref?.();
}

// Auto-start background watcher in server environments
if (typeof window === 'undefined') {
	scheduleBackgroundFimCheck();
}

export interface FimDiffResult {
	path: string;
	status: 'modified' | 'added' | 'deleted' | 'unchanged' | 'not_found';
	originalContent: string;
	currentContent: string;
	diff: string;
	error?: string;
}

export async function getFimFileDiff(targetFilePath: string): Promise<FimDiffResult> {
	try {
		const rawPath = String(targetFilePath || '').trim();
		const resolved = resolve(/*turbopackIgnore: true*/ ROOT_DIR, rawPath.startsWith('/') ? rawPath.slice(1) : rawPath);
		if (!resolved.startsWith(ROOT_DIR)) {
			return {
				path: rawPath,
				status: 'not_found',
				originalContent: '',
				currentContent: '',
				diff: '',
				error: 'Dosya yolu çalışma alanı sınırları dışındadır.',
			};
		}

		const relPath = resolved.slice(ROOT_DIR.length + 1).replace(/\\/g, '/');

		let originalContent = '';
		let hasGitBaseline = false;
		try {
			const gitShow = execFileSync('git', ['show', `HEAD:${relPath}`], {
				cwd: ROOT_DIR,
				encoding: 'utf-8',
				maxBuffer: 2 * 1024 * 1024,
				stdio: ['ignore', 'pipe', 'ignore'],
			});
			originalContent = gitShow;
			hasGitBaseline = true;
		} catch {
			originalContent = '';
			hasGitBaseline = false;
		}

		let currentContent = '';
		let fileExistsOnDisk = false;
		if (existsSync(resolved)) {
			try {
				const buf = readFileSync(resolved);
				if (buf.length < 2 * 1024 * 1024) {
					currentContent = buf.toString('utf-8');
					fileExistsOnDisk = true;
				} else {
					currentContent = '[Dosya boyutu diff önizleme sınırı olan 2MB üzerindedir]';
					fileExistsOnDisk = true;
				}
			} catch {
				fileExistsOnDisk = false;
			}
		}

		let diff = '';
		try {
			if (hasGitBaseline) {
				const gitDiff = execFileSync('git', ['diff', 'HEAD', '--', relPath], {
					cwd: ROOT_DIR,
					encoding: 'utf-8',
					maxBuffer: 2 * 1024 * 1024,
					stdio: ['ignore', 'pipe', 'ignore'],
				});
				diff = gitDiff;
			}
		} catch {
			// ignore git diff failure
		}

		let status: FimDiffResult['status'] = 'unchanged';
		if (!hasGitBaseline && fileExistsOnDisk) {
			status = 'added';
			if (!diff) {
				diff = currentContent
					.split('\n')
					.slice(0, 500)
					.map((line) => `+ ${line}`)
					.join('\n');
			}
		} else if (hasGitBaseline && !fileExistsOnDisk) {
			status = 'deleted';
			if (!diff) {
				diff = originalContent
					.split('\n')
					.slice(0, 500)
					.map((line) => `- ${line}`)
					.join('\n');
			}
		} else if (hasGitBaseline && fileExistsOnDisk) {
			status = originalContent === currentContent ? 'unchanged' : 'modified';
		} else {
			status = 'not_found';
		}

		return {
			path: relPath,
			status,
			originalContent: originalContent.slice(0, 100_000),
			currentContent: currentContent.slice(0, 100_000),
			diff: diff.slice(0, 100_000),
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return {
			path: targetFilePath,
			status: 'not_found',
			originalContent: '',
			currentContent: '',
			diff: '',
			error: msg,
		};
	}
}

