import { runApiSecurityScan } from './appsec';

/**
 * Generates an executive-ready Cybersecurity & AppSec Audit Report in Markdown format.
 */
export async function generateExecutiveAuditReport(baseUrl: string): Promise<string> {
	const appSec = await runApiSecurityScan(baseUrl, { force: true });
	const now = new Date().toISOString();
	let md = `# Orbit Security Operations Center — Executive Security Audit Report\n\n`;
	md += `**Generated At:** ${now}\n`;
	md += `**Overall Security Grade:** ${appSec.grade} (Score: ${appSec.score}/100)\n`;
	md += `**Total Audited Routes:** ${appSec.totalTested}\n`;
	md += `**Secure (PASS):** ${appSec.passed} | **Warning (WARN):** ${appSec.warned} | **Vulnerable (FAIL):** ${appSec.failed}\n`;
	md += `**Active WAF Shield:** ${appSec.wafActiveCount}/${appSec.totalTested} routes protected by WAF during adversarial probe\n\n`;
	md += `## Endpoint Security Posture\n\n`;
	md += `| Route | Category | Status | Unauth HTTP | WAF Shield | Security Headers | Latency |\n`;
	md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: |\n`;
	for (const r of appSec.routes) {
		const statusIcon = r.status === 'PASS' ? '✅ PASS' : r.status === 'WARN' ? '⚠️ WARN' : '❌ FAIL';
		const wafIcon = r.wafIntercepted ? '🛡️ Active (403)' : '⚪ Passthrough';
		const headersIcon = r.hasSecurityHeaders ? '🔒 Present' : '⚪ None';
		md += `| \`${r.endpoint}\` | ${r.category} | ${statusIcon} | ${r.unauthStatus} | ${wafIcon} | ${headersIcon} | ${r.latencyMs}ms |\n`;
	}
	md += `\n---\n*This report was generated autonomously by Orbit Security Operations Center (SoC).*\n`;
	return md;
}
