// Validates that CSS modules in apps do not contain forbidden hardcoded accent colors
// where global design tokens (var(--accent), var(--accent-subtle), etc.) should be used.
//
// Usage:
//   node scripts/check-tokens.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APPS_DIR = join(process.cwd(), 'src/apps');

// Hardcoded accent colors that were previously used as brand accents in apps
// and must NOT be used for interactive elements (buttons, active tabs, focus, badges)
const FORBIDDEN_ACCENT_PATTERNS = [
	{ hex: '#ff9500', name: 'orange (former testbench brand)' },
	{ hex: '#ff2d55', name: 'pink (former news brand)' },
];

function findCssFiles(dir) {
	let results = [];
	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			results = results.concat(findCssFiles(fullPath));
		} else if (entry.endsWith('.module.css')) {
			results.push(fullPath);
		}
	}
	return results;
}

const cssFiles = findCssFiles(APPS_DIR);
let errors = [];

for (const file of cssFiles) {
	const content = readFileSync(file, 'utf8');
	const lines = content.split('\n');

	lines.forEach((line, index) => {
		// Ignore comments
		const cleanLine = line.replace(/\/\*.*?\*\//g, '').trim();
		if (cleanLine.startsWith('/*') || cleanLine.startsWith('*')) return;

		for (const pattern of FORBIDDEN_ACCENT_PATTERNS) {
			// Check if line sets a background, color, or border to the forbidden color
			// in an interactive context (not status codes or semantic warnings)
			if (
				cleanLine.toLowerCase().includes(pattern.hex.toLowerCase()) &&
				(cleanLine.includes('background') || cleanLine.includes('color:') || cleanLine.includes('border-color'))
			) {
				// Allow if clearly semantic status/warning
				if (cleanLine.includes('warning') || cleanLine.includes('badgeWarn') || cleanLine.includes('statusWarn')) {
					continue;
				}
				errors.push({
					file: file.replace(process.cwd() + '/', ''),
					line: index + 1,
					text: cleanLine,
					reason: `Contains forbidden hardcoded accent ${pattern.name}. Use var(--accent) or semantic tokens instead.`,
				});
			}
		}
	});
}

if (errors.length > 0) {
	console.error('❌ Check Tokens Failed: Found hardcoded accent colors in CSS modules:\n');
	for (const err of errors) {
		console.error(`  ${err.file}:${err.line}`);
		console.error(`    ${err.text}`);
		console.error(`    Reason: ${err.reason}\n`);
	}
	process.exit(1);
} else {
	console.log(`✅ Check Tokens Passed: Scanned ${cssFiles.length} CSS module files. All apps properly adhere to global design tokens.`);
}
