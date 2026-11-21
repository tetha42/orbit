// Orbit Community OS — Atomic File Length Validator
// Enforces single-responsibility architecture across ALL of src/ (<= 250 lines,
// <= 180 chars/line, zero legacy ceilings) and a separate ratcheted <= 400-line
// constitution across scripts/*.mjs and services/security-guard/*.go.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src');
const CEILINGS_PATH = path.join(ROOT, 'scripts', 'file-length-ceilings.json');
const NON_SRC_CEILINGS_PATH = path.join(ROOT, 'scripts', 'non-src-length-ceilings.json');
const MAX_LINES = 250;
const MAX_LINE_CHARS = 180;
const NON_SRC_MAX_LINES = 400;
const argv = process.argv.slice(2);

function resolveScopedSet() {
	let hasFilesFlag = false;
	const raw = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith('--files=')) {
			hasFilesFlag = true;
			raw.push(...a.slice('--files='.length).split(','));
		} else if (a === '--files') {
			hasFilesFlag = true;
			if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) raw.push(...argv[++i].split(','));
		}
	}
	const stagedMode = argv.includes('--staged');
	if (!hasFilesFlag && !stagedMode) return null;

	if (stagedMode) {
		const out = execSync('git diff --cached --name-only --diff-filter=ACMR', { cwd: ROOT, encoding: 'utf8' });
		raw.push(...out.split(/\r?\n/));
	}
	const set = new Set();
	for (const entry of raw) {
		const trimmed = entry.trim().replace(/\\/g, '/');
		if (!trimmed) continue;
		const resolved = path.resolve(ROOT, trimmed);
		const rel = path.relative(ROOT, resolved).replace(/\\/g, '/');
		if (rel && !rel.startsWith('..') && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
			set.add(rel);
		}
	}
	return set;
}

function loadCeilingsObject(filePath) {
	if (!fs.existsSync(filePath)) return {};
	const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(`${path.relative(ROOT, filePath)} must be a JSON object`);
	}
	return parsed;
}

function walkMatchingFiles(dir, matchExt, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walkMatchingFiles(fullPath, matchExt, out);
		} else if (entry.isFile() && matchExt(entry.name)) {
			out.push(fullPath);
		}
	}
	return out.sort();
}

function countLineWidthViolations(rawLines, rel) {
	let count = 0;
	for (let i = 0; i < rawLines.length; i++) {
		const width = rawLines[i].length;
		if (width > MAX_LINE_CHARS) {
			console.error(
				`check-file-lengths: ${rel}:${i + 1} is ${width} chars (exceeds horizontal limit of ${MAX_LINE_CHARS})`
			);
			count++;
		}
	}
	return count;
}

const legacyCeilings = loadCeilingsObject(CEILINGS_PATH);
const nonSrcCeilings = loadCeilingsObject(NON_SRC_CEILINGS_PATH);

const scopedSet = resolveScopedSet();
const srcExt = (name) =>
	name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.js') || name.endsWith('.mjs');
const allFiles = walkMatchingFiles(SRC_DIR, srcExt).filter(
	(f) => !scopedSet || scopedSet.has(path.relative(ROOT, f).replace(/\\/g, '/'))
);
const cssFiles = walkMatchingFiles(SRC_DIR, (name) => name.endsWith('.css')).filter(
	(f) => !scopedSet || scopedSet.has(path.relative(ROOT, f).replace(/\\/g, '/'))
);

let violations = 0;
let wideViolations = 0;
let cssWidthViolations = 0;
let legacyCount = 0;

if (Object.keys(legacyCeilings).length > 0) {
	console.error(
		`check-file-lengths: scripts/file-length-ceilings.json must remain empty ({}), found ${Object.keys(legacyCeilings).length} entry(s)`
	);
	violations += Object.keys(legacyCeilings).length;
}

