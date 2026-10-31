import fs from 'node:fs';
import path from 'node:path';

function findRoutes(dir) {
	const results = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...findRoutes(full));
		} else if (entry.name === 'route.ts' || entry.name === 'route.js') {
			results.push(full);
		}
	}
	return results;
}

const MUTATION_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];
const AUDIT_SIGNATURES = [
	'withAudit',
	'logAuditEvent',
	'auditContext',
	'logSystemEvent',
	'audit_logs',
	'system_logs',
];

const routes = findRoutes('src/app/api');
const missing = [];
let totalMutations = 0;
let coveredMutations = 0;

for (const file of routes) {
	const content = fs.readFileSync(file, 'utf8');
	const methods = [];
	for (const m of MUTATION_METHODS) {
		const funcRegex = new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`);
		const constRegex = new RegExp(`export\\s+const\\s+${m}\\b`);
		if (funcRegex.test(content) || constRegex.test(content)) {
			methods.push(m);
		}
	}

	if (methods.length === 0) continue;
	totalMutations += methods.length;

	const hasAudit = AUDIT_SIGNATURES.some((sig) => content.includes(sig)) || content.includes('audit:exempt');

	if (hasAudit) {
		coveredMutations += methods.length;
	} else {
		missing.push({
			file: path.relative(process.cwd(), file),
			methods,
		});
	}
}

console.log(`Audit coverage check: ${coveredMutations}/${totalMutations} mutation methods covered.`);

if (missing.length > 0) {
	console.error(`\n❌ Error: Found ${missing.length} API route files with unaudited mutation handlers:\n`);
	for (const item of missing) {
		console.error(`  - ${item.file} [${item.methods.join(', ')}]`);
	}
	console.error(`\nEvery mutation route must use withAudit(), logAuditEvent(), logSystemEvent(), or have an explicit audit:exempt comment.\n`);
	process.exit(1);
} else {
	console.log('✅ Audit coverage check passed: 100% mutation routes audited.');
	process.exit(0);
}
