// Single-pass AST verification engine across src/:
// parses each file once with ts.createSourceFile and runs i18n, identifier,
// route audit-coverage, and empty-catch checks in a single AST pass.
//
//   node --no-warnings scripts/verify-ast.mjs [--json]
//
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { checkAuditCoverageFromCache } from './lib/ast-audit.mjs';
import { createEmptyCatchChecker } from './lib/ast-empty-catch.mjs';
import { createI18nChecker } from './lib/ast-i18n.mjs';
import { createIdentifierChecker } from './lib/ast-identifiers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src');
const SOURCE_EXT_RE = /\.(?:ts|tsx|js|mjs)$/;
const argv = process.argv.slice(2);
const jsonMode = argv.includes('--json');

function resolveScopedRelPaths() {
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
	const outSet = new Set();
	for (const entry of raw) {
		const trimmed = entry.trim().replace(/\\/g, '/');
		if (!trimmed) continue;
		const resolved = path.resolve(ROOT, trimmed);
		const rel = path.relative(ROOT, resolved).replace(/\\/g, '/');
		if (rel.startsWith('src/') && SOURCE_EXT_RE.test(rel) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
			outSet.add(rel);
		}
	}
	return [...outSet].sort().map((rel) => path.join(ROOT, rel));
}

function walkSourceFiles(dir, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walkSourceFiles(fullPath, out);
		} else if (entry.isFile() && SOURCE_EXT_RE.test(entry.name)) {
			out.push(fullPath);
		}
	}
	return out.sort();
}

function scriptKindFor(filePath) {
	if (filePath.endsWith('x')) return ts.ScriptKind.TSX;
	if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return ts.ScriptKind.JS;
	return ts.ScriptKind.TS;
}

const t0 = performance.now();
const i18n = createI18nChecker(ROOT);
const identifiers = createIdentifierChecker(ROOT);
const emptyCatch = createEmptyCatchChecker(ROOT);
const parsedFilesMap = new Map();

const scopedFiles = resolveScopedRelPaths();
const allFiles = scopedFiles ?? walkSourceFiles(SRC_DIR);
let tsFileCount = 0;

for (const filePath of allFiles) {
	const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
	const isTs = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
	const isDts = filePath.endsWith('.d.ts');
	const content = fs.readFileSync(filePath, 'utf8');

	if (isTs) tsFileCount++;

	if (isDts) {
		const i18nState = i18n.startFile(filePath, relPath, content);
		i18n.finishFile(i18nState);
		continue;
	}

	const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKindFor(filePath));
	const resolvedPath = path.resolve(filePath);
	parsedFilesMap.set(resolvedPath, { filePath: resolvedPath, relPath, content, sf });

	const i18nState = isTs ? i18n.startFile(filePath, relPath, content) : null;
	const idState = isTs ? identifiers.startFile(relPath) : null;
	const ecState = emptyCatch.startFile(relPath, content);

	const visit = (node, parent) => {
		if (i18nState) i18n.visitNode(node, sf, i18nState);
		if (idState) identifiers.visitNode(node, parent, sf, idState);
		emptyCatch.visitNode(node, sf, ecState);
		ts.forEachChild(node, (child) => visit(child, node));
	};
	visit(sf, undefined);

	if (i18nState) i18n.finishFile(i18nState);
	if (idState) identifiers.finishFile(idState);
	emptyCatch.finishFile(ecState);
}

const i18nSummary = i18n.getSummary(tsFileCount);
const idSummary = identifiers.getSummary();
const ecSummary = emptyCatch.getSummary();
const auditSummary = checkAuditCoverageFromCache(ROOT, parsedFilesMap);

const ok = i18nSummary.ok && idSummary.ok && ecSummary.ok && auditSummary.ok;
const durationMs = Number((performance.now() - t0).toFixed(1));

const payload = {
	ok,
	filesParsed: parsedFilesMap.size,
	durationMs,
	checks: {
		i18n: i18nSummary,
		identifiers: idSummary,
		audit: auditSummary,
		emptyCatch: ecSummary,
	},
};

if (jsonMode) {
	console.log(JSON.stringify(payload, null, 2));
} else if (!ok) {
	if (i18nSummary.dictionaryViolations.length) {
		console.error('verify-ast [i18n dictionary]:');
		for (const v of i18nSummary.dictionaryViolations) console.error(`  - ${v}`);
	}
	if (i18nSummary.inlineTernaryViolations.length) {
		console.error('verify-ast [i18n inline/Turklish]:');
		for (const v of i18nSummary.inlineTernaryViolations) console.error(`  - ${v}`);
	}
	if (i18nSummary.crossAppImportViolations.length) {
		console.error('verify-ast [cross-app imports]:');
		for (const v of i18nSummary.crossAppImportViolations) console.error(`  - ${v}`);
	}
	if (idSummary.violations.length) {
		console.error('verify-ast [identifiers]:');
		for (const v of idSummary.violations) console.error(`  - ${v}`);
	}
	if (auditSummary.uncovered.length) {
		console.error('verify-ast [audit-coverage]:');
		for (const v of auditSummary.uncovered) console.error(`  - ${v}`);
	}
	if (ecSummary.violations.length) {
		console.error('verify-ast [empty-catch]:');
		for (const v of ecSummary.violations) console.error(`  - ${v}`);
	}
} else {
	console.log(
		`verify-ast: ${parsedFilesMap.size} files parsed once (${durationMs}ms) — ` +
			`i18n(${i18nSummary.keyCount} keys, 0 cross-app), identifiers(0), ` +
			`audit(${auditSummary.totalMethods}/${auditSummary.routeCount}), ` +
			`empty-catch(0/${ecSummary.documentedCount} documented/${ecSummary.promiseNoopCount} bare)`
	);
}

if (!ok) process.exit(1);
