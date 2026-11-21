// Enforces centralized design-token discipline across all CSS modules and UI components.
// Usage: node scripts/check-tokens.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(process.cwd(), 'src');

const UI_EXEMPT_PREFIXES = [
	'src/core/theme/',
	'src/lib/i18n/',
	'src/lib/mail/',
	'src/server/security/webhook/',
	'src/db/roles/',
	'src/components/Common/appIcons/',
];

const UI_EXEMPT_FILES = new Set([
	'src/app/global-error.tsx',
	'src/app/api/settings/smtp/test/route.ts',
	'src/core/permissions/index.ts',
	'src/apps/teams/types.ts',
	'src/apps/notes/types.ts',
	'src/apps/terminal/components/themes.ts',
	'src/lib/certificates.ts',
	'src/lib/client/activityReport.ts',
]);

const UI_EXEMPT_BASENAMES = new Set([
	'manifest.ts',
	'icon.tsx',
	'apple-icon.tsx',
	'opengraph-image.tsx',
]);

const SEMANTIC_UI_HEX_RE =
	/#(?:ff9500|ff2d55|ff453a|ff3b30|d70015|c4423a|ef4444|f87171|fca5a5|ff6961|30d158|34c759|248a3d|1f9d55|34d399|4ade80|10b981|22c55e|ff9f0a|ffb340|c45500|c76a00|fbbf24|f59e0b|f97316|eab308|0a84ff|007aff|0a6cdc|3b82f6|60a5fa|bf5af2|5e5ce6|5856d6|38bdf8|8e8cff)\b/gi;

function walkFiles(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			walkFiles(fullPath, out);
		} else if (
			entry.endsWith('.module.css') ||
			entry.endsWith('.tsx') ||
			entry.endsWith('.ts')
		) {
			out.push(fullPath);
		}
	}
	return out.sort();
}

function stripComments(text, isCss) {
	if (isCss) {
		return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
	}
	return text
		.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/^\s*\/\/.*$/gm, '');
}

function findNonGrayscaleColorFn(line) {
	for (const match of line.matchAll(/\b(?:rgba?|hsla?)\(([^)]+)\)/gi)) {
		const inner = match[1].trim();
		if (/var\(--|\$\{/.test(inner)) continue;
		const parts = inner.split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
		if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) {
			return match[0];
		}
		const isGray = parts[0] === parts[1] && parts[1] === parts[2];
		if (!isGray) return match[0];
	}
	return null;
}

function isExemptUiFile(relPath) {
	const base = relPath.split('/').pop() || '';
	if (UI_EXEMPT_BASENAMES.has(base)) return true;
	if (UI_EXEMPT_FILES.has(relPath)) return true;
	return UI_EXEMPT_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

const files = walkFiles(SRC_DIR);
const violations = [];
let cssCount = 0;
let uiCount = 0;

for (const file of files) {
	const relPath = relative(process.cwd(), file).replace(/\\/g, '/');
	const isCss = relPath.endsWith('.module.css');

	if (isCss) {
		cssCount++;
		const lines = stripComments(readFileSync(file, 'utf8'), true).split('\n');
		lines.forEach((line, idx) => {
			const hexMatch = line.match(/#[0-9a-fA-F]{3,8}\b/);
			if (hexMatch) {
				violations.push({
					file: relPath,
					line: idx + 1,
					text: line.trim(),
					reason: `raw hex literal (${hexMatch[0]}) in CSS module; use var(--token)`,
				});
			}
			const rgbHit = findNonGrayscaleColorFn(line);
			if (rgbHit) {
				violations.push({
					file: relPath,
					line: idx + 1,
					text: line.trim(),
					reason: `raw colored ${rgbHit} in CSS module; use color-mix(in srgb, var(--token) ...)`,
				});
			}
		});
		continue;
	}

	if (isExemptUiFile(relPath)) continue;
	uiCount++;

	const lines = stripComments(readFileSync(file, 'utf8'), false).split('\n');
	lines.forEach((line, idx) => {
		SEMANTIC_UI_HEX_RE.lastIndex = 0;
		const semHex = SEMANTIC_UI_HEX_RE.exec(line);
		if (semHex) {
			violations.push({
				file: relPath,
				line: idx + 1,
				text: line.trim(),
				reason: `hardcoded UI semantic/accent hex (${semHex[0]}); use var(--token)`,
			});
		}
		const rgbHit = findNonGrayscaleColorFn(line);
		if (rgbHit) {
			violations.push({
				file: relPath,
				line: idx + 1,
				text: line.trim(),
				reason: `hardcoded UI colored ${rgbHit}; use color-mix(in srgb, var(--token) ...)`,
			});
		}
	});
}

if (violations.length > 0) {
	console.error(`Check Tokens Failed (${violations.length} violations):\n`);
	for (const v of violations.slice(0, 60)) {
		console.error(`  ${v.file}:${v.line} — ${v.reason}`);
		console.error(`    ${v.text}\n`);
	}
	process.exit(1);
} else {
	console.log(`check-tokens: ${cssCount} CSS modules + ${uiCount} UI TS/TSX files scanned, 0 token violations`);
}
