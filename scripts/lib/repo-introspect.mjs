import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createAstModuleCache, createDbTableTracer } from './ai-index-ast.mjs';

const HTTP_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const AUTH_GUARDS = [
	'requireApp',
	'requireAdmin',
	'authenticate',
	'authenticateEnrolled',
	'verifyAuth',
	'requireDatabaseAdmin',
	'requireDatabaseToken',
	'verifyVaultAccess',
	'verifyUploadAccess',
	'authorizeTerminal',
];

function walkFiles(dir, matchFn, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walkFiles(full, matchFn, out);
		else if (entry.isFile() && matchFn(entry.name)) out.push(full);
	}
	return out;
}

function extractWithAuditMeta(expr) {
	if (!expr || !ts.isCallExpression(expr)) return null;
	if (!ts.isIdentifier(expr.expression) || expr.expression.text !== 'withAudit') return null;
	const opt = expr.arguments[1];
	if (!opt || !ts.isObjectLiteralExpression(opt)) return { action: 'audited', target: '' };
	const meta = {};
	for (const prop of opt.properties) {
		if (
			ts.isPropertyAssignment(prop) &&
			ts.isIdentifier(prop.name) &&
			(ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer))
		) {
			meta[prop.name.text] = prop.initializer.text;
		}
	}
	return { action: meta.action || 'audited', target: meta.target || '' };
}

export function discoverApiRoutes(rootDir, knownTableNames = null) {
	const apiDir = path.join(rootDir, 'src/app/api');
	const routeFiles = walkFiles(apiDir, (n) => /^route\.(ts|js)$/.test(n)).sort();
	const routes = [];
	const tableNames = knownTableNames ?? discoverSchemaTables(rootDir).map((t) => t.name);
	const astCache = createAstModuleCache(rootDir);
	const dbTracer = createDbTableTracer(astCache, tableNames);

	for (const file of routeFiles) {
		const src = fs.readFileSync(file, 'utf8');
		const sf = astCache.parseMod(file).sf;
		const relFile = path.relative(rootDir, file).replace(/\\/g, '/');
		const relDir = path.relative(apiDir, path.dirname(file)).replace(/\\/g, '/');
		const apiPath = relDir ? `/api/${relDir}` : '/api';

		const localDecls = new Map();
		for (const st of sf.statements) {
			if (ts.isVariableStatement(st)) {
				for (const d of st.declarationList.declarations) {
					if (ts.isIdentifier(d.name) && d.initializer) localDecls.set(d.name.text, d.initializer);
				}
			}
		}

		const methods = [];
		const auditActions = {};
		const pushMethod = (m, expr) => {
			if (!methods.includes(m)) methods.push(m);
			const meta = extractWithAuditMeta(expr);
			if (meta) auditActions[m] = meta;
		};

		for (const st of sf.statements) {
			const isExported = Boolean(st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
			if (!isExported) continue;
			if (ts.isFunctionDeclaration(st) && st.name && HTTP_METHODS.has(st.name.text)) {
				pushMethod(st.name.text, null);
			} else if (ts.isVariableStatement(st)) {
				for (const decl of st.declarationList.declarations) {
					if (ts.isIdentifier(decl.name) && HTTP_METHODS.has(decl.name.text)) {
						pushMethod(decl.name.text, decl.initializer);
					}
				}
			} else if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
				for (const el of st.exportClause.elements) {
					if (!HTTP_METHODS.has(el.name.text)) continue;
					const local = el.propertyName ? el.propertyName.text : el.name.text;
					pushMethod(el.name.text, localDecls.get(local));
				}
			}
		}

		const authGuards = AUTH_GUARDS.filter((g) => new RegExp(`\\b${g}\\b`).test(src));
		const { dbCalls, tablesTouched } = dbTracer.analyzeRoute(file);
		routes.push({ path: apiPath, file: relFile, methods, auditActions, authGuards, dbCalls, tablesTouched });
	}
	return routes.sort((a, b) => a.path.localeCompare(b.path));
}

function splitTopLevelSqlItems(body) {
	const items = [];
	let cur = '';
	let depth = 0;
	let inSingle = false;
	for (let i = 0; i < body.length; i++) {
		const ch = body[i];
		if (ch === "'" && body[i - 1] !== '\\') inSingle = !inSingle;
		if (!inSingle) {
			if (ch === '(') depth++;
			else if (ch === ')') depth = Math.max(0, depth - 1);
			else if (ch === ',' && depth === 0) {
				if (cur.trim()) items.push(cur.trim());
				cur = '';
				continue;
			}
		}
		cur += ch;
	}
	if (cur.trim()) items.push(cur.trim());
	return items;
}

