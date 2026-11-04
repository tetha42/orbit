// Identifier purity: no Turkish words in variable, parameter, property, function,
// type or member names under src/. Walks the TypeScript AST (not text), so strings,
// comments and i18n copy are ignored.
//
//   node scripts/check-identifiers.mjs                  verify
//   node scripts/check-identifiers.mjs --update-baseline  re-record what is still tolerated
//
// Two tiers:
//   BANNED   names cleaned out for good (oda/kasa/lider/takim/kullanici + Id, *Kurus, audit islem/hedef*/yapan*).
//            Any use fails, the baseline cannot hide it.
//   LEGACY   Turkish words still present in older code. New uses fail; existing ones are listed in
//            scripts/identifier-baseline.json, which may only shrink (--update-baseline refuses to grow it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src');
const BASELINE_FILE = path.join(ROOT, 'scripts', 'identifier-baseline.json');

// Names purged for good: any use fails and the baseline cannot hide it.
const BANNED_NAME = [
	/^(oda|kasa|lider|takim|kullanici)Ids?$/i,
	/^(set|get)?(Oda|Kasa|Lider|Takim|Kullanici)Ids?$/,
	/[a-z]Kurus$/,
	/^(islem|hedefTur|hedefId|hedefAd|yapanId|yapanAd)$/,
];

// Turkish words still present in older code. New identifiers containing them fail;
// the ones that exist today are tolerated through the baseline.
const LEGACY = new Set([
	'oda', 'kasa', 'lider', 'takim', 'kullanici', 'tutar', 'kurus', 'islem', 'hedef', 'yapan',
	'onceki', 'sonraki', 'zaman', 'konu', 'gonderen',
	'mesaj', 'uye', 'rol', 'roller', 'eposta', 'durum', 'aciklama', 'kategori', 'baslik',
	'gorev', 'etkinlik', 'kayit', 'kayitlar', 'sifre', 'bolum', 'sinif', 'tur', 'tarih',
	'icerik', 'ekler', 'anket', 'secenek', 'bakiye', 'gelir', 'gider', 'takimlar', 'odalar',
	'kasalar', 'uyeler', 'sayfa', 'boyut', 'kisi', 'ayar', 'basvuru', 'yetki', 'izin',
	'izinler', 'sistem', 'renk', 'fark', 'atlananlar', 'neden', 'tehdit', 'puani', 'karsi',
	'toplam', 'sil', 'ata', 'aktif', 'mezun', 'yonet', 'olustur', 'duzenle',
]);

const SKIP_FILE = /(^|\/)(i18n[A-Za-z]*|translations)\.ts$|\.gen\.ts$/;
const NON_ASCII_LETTER = /[çğıöşüÇĞİÖŞÜ]/;

const fold = (s) => s.toLowerCase();
function words(name) {
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.split(/[\s_$-]+/)
		.filter(Boolean)
		.map(fold);
}

function walk(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full, out);
		else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full);
	}
	return out;
}

function declaredNames(sf) {
	const names = [];
	const add = (id, prop = false) => {
		if (id && (ts.isIdentifier(id) || ts.isPrivateIdentifier(id))) names.push({ name: id.text, prop });
	};
	const addBinding = (b) => {
		if (!b) return;
		if (ts.isIdentifier(b)) add(b);
		else if (ts.isObjectBindingPattern(b) || ts.isArrayBindingPattern(b)) {
			for (const el of b.elements) {
				if (ts.isBindingElement(el)) {
					// `{ a: b }` — the property side is somebody else's name; only the local binding is ours.
					addBinding(el.name);
				}
			}
		}
	};
	const visit = (node) => {
		if (ts.isVariableDeclaration(node) || ts.isParameter(node)) addBinding(node.name);
		else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)
			|| ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) add(node.name);
		else if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node)
			|| ts.isMethodSignature(node) || ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)
			|| ts.isGetAccessor(node) || ts.isSetAccessor(node) || ts.isEnumMember(node)) {
			if (node.name && (ts.isIdentifier(node.name) || ts.isPrivateIdentifier(node.name))) add(node.name, true);
		}
		ts.forEachChild(node, visit);
	};
	visit(sf);
	return names;
}

function scan() {
	const found = {};
	const banned = [];
	for (const file of walk(SRC_DIR)) {
		const rel = path.relative(ROOT, file).replace(/\\/g, '/');
		if (SKIP_FILE.test(rel)) continue;
		const text = fs.readFileSync(file, 'utf8');
		const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
		const legacy = new Set();
		const seen = new Set();
		for (const { name, prop } of declaredNames(sf)) {
			if (seen.has(name + prop)) continue;
			seen.add(name + prop);
			const ws = words(name);
			if (BANNED_NAME.some((re) => re.test(name)) || (NON_ASCII_LETTER.test(name) && !prop)) {
				banned.push(`${rel}: '${name}'`);
			} else if (ws.some((w) => LEGACY.has(w))) legacy.add(name);
		}
		if (legacy.size) found[rel] = [...legacy].sort();
	}
	return { found, banned };
}

const { found, banned } = scan();
const update = process.argv.includes('--update-baseline');
const baseline = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : {};

const fresh = [];
for (const [file, names] of Object.entries(found)) {
	const known = new Set(baseline[file] ?? []);
	for (const n of names) if (!known.has(n)) fresh.push(`${file}: '${n}'`);
}

if (update) {
	if (banned.length) {
		console.error('check-identifiers: refusing to update the baseline while banned names exist:');
		for (const v of banned) console.error(`  - ${v}`);
		process.exit(1);
	}
	const sorted = Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b)));
	const grew = fresh.length > 0 && Object.keys(baseline).length > 0 && !process.argv.includes('--allow-growth');
	if (grew) {
		console.error('check-identifiers: the baseline may only shrink; these are new:');
		for (const v of fresh) console.error(`  - ${v}`);
		process.exit(1);
	}
	fs.writeFileSync(BASELINE_FILE, JSON.stringify(sorted, null, '\t') + '\n');
	console.log(`check-identifiers: baseline written (${Object.values(sorted).flat().length} legacy names in ${Object.keys(sorted).length} files)`);
	process.exit(0);
}

let failed = false;
if (banned.length) {
	console.error('check-identifiers: Turkish identifiers are not allowed (use English: roomId, vaultId, leadId, teamId, userId, amountMinor, action, targetType/targetId/targetName, actorId/actorName):');
	for (const v of banned) console.error(`  - ${v}`);
	failed = true;
}
if (fresh.length) {
	console.error('check-identifiers: new legacy-Turkish identifiers (name things in English, do not add to the baseline):');
	for (const v of fresh) console.error(`  - ${v}`);
	failed = true;
}
if (failed) process.exit(1);

const tolerated = Object.values(found).flat().length;
console.log(`check-identifiers: 0 banned names; ${tolerated} legacy names tolerated by the baseline (shrink only)`);
