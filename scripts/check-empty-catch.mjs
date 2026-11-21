// Orbit Community OS — Empty Catch Ratchet Gate
// Prevents silent error swallowing under src/. Every catch block must either
// execute recovery/logging logic or contain an explicit explanatory comment
// justifying why errors are intentionally ignored.
//
// Usage: node scripts/check-empty-catch.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src');
const CEILINGS_PATH = path.join(ROOT, 'scripts', 'empty-catch-ceilings.json');
const SOURCE_EXT_RE = /\.(?:ts|tsx|js|mjs)$/;

function walkSourceFiles(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walkSourceFiles(fullPath, out);
		} else if (entry.isFile() && SOURCE_EXT_RE.test(entry.name) && !entry.name.endsWith('.d.ts')) {
			out.push(fullPath);
		}
	}
	return out.sort();
}

function isNoOpExpression(expr) {
	let current = expr;
	while (ts.isParenthesizedExpression(current)) {
		current = current.expression;
	}
	if (ts.isVoidExpression(current)) return isNoOpExpression(current.expression);
	if (ts.isIdentifier(current)) return true;
	if (
		ts.isLiteralExpression(current) ||
		current.kind === ts.SyntaxKind.NullKeyword ||
		current.kind === ts.SyntaxKind.TrueKeyword ||
		current.kind === ts.SyntaxKind.FalseKeyword
	) {
		return true;
	}
	return false;
}

function isNoOpStatement(stmt) {
	if (ts.isEmptyStatement(stmt)) return true;
	if (ts.isBlock(stmt)) return stmt.statements.every(isNoOpStatement);
	if (ts.isExpressionStatement(stmt) && isNoOpExpression(stmt.expression)) {
		return true;
	}
	return false;
}

const PLACEHOLDER_COMMENT_RE = /^(?:todo|fixme|xxx|hack|noop|empty|eslint-disable(?:-next-line|-line)?)\b[:\s-]*$/i;

function hasExplanatoryComment(blockText) {
	const scanner = ts.createScanner(
		ts.ScriptTarget.Latest,
		false,
		ts.LanguageVariant.Standard,
		blockText
	);
	while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
		const tok = scanner.getToken();
		if (tok === ts.SyntaxKind.SingleLineCommentTrivia || tok === ts.SyntaxKind.MultiLineCommentTrivia) {
			const stripped = scanner
				.getTokenText()
				.replace(/^\/\/|^\/\*|\*\/$/g, '')
				.replace(/^\s*\*/gm, '')
				.trim();
			if (/[A-Za-z0-9]{3,}/.test(stripped) && !PLACEHOLDER_COMMENT_RE.test(stripped)) {
				return true;
			}
		}
	}
	return false;
}

function loadCeilings() {
	if (!fs.existsSync(CEILINGS_PATH)) return {};
	const parsed = JSON.parse(fs.readFileSync(CEILINGS_PATH, 'utf8'));
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('scripts/empty-catch-ceilings.json must be a JSON object');
	}
	return parsed;
}

const ceilings = loadCeilings();
const ceilingKeys = Object.keys(ceilings);
const files = walkSourceFiles(SRC_DIR);

const violations = [];
let documentedCount = 0;
let promiseNoopCount = 0;

if (ceilingKeys.length > 0) {
	violations.push(
		`scripts/empty-catch-ceilings.json must remain empty ({}), found ${ceilingKeys.length} entry(s)`
	);
}

for (const file of files) {
	const content = fs.readFileSync(file, 'utf8');
	const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
	const sf = ts.createSourceFile(
		file,
		content,
		ts.ScriptTarget.Latest,
		true,
		file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	);

	const fileHits = [];

	const visit = (node) => {
		if (ts.isCatchClause(node)) {
			const meaningful = node.block.statements.filter((stmt) => !isNoOpStatement(stmt));
			if (meaningful.length === 0) {
				const blockText = content.slice(node.block.getStart(sf), node.block.getEnd());
				if (hasExplanatoryComment(blockText)) {
					documentedCount++;
				} else {
					const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
					fileHits.push(line + 1);
				}
			}
		} else if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === 'catch' &&
			node.arguments.length >= 1
		) {
			const arg = node.arguments[0];
			if (
				(ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) &&
				ts.isBlock(arg.body) &&
				arg.body.statements.filter((stmt) => !isNoOpStatement(stmt)).length === 0
			) {
				const blockText = content.slice(arg.body.getStart(sf), arg.body.getEnd());
				if (!hasExplanatoryComment(blockText)) {
					promiseNoopCount++;
				}
			}
		}
		ts.forEachChild(node, visit);
	};

	visit(sf);

	const rawCeiling = ceilings[relPath];
	const ceiling = typeof rawCeiling === 'number' && Number.isFinite(rawCeiling) && rawCeiling >= 0 ? rawCeiling : 0;
	if (fileHits.length > ceiling) {
		for (const lineNo of fileHits) {
			violations.push(
				`${relPath}:${lineNo}: undocumented empty catch block (handle/rethrow error or document why swallowing is safe)`
			);
		}
	}
}

if (violations.length > 0) {
	console.error(`check-empty-catch: ${violations.length} violation(s) found:\n`);
	for (const v of violations) {
		console.error(`  - ${v}`);
	}
	process.exit(1);
}

console.log(
	`check-empty-catch: ${files.length} src/ files scanned ` +
		`(0 undocumented empty catch blocks, ${documentedCount} documented intentional catch blocks, ` +
		`${promiseNoopCount} bare .catch(() => {}) calls)`
);
