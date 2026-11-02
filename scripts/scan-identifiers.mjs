#!/usr/bin/env node
/**
 * Orbit Community OS — Identifier Discovery Scanner
 * Scans TypeScript and JavaScript source files for Turkish identifier stems
 * and outputs candidate definitions into tools/rename-map.json
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const DEFAULT_TARGETS = ['src/db', 'src/db/repositories', 'src/types'];
const OUTPUT_FILE = path.join(ROOT_DIR, 'tools', 'rename-map.json');

const EXCLUDED_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'tools/bin']);
const EXCLUDED_FILES = new Set([
	'i18n.ts',
	'i18nExtra.ts',
	'translations.ts',
	'check-i18n.mjs',
	'baseline.json',
]);

const TURKISH_STEMS = [
	'kullanici', 'uye', 'etkinlik', 'takim', 'gorev', 'butce', 'tutanak',
	'sertifika', 'envanter', 'haber', 'notlar', 'sistem', 'ayarlar', 'ayari',
	'rol', 'yetki', 'denetim', 'posta', 'sohbet', 'olaylar', 'olay', 'yoklama',
	'kayit', 'onay', 'durum', 'sifre', 'eposta', 'bolum', 'sinif', 'kasa',
	'proje', 'engel', 'odunc', 'duyuru', 'basvuru', 'lider', 'atanan',
	'sorumlu', 'teslim', 'yayin', 'bilet', 'anket', 'katilim', 'imza',
	'tarih', 'baslangic', 'bitis', 'tutar', 'karar', 'aciklama', 'baslik',
	'icerik', 'kurulum', 'dogrula', 'ogrenci', 'mezun', 'baskan', 'yonetim'
];

const STEM_REGEX = new RegExp(`(${TURKISH_STEMS.join('|')})`, 'i');

function isExcluded(filePath) {
	const rel = path.relative(ROOT_DIR, filePath);
	for (const part of rel.split(path.sep)) {
		if (EXCLUDED_DIRS.has(part)) return true;
	}
	const base = path.basename(filePath);
	if (EXCLUDED_FILES.has(base)) return true;
	return false;
}

function collectFiles(dir, fileList = []) {
	if (!fs.existsSync(dir)) return fileList;
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (isExcluded(fullPath)) continue;
		if (entry.isDirectory()) {
			collectFiles(fullPath, fileList);
		} else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
			fileList.push(fullPath);
		}
	}
	return fileList;
}

function scanFile(filePath, foundMap) {
	const content = fs.readFileSync(filePath, 'utf8');
	const relPath = path.relative(ROOT_DIR, filePath);

	// Patterns:
	// 1. export function / function
	const fnRegex = /(?:export\s+(?:async\s+)?)?function\s+([a-zA-Z0-9_$]+)/g;
	// 2. export const / const arrow function or variable
	const constRegex = /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*[:=]/g;
	// 3. interface / type
	const typeRegex = /(?:export\s+)?(?:interface|type)\s+([a-zA-Z0-9_$]+)/g;

	let match;
	while ((match = fnRegex.exec(content)) !== null) {
		const id = match[1];
		if (STEM_REGEX.test(id) && id.length > 2) {
			addIdentifier(foundMap, id, 'function', relPath);
		}
	}

	while ((match = typeRegex.exec(content)) !== null) {
		const id = match[1];
		if (STEM_REGEX.test(id) && id.length > 2) {
			addIdentifier(foundMap, id, 'type', relPath);
		}
	}

	while ((match = constRegex.exec(content)) !== null) {
		const id = match[1];
		if (STEM_REGEX.test(id) && id.length > 2) {
			addIdentifier(foundMap, id, 'variable', relPath);
		}
	}
}

function addIdentifier(foundMap, id, type, relPath) {
	if (!foundMap.has(id)) {
		foundMap.set(id, {
			oldName: id,
			type,
			files: new Set(),
			newName: '',
		});
	}
	foundMap.get(id).files.add(relPath);
}

function main() {
	const args = process.argv.slice(2);
	const targetDirs = args.length > 0 ? args : DEFAULT_TARGETS;

	console.log(`[Scanner] Scanning directories: ${targetDirs.join(', ')}...`);
	const foundMap = new Map();

	for (const target of targetDirs) {
		const fullTarget = path.resolve(ROOT_DIR, target);
		const files = collectFiles(fullTarget);
		for (const file of files) {
			scanFile(file, foundMap);
		}
	}

	// Read existing rename-map.json to preserve already mapped new names
	let existingMap = {};
	if (fs.existsSync(OUTPUT_FILE)) {
		try {
			const raw = fs.readFileSync(OUTPUT_FILE, 'utf8');
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed.definitions)) {
				for (const def of parsed.definitions) {
					if (def.oldName && def.newName) {
						existingMap[def.oldName] = def.newName;
					}
				}
			}
		} catch {}
	}

	const definitions = Array.from(foundMap.values())
		.map((item) => ({
			oldName: item.oldName,
			type: item.type,
			files: Array.from(item.files).sort(),
			newName: existingMap[item.oldName] || '',
		}))
		.sort((a, b) => a.oldName.localeCompare(b.oldName));

	fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
	fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ definitions }, null, 2) + '\n', 'utf8');

	console.log(`[Scanner] Completed! Found ${definitions.length} Turkish identifiers.`);
	console.log(`[Scanner] Output written to: ${path.relative(ROOT_DIR, OUTPUT_FILE)}`);
}

main();
