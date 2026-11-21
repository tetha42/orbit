import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const SQL_TABLE_RE =
	/\b(?:FROM|INTO|UPDATE|JOIN|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?|ALTER\s+TABLE)\s+(?:ONLY\s+)?(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?/gi;

const INFRA_DB_SYMBOLS = new Set([
	'ensurePostgresInit',
	'runSchemaMigrations',
	'ensureRoleSchema',
	'ensureMailSchema',
	'ensureOAuthSchema',
	'ensureAuditSchema',
	'startAuditMaintenance',
	'getPgPool',
	'withTransaction',
	'reconfigurePgPool',
	'isDatabaseConfigured',
	'testPostgresConnection',
	'checkDatabaseStatus',
	'publishEventQuiet',
	'publishEvent',
]);

export function resolveRepoTsFile(rootDir, fromFile, spec) {
	let base = null;
	if (spec.startsWith('./') || spec.startsWith('../')) {
		base = path.resolve(path.dirname(fromFile), spec);
	} else if (spec.startsWith('@/')) {
		base = path.join(rootDir, 'src', spec.slice(2));
	}
	if (!base) return null;
	for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
		const candidate = base + suffix;
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
	}
	return null;
}

export function createAstModuleCache(rootDir) {
	const modCache = new Map();

	function parseMod(filePath) {
		const resolvedPath = path.resolve(filePath);
		if (modCache.has(resolvedPath)) return modCache.get(resolvedPath);
		const src = fs.readFileSync(resolvedPath, 'utf8');
		const kind = resolvedPath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
		const sf = ts.createSourceFile(resolvedPath, src, ts.ScriptTarget.Latest, true, kind);
		const exportsMap = new Map();
		const starExports = [];
		const localDecls = new Map();
		const imports = new Map();

		for (const st of sf.statements) {
			const isExp = Boolean(st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
			if (ts.isImportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
				if (st.importClause?.isTypeOnly) continue;
				const spec = st.moduleSpecifier.text;
				const target = resolveRepoTsFile(rootDir, resolvedPath, spec);
				if (st.importClause?.name) {
					imports.set(st.importClause.name.text, { filePath: target, exportName: 'default', spec });
				}
				const bindings = st.importClause?.namedBindings;
				if (bindings && ts.isNamedImports(bindings)) {
					for (const el of bindings.elements) {
						if (el.isTypeOnly) continue;
						imports.set(el.name.text, {
							filePath: target,
							exportName: el.propertyName ? el.propertyName.text : el.name.text,
							spec,
						});
					}
				} else if (bindings && ts.isNamespaceImport(bindings)) {
					imports.set(bindings.name.text, { filePath: target, exportName: '*', spec });
				}
			} else if (ts.isFunctionDeclaration(st) && st.name) {
				localDecls.set(st.name.text, st);
				if (isExp) exportsMap.set(st.name.text, { node: st });
			} else if (ts.isVariableStatement(st)) {
				for (const d of st.declarationList.declarations) {
					if (ts.isIdentifier(d.name)) {
						localDecls.set(d.name.text, d);
						if (isExp) exportsMap.set(d.name.text, { node: d });
					}
				}
			} else if ((ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) && st.name) {
				localDecls.set(st.name.text, st);
				if (isExp) exportsMap.set(st.name.text, { node: st });
			} else if (ts.isExportDeclaration(st)) {
				if (st.isTypeOnly) continue;
				const spec = st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : null;
				const target = spec ? resolveRepoTsFile(rootDir, resolvedPath, spec) : null;
				if (st.exportClause && ts.isNamedExports(st.exportClause)) {
					for (const el of st.exportClause.elements) {
						if (el.isTypeOnly) continue;
						const local = el.propertyName ? el.propertyName.text : el.name.text;
						if (target) exportsMap.set(el.name.text, { reexport: { filePath: target, exportName: local } });
						else if (localDecls.has(local)) exportsMap.set(el.name.text, { node: localDecls.get(local) });
					}
				} else if (!st.exportClause && target) {
					starExports.push(target);
				}
			}
		}
		const mod = { filePath: resolvedPath, sf, exports: exportsMap, starExports, localDecls, imports };
		modCache.set(resolvedPath, mod);
		return mod;
	}

	function findExport(filePath, exportName, visited = new Set()) {
		if (!filePath) return null;
		const resolved = path.resolve(filePath);
		if (visited.has(resolved) || resolved.includes('/src/db/schema/init/')) return null;
		visited.add(resolved);
		const mod = parseMod(resolved);
		if (mod.exports.has(exportName)) {
			const entry = mod.exports.get(exportName);
			if (entry.node) return { mod, node: entry.node };
			if (entry.reexport) return findExport(entry.reexport.filePath, entry.reexport.exportName, visited);
		}
		for (const star of mod.starExports) {
			const hit = findExport(star, exportName, visited);
			if (hit) return hit;
		}
		return null;
	}

	return { parseMod, findExport };
}

function collectSqlTablesAndRefs(sf, node, knownTables) {
	const tables = new Set();
	const refs = new Set();
	function matchSql(text) {
		SQL_TABLE_RE.lastIndex = 0;
		let m;
		while ((m = SQL_TABLE_RE.exec(text)) !== null) {
			if (knownTables.has(m[1])) tables.add(m[1]);
		}
	}
	function visit(n) {
		if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
			matchSql(n.text);
		} else if (ts.isTemplateExpression(n)) {
			const parts = [n.head.text, ...n.templateSpans.map((sp) => ` __expr__ ${sp.literal.text}`)];
			matchSql(parts.join(''));
		} else if (ts.isIdentifier(n)) {
			refs.add(n.text);
		}
		ts.forEachChild(n, visit);
	}
	visit(node);
	return { tables, refs };
}

