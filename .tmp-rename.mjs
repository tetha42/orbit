import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const dict = JSON.parse(fs.readFileSync('scripts/turkish-words.json', 'utf8'));
const W = dict.words, WHOLE = dict.wholeTokens;
const PIECE = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+|_+|\$+|[^A-Za-z0-9_$]+/g;
export function mapIdent(id) {
	if (WHOLE[id]) return WHOLE[id];
	if (W[id.toLowerCase()] && /^[a-z]+$/.test(id)) { const e = W[id]; if (e !== undefined) return e; }
	const pieces = id.match(PIECE) ?? [id];
	let changed = false;
	const out = pieces.map((p, i) => {
		const lw = p.toLowerCase();
		if (!/^[A-Za-z]+$/.test(p)) return p;
		const e = W[lw];
		if (e === undefined) return p;
		changed = true;
		if (p.length > 1 && p === p.toUpperCase()) return e.toUpperCase();
		if (i > 0 || /^[A-Z]/.test(p)) return e[0].toUpperCase() + e.slice(1);
		return e;
	});
	return changed ? out.join('') : id;
}
if (process.argv[1].endsWith('.tmp-rename.mjs')) {
	const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f, o); else o.push(f); } return o; };
	const files = ['src', 'tests', 'scripts'].flatMap((d) => walk(d)).filter((f) => /\.(ts|tsx|mjs)$/.test(f) && !/\.d\.ts$/.test(f)
		&& !/(^|\/)(i18n[A-Za-z]*|translations)\.ts$/.test(f) && !/scripts\/(build-mappings|refactor-rename|scan-identifiers|check-identifiers|\.tmp)/.test(f));
	const SQL = /\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|RETURNING|build_object)\b/i;
	const mapAlias = (s) => {
		let t = s.replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, (m, x) => `"${mapIdent(x)}"`);
		t = t.replace(/\bAS\s+([A-Za-z_][A-Za-z0-9_]*)/g, (m, x) => (/^[A-Z]+$/.test(x) ? m : `AS ${mapIdent(x)}`));
		if (/build_object/i.test(t)) t = t.replace(/'([A-Za-z_][A-Za-z0-9_]*)'(\s*,)/g, (m, x, c) => `'${mapIdent(x)}'${c}`);
		return t;
	};
	const cssAliases = (sf) => {
		const set = new Set();
		for (const st of sf.statements) if (ts.isImportDeclaration(st) && /\.module\.css$/.test(st.moduleSpecifier.text) && st.importClause?.name) set.add(st.importClause.name.text);
		return set;
	};
	const recvOk = /(searchParams|params|formData|fd|form|sp|query)$/i;
	let changedFiles = 0, edits = 0;
	for (const f of files) {
		const text = fs.readFileSync(f, 'utf8');
		const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
		const css = cssAliases(sf);
		const reps = [];
		const push = (s, e, str) => { if (text.slice(s, e) !== str) reps.push([s, e, str]); };
		const visit = (n) => {
			if (ts.isIdentifier(n)) {
				const p = n.parent;
				const skip = (ts.isPropertyAccessExpression(p) && p.name === n && ts.isIdentifier(p.expression) && css.has(p.expression.text))
					|| (ts.isImportSpecifier(p) && false);
				if (!skip) push(n.getStart(sf), n.end, mapIdent(n.text));
			} else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
				const p = n.parent;
				const raw = text.slice(n.getStart(sf), n.end);
				if (SQL.test(n.text)) { const m = mapAlias(raw); push(n.getStart(sf), n.end, m); }
				else if (ts.isPropertyAssignment(p) && p.name === n && /^[A-Za-z_][A-Za-z0-9_]*$/.test(n.text)) push(n.getStart(sf) + 1, n.end - 1, mapIdent(n.text));
				else if (ts.isElementAccessExpression(p) && p.argumentExpression === n && /^[A-Za-z_][A-Za-z0-9_]*$/.test(n.text) && !(ts.isIdentifier(p.expression) && css.has(p.expression.text))) push(n.getStart(sf) + 1, n.end - 1, mapIdent(n.text));
				else if (ts.isCallExpression(p) && p.arguments[0] === n && ts.isPropertyAccessExpression(p.expression) && /^(get|set|append|has|delete|getAll)$/.test(p.expression.name.text) && recvOk.test(p.expression.expression.getText(sf)) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(n.text)) push(n.getStart(sf) + 1, n.end - 1, mapIdent(n.text));
			} else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
				const raw = text.slice(n.getStart(sf), n.end);
				if (SQL.test(raw) || (n.parent.parent && SQL.test(n.parent.getText(sf)))) push(n.getStart(sf), n.end, mapAlias(raw));
			}
			ts.forEachChild(n, visit);
		};
		visit(sf);
		if (!reps.length) continue;
		reps.sort((a, b) => b[0] - a[0]);
		let out = text;
		for (const [s, e, r] of reps) out = out.slice(0, s) + r + out.slice(e);
		fs.writeFileSync(f, out); changedFiles++; edits += reps.length;
	}
	console.log(`renamed ${edits} tokens in ${changedFiles} files`);
}
