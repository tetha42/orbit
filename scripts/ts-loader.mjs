import { existsSync, readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT_DIR = process.cwd();
const SRC_DIR = join(ROOT_DIR, 'src');
const PROBE_EXTS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.json'];

let installed = false;

function probeFile(basePath) {
	if (existsSync(basePath) && statSync(basePath).isFile()) {
		return basePath;
	}
	for (const ext of PROBE_EXTS) {
		const withExt = `${basePath}${ext}`;
		if (existsSync(withExt) && statSync(withExt).isFile()) {
			return withExt;
		}
	}
	if (existsSync(basePath) && statSync(basePath).isDirectory()) {
		for (const ext of PROBE_EXTS) {
			const idx = join(basePath, `index${ext}`);
			if (existsSync(idx) && statSync(idx).isFile()) {
				return idx;
			}
		}
	}
	return null;
}

export function registerTsAliasHooks() {
	if (installed) return;
	installed = true;

	registerHooks({
		resolve(specifier, context, nextResolve) {
			if (specifier === 'next/server' || specifier === 'next/headers' || specifier === 'next/navigation') {
				return nextResolve(`${specifier}.js`, context);
			}

			if (specifier.startsWith('@/')) {
				const candidate = probeFile(join(SRC_DIR, specifier.slice(2)));
				if (candidate) {
					return { url: pathToFileURL(candidate).href, shortCircuit: true };
				}
			}

			if (
				(specifier.startsWith('./') || specifier.startsWith('../')) &&
				context.parentURL?.startsWith('file://')
			) {
				const parentDir = dirname(fileURLToPath(context.parentURL));
				const candidate = probeFile(resolve(parentDir, specifier));
				if (candidate && (!extname(specifier) || candidate.endsWith('.json') || candidate.endsWith('.ts') || candidate.endsWith('.tsx'))) {
					return { url: pathToFileURL(candidate).href, shortCircuit: true };
				}
			}

			return nextResolve(specifier, context);
		},
		load(url, context, nextLoad) {
			if (!url.startsWith('file://')) {
				return nextLoad(url, context);
			}
			const filePath = fileURLToPath(url);
			if (filePath.endsWith('.json')) {
				return {
					format: 'json',
					source: readFileSync(filePath, 'utf-8'),
					shortCircuit: true,
				};
			}
			if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
				const sourceText = readFileSync(filePath, 'utf-8');
				const compiled = ts.transpileModule(sourceText, {
					fileName: filePath,
					compilerOptions: {
						module: ts.ModuleKind.ESNext,
						moduleResolution: ts.ModuleResolutionKind.Bundler,
						target: ts.ScriptTarget.ES2022,
						jsx: ts.JsxEmit.ReactJSX,
						esModuleInterop: true,
						isolatedModules: true,
					},
				});
				return {
					format: 'module',
					source: compiled.outputText,
					shortCircuit: true,
				};
			}
			return nextLoad(url, context);
		},
	});
}
