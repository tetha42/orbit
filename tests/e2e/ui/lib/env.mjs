// Paths and command-line/environment settings shared by the runner and the suites.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export const SHOTS = path.join(ROOT, 'tests/e2e/shots');
export const TMP = path.join(ROOT, 'tests/e2e/.tmp');
export const SUITES = path.join(ROOT, 'tests/e2e/ui/suites');

const argv = process.argv.slice(2);

/** `--name value` from the command line, else the environment variable, else the fallback. */
export function setting(name, envName, fallback) {
	const i = argv.indexOf(`--${name}`);
	if (i >= 0 && argv[i + 1] !== undefined) return argv[i + 1];
	return process.env[envName] ?? fallback;
}

export const flag = (name) => argv.includes(`--${name}`);

/** Positional arguments: the suite names. Flags that take a value are skipped with it. */
export function positional() {
	const withValue = new Set(['--base', '--fixtures', '--port']);
	const names = [];
	for (let i = 0; i < argv.length; i++) {
		if (withValue.has(argv[i])) i++;
		else if (!argv[i].startsWith('--')) names.push(argv[i]);
	}
	return names;
}
