import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const PLACEHOLDER_COMMENT_RE = /^(?:todo|fixme|xxx|hack|noop|empty|eslint-disable(?:-next-line|-line)?)\b[:\s-]*$/i;

function isNoOpExpression(expr) {
	let current = expr;
	while (ts.isParenthesizedExpression(current)) current = current.expression;
	if (ts.isVoidExpression(current)) return isNoOpExpression(current.expression);
	if (ts.isIdentifier(current)) return true;
	return (
		ts.isLiteralExpression(current) ||
		current.kind === ts.SyntaxKind.NullKeyword ||
		current.kind === ts.SyntaxKind.TrueKeyword ||
		current.kind === ts.SyntaxKind.FalseKeyword
	);
}

function isNoOpStatement(stmt) {
	if (ts.isEmptyStatement(stmt)) return true;
	if (ts.isBlock(stmt)) return stmt.statements.every(isNoOpStatement);
	return ts.isExpressionStatement(stmt) && isNoOpExpression(stmt.expression);
}

function hasExplanatoryComment(blockText) {
	const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, blockText);
	while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
		const tok = scanner.getToken();
		if (tok === ts.SyntaxKind.SingleLineCommentTrivia || tok === ts.SyntaxKind.MultiLineCommentTrivia) {
			const stripped = scanner
				.getTokenText()
				.replace(/^\/\/|^\/\*|\*\/$/g, '')
				.replace(/^\s*\*/gm, '')
				.trim();
			if (/[A-Za-z0-9]{3,}/.test(stripped) && !PLACEHOLDER_COMMENT_RE.test(stripped)) return true;
		}
	}
	return false;
}

export function createEmptyCatchChecker(rootDir) {
	const ceilingsPath = path.join(rootDir, 'scripts', 'empty-catch-ceilings.json');
	let ceilings = {};
	if (fs.existsSync(ceilingsPath)) {
		const parsed = JSON.parse(fs.readFileSync(ceilingsPath, 'utf8'));
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error('scripts/empty-catch-ceilings.json must be a JSON object');
		}
		ceilings = parsed;
	}

	const violations = [];
	const ceilingKeys = Object.keys(ceilings);
	if (ceilingKeys.length > 0) {
		violations.push(
			`scripts/empty-catch-ceilings.json must remain empty ({}), found ${ceilingKeys.length} entry(s)`
		);
	}

	let documentedCount = 0;
	let promiseNoopCount = 0;
	let scannedFiles = 0;

	function startFile(relPath, content) {
		scannedFiles++;
		return { relPath, content, fileHits: [] };
	}

	function visitNode(node, sf, state) {
		if (ts.isCatchClause(node)) {
			const meaningful = node.block.statements.filter((stmt) => !isNoOpStatement(stmt));
			if (meaningful.length === 0) {
				const blockText = state.content.slice(node.block.getStart(sf), node.block.getEnd());
				if (hasExplanatoryComment(blockText)) {
					documentedCount++;
				} else {
					const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
					state.fileHits.push(line + 1);
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
				const blockText = state.content.slice(arg.body.getStart(sf), arg.body.getEnd());
				if (!hasExplanatoryComment(blockText)) promiseNoopCount++;
			}
		}
	}

	function finishFile(state) {
		const rawCeiling = ceilings[state.relPath];
		const ceiling = typeof rawCeiling === 'number' && Number.isFinite(rawCeiling) && rawCeiling >= 0 ? rawCeiling : 0;
		if (state.fileHits.length > ceiling) {
			for (const lineNo of state.fileHits) {
				violations.push(
					`${state.relPath}:${lineNo}: undocumented empty catch block (handle/rethrow error or document why swallowing is safe)`
				);
			}
		}
	}

	function getSummary() {
		return {
			ok: violations.length === 0,
			scannedFiles,
			documentedCount,
			promiseNoopCount,
			violations,
		};
	}

	return { startFile, visitNode, finishFile, getSummary };
}