export function createDbTableTracer(cache, knownTableNames) {
	const knownTables = new Set(knownTableNames);
	const symCache = new Map();

	function tablesForNode(mod, node, key, stack) {
		if (symCache.has(key)) return symCache.get(key);
		if (stack.has(key)) return new Set();
		stack.add(key);
		const out = new Set();
		const { tables, refs } = collectSqlTablesAndRefs(mod.sf, node, knownTables);
		for (const t of tables) out.add(t);
		for (const ref of refs) {
			if (INFRA_DB_SYMBOLS.has(ref)) continue;
			if (mod.localDecls.has(ref)) {
				const sub = tablesForNode(mod, mod.localDecls.get(ref), `${mod.filePath}#local:${ref}`, stack);
				for (const t of sub) out.add(t);
			} else if (mod.imports.has(ref)) {
				const imp = mod.imports.get(ref);
				if (imp.filePath && (imp.filePath.includes('/src/db/') || imp.spec.startsWith('.'))) {
					for (const t of tablesForExport(imp.filePath, imp.exportName, stack)) out.add(t);
				}
			}
		}
		stack.delete(key);
		symCache.set(key, out);
		return out;
	}

	function tablesForExport(filePath, exportName, stack = new Set()) {
		if (!filePath || INFRA_DB_SYMBOLS.has(exportName)) return new Set();
		const key = `${path.resolve(filePath)}#${exportName}`;
		if (symCache.has(key)) return symCache.get(key);
		const hit = cache.findExport(filePath, exportName);
		if (!hit) return new Set();
		return tablesForNode(hit.mod, hit.node, key, stack);
	}

	function analyzeRoute(routeFilePath) {
		const mod = cache.parseMod(routeFilePath);
		const usedIds = new Set();
		function walkBody(n) {
			if (ts.isImportDeclaration(n) || ts.isTypeReferenceNode(n)) return;
			if (ts.isIdentifier(n)) usedIds.add(n.text);
			ts.forEachChild(n, walkBody);
		}
		walkBody(mod.sf);

		const dbCalls = [];
		const tables = new Set();
		const { tables: directTables } = collectSqlTablesAndRefs(mod.sf, mod.sf, knownTables);
		for (const t of directTables) tables.add(t);
		if (usedIds.has('withAudit')) tables.add('audit_logs');

		for (const [local, imp] of mod.imports) {
			if (!usedIds.has(local)) continue;
			if (imp.spec.startsWith('@/db')) {
				dbCalls.push(local);
				if (imp.filePath) {
					for (const t of tablesForExport(imp.filePath, imp.exportName)) tables.add(t);
				}
			} else if (imp.filePath && (imp.spec.startsWith('.') || imp.spec.startsWith('@/server/'))) {
				for (const t of tablesForExport(imp.filePath, imp.exportName)) tables.add(t);
			}
		}

		return {
			dbCalls: [...new Set(dbCalls)].sort(),
			tablesTouched: [...tables].sort(),
		};
	}

	return { analyzeRoute };
}

