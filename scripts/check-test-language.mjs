// Guards the language of test diagnostics: suites drive a Turkish UI, so selector
// strings and fixture data legitimately contain Turkish; the messages printed for a
// developer must not. This gate reads the *diagnostic* string of a `t.step/check/eq/
// sameSet/includes/excludes` call (its last string literal), `meta` titles, console
// calls and comments, and fails on Turkish letters there.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = path.join(ROOT, 'tests');
const TURKISH = /[\u00e7\u011f\u0131\u00f6\u015f\u00fc\u00c7\u011e\u0130\u00d6\u015e\u00dc]/;
const STRING = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
const DIAGNOSTIC = /\bt\.(?:check|eq|sameSet|includes|excludes|step)\(|meta\s*=\s*\{|console\.(?:log|warn|error)\(/;

function files(dir) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...files(full));
		else if (entry.name.endsWith('.mjs')) out.push(full);
	}
	return out;
}

const problems = [];
for (const file of files(TESTS)) {
	const text = fs.readFileSync(file, 'utf8');
	text.split('\n').forEach((line, i) => {
		const where = `${path.relative(ROOT, file)}:${i + 1}`;
		const trimmed = line.trim();
		if (/^(?:\/\/|\/\*|\*)/.test(trimmed) && TURKISH.test(line)) {
			problems.push(`${where}: comment is not English: ${trimmed.slice(0, 120)}`);
			return;
		}
		if (!DIAGNOSTIC.test(line)) return;
		const strings = line.match(STRING);
		if (!strings?.length) return;
		const last = strings[strings.length - 1];
		if (TURKISH.test(last)) problems.push(`${where}: diagnostic is not English: ${last.slice(0, 120)}`);
	});
}

if (problems.length) {
	console.error('check-test-language: Turkish text in developer-facing test output:');
	for (const p of problems) console.error(`  - ${p}`);
	process.exit(1);
}
console.log('check-test-language: test diagnostics and comments are English.');