function parseCreateTablesFromText(src, relFile, tablesMap) {
	const re = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-z_][a-z0-9_]*)\s*\(/gi;
	let match;
	while ((match = re.exec(src)) !== null) {
		const tableName = match[1];
		let i = match.index + match[0].length;
		let depth = 1;
		let inSingle = false;
		const start = i;
		while (i < src.length && depth > 0) {
			const ch = src[i];
			if (ch === "'" && src[i - 1] !== '\\') inSingle = !inSingle;
			if (!inSingle) {
				if (ch === '(') depth++;
				else if (ch === ')') depth--;
			}
			i++;
		}
		const body = src.slice(start, i - 1);
		const columns = [];
		const constraints = [];
		for (const item of splitTopLevelSqlItems(body)) {
			const clean = item.replace(/\s+/g, ' ').trim();
			if (/^(PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CONSTRAINT|CHECK)\b/i.test(clean)) {
				constraints.push(clean);
			} else {
				const parts = clean.split(' ');
				const colName = parts[0];
				const colType = parts[1] || '';
				const rest = parts.slice(2).join(' ');
				columns.push({ name: colName, type: colType, constraints: rest });
			}
		}
		const existing = tablesMap.get(tableName);
		if (!existing || relFile.startsWith('src/db/schema/init/')) {
			tablesMap.set(tableName, {
				name: tableName,
				sourceFile: relFile,
				columns,
				constraints,
				indexes: existing?.indexes || [],
			});
		}
	}
}

export function discoverSchemaTables(rootDir) {
	const dbDir = path.join(rootDir, 'src/db');
	const files = walkFiles(dbDir, (n) => n.endsWith('.ts')).sort();
	const tablesMap = new Map();
	const indexesByTable = new Map();

	const addIndex = (table, idx) => {
		if (!indexesByTable.has(table)) indexesByTable.set(table, []);
		const list = indexesByTable.get(table);
		if (!list.some((x) => x.name === idx.name)) list.push(idx);
	};

	for (const file of files) {
		const src = fs.readFileSync(file, 'utf8');
		const relFile = path.relative(rootDir, file).replace(/\\/g, '/');
		parseCreateTablesFromText(src, relFile, tablesMap);

		const objRe = /\{\s*name:\s*'([^']+)',\s*table:\s*'([^']+)',\s*definition:\s*'([^']+)'(?:,\s*unique:\s*(true|false))?\s*\}/g;
		let m;
		while ((m = objRe.exec(src)) !== null) {
			addIndex(m[2], { name: m[1], unique: m[4] === 'true', definition: m[3] });
		}
		const sqlIdxRe = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s+ON\s+([a-z_][a-z0-9_]*)\s*([^;]+);/gi;
		while ((m = sqlIdxRe.exec(src)) !== null) {
			addIndex(m[3], {
				name: m[2],
				unique: Boolean(m[1]),
				definition: `ON ${m[3]} ${m[4].replace(/\s+/g, ' ').trim()}`,
			});
		}
	}

	return [...tablesMap.values()]
		.map((t) => ({
			...t,
			indexes: (indexesByTable.get(t.name) || []).sort((a, b) => a.name.localeCompare(b.name)),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function discoverAppManifests(rootDir) {
	const appsDir = path.join(rootDir, 'src/apps');
	const dirs = fs
		.readdirSync(appsDir, { withFileTypes: true })
		.filter((e) => e.isDirectory() && fs.existsSync(path.join(appsDir, e.name, 'manifest.ts')))
		.map((e) => e.name)
		.sort();

	const manifests = [];
	const emit = process.emitWarning;
	process.emitWarning = (warning, ...rest) => {
		if (!String(warning?.message ?? warning).includes('Module type of file')) emit.call(process, warning, ...rest);
	};
	try {
		for (const dir of dirs) {
			const url = pathToFileURL(path.join(appsDir, dir, 'manifest.ts')).href;
			manifests.push((await import(url)).default);
		}
	} finally {
		process.emitWarning = emit;
	}
	return manifests;
}