for (const file of allFiles) {
	const content = fs.readFileSync(file, 'utf8');
	const rawLines = content.split('\n');
	const lines = rawLines.length;
	const rel = path.relative(ROOT, file).replace(/\\/g, '/');

	wideViolations += countLineWidthViolations(rawLines, rel);

	if (lines > MAX_LINES) {
		const ceiling = legacyCeilings[rel];
		if (typeof ceiling !== 'number') {
			console.error(`check-file-lengths: ${rel} has ${lines} lines (exceeds hard cap of ${MAX_LINES})`);
			violations++;
		} else if (lines > ceiling) {
			console.error(
				`check-file-lengths: ${rel} grew to ${lines} lines (exceeds legacy ceiling of ${ceiling})`
			);
			violations++;
		} else {
			legacyCount++;
		}
	}
}

for (const file of cssFiles) {
	const rawLines = fs.readFileSync(file, 'utf8').split('\n');
	const rel = path.relative(ROOT, file).replace(/\\/g, '/');
	cssWidthViolations += countLineWidthViolations(rawLines, rel);
}

const allNonSrcFiles = [
	...walkMatchingFiles(path.join(ROOT, 'scripts'), (n) => n.endsWith('.mjs')),
	...walkMatchingFiles(path.join(ROOT, 'services', 'security-guard'), (n) => n.endsWith('.go')),
];
const nonSrcRelSet = new Set(allNonSrcFiles.map((f) => path.relative(ROOT, f).replace(/\\/g, '/')));
const nonSrcFiles = scopedSet
	? allNonSrcFiles.filter((f) => scopedSet.has(path.relative(ROOT, f).replace(/\\/g, '/')))
	: allNonSrcFiles;

let nonSrcViolations = 0;
let nonSrcLegacyCount = 0;

for (const [rel, ceiling] of Object.entries(nonSrcCeilings)) {
	if (!nonSrcRelSet.has(rel)) {
		console.error(`check-file-lengths: non-src ceiling entry '${rel}' does not match any scanned file`);
		nonSrcViolations++;
	} else if (typeof ceiling !== 'number' || !Number.isInteger(ceiling) || ceiling <= NON_SRC_MAX_LINES) {
		console.error(
			`check-file-lengths: non-src ceiling for '${rel}' must be an integer > ${NON_SRC_MAX_LINES}, got ${ceiling}`
		);
		nonSrcViolations++;
	}
}

for (const file of nonSrcFiles) {
	const lines = fs.readFileSync(file, 'utf8').split('\n').length;
	const rel = path.relative(ROOT, file).replace(/\\/g, '/');
	if (lines > NON_SRC_MAX_LINES) {
		const ceiling = nonSrcCeilings[rel];
		if (typeof ceiling !== 'number' || !Number.isFinite(ceiling)) {
			console.error(
				`check-file-lengths: ${rel} has ${lines} lines (exceeds non-src cap of ${NON_SRC_MAX_LINES})`
			);
			nonSrcViolations++;
		} else if (lines > ceiling) {
			console.error(
				`check-file-lengths: ${rel} grew to ${lines} lines (exceeds non-src ceiling of ${ceiling})`
			);
			nonSrcViolations++;
		} else {
			nonSrcLegacyCount++;
		}
	}
}

if (violations > 0 || wideViolations > 0 || cssWidthViolations > 0 || nonSrcViolations > 0) {
	console.error(
		`\ncheck-file-lengths: ${violations} src length, ${wideViolations} line-width, ` +
			`${cssWidthViolations} css line-width, and ${nonSrcViolations} non-src length violation(s) found.`
	);
	process.exit(1);
}

console.log(
	`check-file-lengths: ${allFiles.length} src/ files (${allFiles.length - legacyCount} <= ${MAX_LINES} lines, ` +
		`all lines <= ${MAX_LINE_CHARS} chars, ${legacyCount} legacy); ${cssFiles.length} css files ` +
		`(all lines <= ${MAX_LINE_CHARS} chars); ${nonSrcFiles.length} guard/service files ` +
		`(${nonSrcFiles.length - nonSrcLegacyCount} <= ${NON_SRC_MAX_LINES} lines, ${nonSrcLegacyCount} ratcheted)`
);
