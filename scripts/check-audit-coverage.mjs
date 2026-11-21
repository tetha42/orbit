#!/usr/bin/env node
/**
 * scripts/check-audit-coverage.mjs
 *
 * AST-based verification gate: inspects every exported HTTP mutation handler
 * (`POST`, `PUT`, `PATCH`, `DELETE`) in `src/app/api/[...]/route.{ts,js}`
 * individually (never file-level substring matching) and ensures each method
 * records audit/security events directly or via a traced delegated helper,
 * unless annotated on that specific method with `audit:exempt: <reason>`.
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, 'src/app/api');
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const AUDIT_SIGNATURES = [
	'withAudit',
	'auditContext',
	'logAuditEvent',
	'recordAudit',
	'logSystemEvent',
	'auditAction',
	'recordSecurityStrike',
];

const sourceCache = new Map();

function readParsedModule(filePath) {
	if (sourceCache.has(filePath)) return sourceCache.get(filePath);
	if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
	const src = fs.readFileSync(filePath, 'utf8');
	const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true);
	const topDecls = new Map();
	const imports = new Map();

	for (const st of sf.statements) {
		if (ts.isFunctionDeclaration(st) && st.name) {
			topDecls.set(st.name.text, st);
		} else if (ts.isVariableStatement(st)) {
			for (const decl of st.declarationList.declarations) {
				if (ts.isIdentifier(decl.name) && decl.initializer) {
					topDecls.set(decl.name.text, decl.initializer);
				}
			}
		} else if (ts.isImportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
			const spec = st.moduleSpecifier.text;
			const resolved = resolveModulePath(filePath, spec);
			if (resolved && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) {
				for (const el of st.importClause.namedBindings.elements) {
					imports.set(el.name.text, {
						filePath: resolved,
						exportName: el.propertyName ? el.propertyName.text : el.name.text,
					});
				}
			}
		}
	}

	const parsed = { filePath, src, sf, topDecls, imports };
	sourceCache.set(filePath, parsed);
	return parsed;
}

function resolveModulePath(fromFile, spec) {
	let base = null;
	if (spec.startsWith('./') || spec.startsWith('../')) {
		base = path.resolve(path.dirname(fromFile), spec);
	} else if (spec.startsWith('@/')) {
		base = path.join(ROOT, 'src', spec.slice(2));
	}
	if (!base) return null;
	for (const suffix of ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js']) {
		const candidate = base + suffix;
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
			return candidate;
		}
	}
	return null;
}

function collectRouteFiles(dir, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			collectRouteFiles(full, out);
		} else if (/^route\.(ts|js)$/.test(entry.name)) {
			out.push(full);
		}
	}
	return out;
}

function collectCallAndValueIdentifiers(node, out = new Set()) {
	function visit(n) {
		if (ts.isCallExpression(n)) {
			if (ts.isIdentifier(n.expression)) {
				out.add(n.expression.text);
			} else if (ts.isPropertyAccessExpression(n.expression)) {
				out.add(n.expression.name.text);
			}
		} else if (ts.isIdentifier(n)) {
			const p = n.parent;
			const isMemberKey =
				(p && ts.isPropertyAccessExpression(p) && p.name === n) ||
				(p && ts.isPropertyAssignment(p) && p.name === n) ||
				(p && ts.isMethodDeclaration(p) && p.name === n);
			if (!isMemberKey) {
				out.add(n.text);
			}
		}
		ts.forEachChild(n, visit);
	}
	visit(node);
	return out;
}

function hasScopedExempt(mod, node) {
	const leading = ts.getLeadingCommentRanges(mod.src, node.getFullStart()) || [];
	const lastComment =
		leading.length > 0
			? mod.src.slice(leading[leading.length - 1].pos, leading[leading.length - 1].end)
			: '';
	if (/audit:exempt:\s*\S+/.test(lastComment)) return true;

	const start = node.getStart(mod.sf);
	const end = node.getEnd();
	const scanner = ts.createScanner(
		ts.ScriptTarget.Latest,
		false,
		ts.LanguageVariant.Standard,
		mod.src.slice(start, end)
	);
	while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
		const tok = scanner.getToken();
		if (tok === ts.SyntaxKind.SingleLineCommentTrivia || tok === ts.SyntaxKind.MultiLineCommentTrivia) {
			if (/audit:exempt:\s*\S+/.test(scanner.getTokenText())) return true;
		}
	}
	return false;
}

function isAstNodeCovered(mod, node, visited = new Set()) {
	if (!node) return false;

	const refs = collectCallAndValueIdentifiers(node);
	for (const name of refs) {
		if (AUDIT_SIGNATURES.includes(name)) return true;
		const localKey = `${mod.filePath}#${name}`;
		if (visited.has(localKey)) continue;
		visited.add(localKey);

		if (mod.topDecls.has(name)) {
			if (isAstNodeCovered(mod, mod.topDecls.get(name), visited)) return true;
		}
		if (mod.imports.has(name)) {
			const imp = mod.imports.get(name);
			const targetMod = readParsedModule(imp.filePath);
			if (targetMod) {
				const targetNode = targetMod.topDecls.get(imp.exportName);
				if (targetNode && isAstNodeCovered(targetMod, targetNode, visited)) return true;
			}
		}
	}
	return false;
}

const routeFiles = collectRouteFiles(API_DIR).sort();
const uncovered = [];
let totalMethods = 0;

for (const file of routeFiles) {
	const mod = readParsedModule(file);
	if (!mod) continue;
	const rel = path.relative(ROOT, file);

	for (const st of mod.sf.statements) {
		const isExported = Boolean(
			st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
		);
		if (!isExported) continue;

		if (ts.isFunctionDeclaration(st) && st.name && MUTATION_METHODS.has(st.name.text)) {
			totalMethods++;
			if (!hasScopedExempt(mod, st) && !isAstNodeCovered(mod, st)) {
				uncovered.push(`${rel} [${st.name.text}]`);
			}
		} else if (ts.isVariableStatement(st)) {
			for (const decl of st.declarationList.declarations) {
				if (ts.isIdentifier(decl.name) && MUTATION_METHODS.has(decl.name.text)) {
					totalMethods++;
					const ok =
						hasScopedExempt(mod, st) ||
						hasScopedExempt(mod, decl) ||
						isAstNodeCovered(mod, decl.initializer);
					if (!ok) {
						uncovered.push(`${rel} [${decl.name.text}]`);
					}
				}
			}
		} else if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
			for (const el of st.exportClause.elements) {
				if (!MUTATION_METHODS.has(el.name.text)) continue;
				totalMethods++;
				const localName = el.propertyName ? el.propertyName.text : el.name.text;
				const localNode = mod.topDecls.get(localName);
				let covered = hasScopedExempt(mod, st) || (localNode && isAstNodeCovered(mod, localNode));
				if (!covered && mod.imports.has(localName)) {
					const imp = mod.imports.get(localName);
					const targetMod = readParsedModule(imp.filePath);
					const targetNode = targetMod?.topDecls.get(imp.exportName);
					covered = Boolean(targetNode && isAstNodeCovered(targetMod, targetNode));
				}
				if (!covered) {
					uncovered.push(`${rel} [${el.name.text}]`);
				}
			}
		}
	}
}

if (uncovered.length > 0) {
	console.error('[check-audit-coverage] Mutation handlers without per-method audit logging:');
	for (const item of uncovered) {
		console.error(`  - ${item}`);
	}
	process.exit(1);
}

console.log(
	`check-audit-coverage: ok (${totalMethods} exported mutation methods across ${routeFiles.length} route files verified via AST)`
);
