#!/usr/bin/env node
/**
 * Orbit Community OS — Automated Identifier Refactor Replacer
 * Reads tools/rename-map.json and applies token word-boundary replacements
 * across source files.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const DEFAULT_MAP_FILE = path.join(ROOT_DIR, 'tools', 'rename-map.json');

const EXCLUDED_DIRS = new Set([
	'node_modules',
	'.next',
	'.git',
	'dist',
	'build',
	'tools/bin',
	'tools/fim',
	'public',
]);

const EXCLUDED_FILES = new Set([
	'package.json',
	'package-lock.json',
	'pnpm-lock.yaml',
	'baseline.json',
	'i18n.ts',
	'i18nExtra.ts',
	'translations.ts',
	'check-i18n.mjs',
	'rename-map.json',
	'refactor-rename.mjs',
	'scan-identifiers.mjs',
	'build-mappings.mjs',
]);

function escapeRegex(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isExcluded(filePath) {
	const rel = path.relative(ROOT_DIR, filePath);
	for (const part of rel.split(path.sep)) {
		if (EXCLUDED_DIRS.has(part)) return true;
	}
	const base = path.basename(filePath);
	if (EXCLUDED_FILES.has(base)) return true;
	return false;
}

function collectSourceFiles(dir, fileList = []) {
	if (!fs.existsSync(dir)) return fileList;
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (isExcluded(fullPath)) continue;
		if (entry.isDirectory()) {
			collectSourceFiles(fullPath, fileList);
		} else if (/\.(ts|tsx|js|mjs|sql)$/.test(entry.name)) {
			fileList.push(fullPath);
		}
	}
	return fileList;
}

function main() {
	const args = process.argv.slice(2);
	const isDryRun = args.includes('--dry-run');
	const mapArgIdx = args.indexOf('--map');
	const mapFile = mapArgIdx !== -1 && args[mapArgIdx + 1] ? path.resolve(ROOT_DIR, args[mapArgIdx + 1]) : DEFAULT_MAP_FILE;

	const targetArgIdx = args.indexOf('--target');
	const targets = targetArgIdx !== -1 && args[targetArgIdx + 1]
		? args[targetArgIdx + 1].split(',').map((p) => path.resolve(ROOT_DIR, p.trim()))
		: [path.join(ROOT_DIR, 'src'), path.join(ROOT_DIR, 'scripts')];

	if (!fs.existsSync(mapFile)) {
		console.error(`[Replacer] Map file not found: ${mapFile}`);
		process.exit(1);
	}

	const mapContent = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
	const definitions = mapContent.definitions || [];

	const validReplacements = definitions.filter(
		(d) => d.oldName && d.newName && d.oldName !== d.newName
	);

	if (validReplacements.length === 0) {
		console.log('[Replacer] No active replacements found in rename map (all newName fields are empty).');
		return;
	}

	// Sort by oldName length descending to avoid prefix collision (e.g. getKullaniciById before getKullanici)
	validReplacements.sort((a, b) => b.oldName.length - a.oldName.length);

	console.log(`[Replacer] Active replacements loaded: ${validReplacements.length}`);
	if (isDryRun) console.log('[Replacer] DRY-RUN MODE: No files will be written to disk.');

	// Pre-compile regexes
	const compiled = validReplacements.map((r) => ({
		oldName: r.oldName,
		newName: r.newName,
		regex: new RegExp(`\\b${escapeRegex(r.oldName)}\\b`, 'g'),
	}));

	let totalFilesScanned = 0;
	let totalFilesChanged = 0;
	let totalReplacements = 0;

	for (const targetDir of targets) {
		const files = collectSourceFiles(targetDir);
		for (const file of files) {
			totalFilesScanned++;
			const original = fs.readFileSync(file, 'utf8');
			let modified = original;
			let fileReplacementCount = 0;

			for (const item of compiled) {
				const matches = modified.match(item.regex);
				if (matches) {
					fileReplacementCount += matches.length;
					modified = modified.replace(item.regex, item.newName);
				}
			}

			if (modified !== original) {
				totalFilesChanged++;
				totalReplacements += fileReplacementCount;
				const relPath = path.relative(ROOT_DIR, file);
				console.log(`  [UPDATE] ${relPath} (${fileReplacementCount} replacements)`);
				if (!isDryRun) {
					fs.writeFileSync(file, modified, 'utf8');
				}
			}
		}
	}

	console.log('\n========================================');
	console.log(`[Replacer] Scanned: ${totalFilesScanned} files`);
	console.log(`[Replacer] Modified: ${totalFilesChanged} files`);
	console.log(`[Replacer] Total tokens replaced: ${totalReplacements}`);
	console.log('========================================\n');
}

main();