function formatNodeSignature(sf, node, overrideName = null) {
	const collapse = (s) => s.replace(/\s+/g, ' ').trim();
	if (ts.isFunctionDeclaration(node)) {
		const name = overrideName || node.name?.text || 'default';
		const params = node.parameters.map((p) => collapse(p.getText(sf))).join(', ');
		const ret = node.type ? `: ${collapse(node.type.getText(sf))}` : '';
		const asyncPrefix = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ? 'async ' : '';
		return `${asyncPrefix}function ${name}(${params})${ret}`;
	}
	if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
		const name = overrideName || node.name.text;
		const typeAnn = node.type ? `: ${collapse(node.type.getText(sf))}` : '';
		if (!typeAnn && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
			const fn = node.initializer;
			const params = fn.parameters.map((p) => collapse(p.getText(sf))).join(', ');
			const ret = fn.type ? `: ${collapse(fn.type.getText(sf))}` : '';
			const asyncPrefix = fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ? 'async ' : '';
			return `const ${name} = ${asyncPrefix}(${params})${ret} => ...`;
		}
		return `const ${name}${typeAnn}`;
	}
	if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) {
		const kind = ts.isInterfaceDeclaration(node)
			? 'interface'
			: ts.isTypeAliasDeclaration(node)
				? 'type'
				: ts.isClassDeclaration(node)
					? 'class'
					: 'enum';
		return `${kind} ${overrideName || node.name?.text || 'default'}`;
	}
	return null;
}

export function extractFileExportSignatures(cache, rootDir, relFile) {
	const fullPath = path.join(rootDir, relFile);
	const mod = cache.parseMod(fullPath);
	const signatures = [];

	for (const st of mod.sf.statements) {
		const isExp = Boolean(st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
		if (isExp && ts.isFunctionDeclaration(st)) {
			const sig = formatNodeSignature(mod.sf, st);
			if (sig) signatures.push(sig);
		} else if (isExp && ts.isVariableStatement(st)) {
			for (const d of st.declarationList.declarations) {
				const sig = formatNodeSignature(mod.sf, d);
				if (sig) signatures.push(sig);
			}
		} else if (
			isExp &&
			(ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st))
		) {
			const sig = formatNodeSignature(mod.sf, st);
			if (sig) signatures.push(sig);
		} else if (ts.isExportDeclaration(st)) {
			const spec = st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : null;
			const target = spec ? resolveRepoTsFile(rootDir, fullPath, spec) : null;
			if (st.exportClause && ts.isNamedExports(st.exportClause)) {
				for (const el of st.exportClause.elements) {
					const local = el.propertyName ? el.propertyName.text : el.name.text;
					if (target && !st.isTypeOnly && !el.isTypeOnly) {
						const hit = cache.findExport(target, local);
						const resolvedSig = hit ? formatNodeSignature(hit.mod.sf, hit.node, el.name.text) : null;
						if (resolvedSig) {
							signatures.push(resolvedSig);
							continue;
						}
					}
					const prefix = st.isTypeOnly || el.isTypeOnly ? 'type ' : '';
					signatures.push(`export ${prefix}${el.name.text}${spec ? ` from '${spec}'` : ''}`);
				}
			} else {
				signatures.push(st.getText(mod.sf).replace(/\s+/g, ' ').trim());
			}
		} else if (ts.isExportAssignment(st)) {
			signatures.push(`export default ${st.expression.getText(mod.sf).replace(/\s+/g, ' ').slice(0, 80)}`);
		}
	}

	return signatures;
}
