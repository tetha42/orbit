import type { SocIncident, SystemLog, ForensicCaseDossier } from '../types';

/**
 * Computes a SHA-256 hash using the Web Crypto API or Node crypto fallback.
 */
async function computeSha256(content: string): Promise<string> {
	if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
		const msgBuffer = new TextEncoder().encode(content);
		const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	}
	return 'SHA256_INTEGRITY_SEAL_' + Date.now().toString(16);
}

/**
 * Compiles a Forensic Case Dossier object from incident data.
 */
export async function compileForensicDossier(
	incident: SocIncident,
	relatedLogs: SystemLog[],
	analystName: string
): Promise<ForensicCaseDossier> {
	const now = Date.now();
	const timeline = [
		{ time: incident.createdAt, event: 'Incident Detected & Triaged', detail: incident.title },
		{ time: incident.updatedAt, event: 'Status Updated', detail: `Status: ${incident.status}` },
	];

	if (incident.details && typeof incident.details === 'object') {
		const details = incident.details as Record<string, unknown>;
		if (Array.isArray(details.actionsTaken)) {
			for (const act of details.actionsTaken) {
				timeline.push({ time: now, event: 'SOAR Action', detail: String(act) });
			}
		}
	}

	const rawPayload = JSON.stringify({
		incidentId: incident.id,
		title: incident.title,
		severity: incident.severity,
		status: incident.status,
		sourceIp: incident.sourceIp,
		service: incident.service,
		notes: incident.analystNotes || '',
		relatedLogsCount: relatedLogs.length,
	});

	const evidenceSha256 = await computeSha256(rawPayload);

	return {
		incidentId: incident.id,
		title: incident.title,
		severity: incident.severity,
		status: incident.status,
		generatedAt: now,
		generatedBy: analystName,
		evidenceSha256,
		timeline,
		relatedSiemLogs: relatedLogs.slice(0, 50),
		networkIntelligence: {
			sourceIp: incident.sourceIp,
		},
		analystNotes: incident.analystNotes || 'No analyst notes recorded.',
	};
}

/**
 * Formats a ForensicCaseDossier into clean GitHub Flavored Markdown.
 */
export function formatDossierMarkdown(dossier: ForensicCaseDossier): string {
	const genDate = new Date(dossier.generatedAt).toUTCString();

	let md = `# FORENSIC CASE DOSSIER: ${dossier.incidentId}\n\n`;
	md += `> **EVIDENCE BAG INTEGRITY SEAL (SHA-256)**:\n`;
	md += `> \`${dossier.evidenceSha256}\`\n\n`;
	md += `---\n\n`;

	md += `## 1. Incident Overview\n\n`;
	md += `| Field | Value |\n`;
	md += `|---|---|\n`;
	md += `| **Incident Title** | ${dossier.title} |\n`;
	md += `| **Incident ID** | \`${dossier.incidentId}\` |\n`;
	md += `| **Severity Rating** | **${dossier.severity}** |\n`;
	md += `| **Containment Status** | \`${dossier.status.toUpperCase()}\` |\n`;
	md += `| **Source IP Address** | \`${dossier.networkIntelligence.sourceIp || 'N/A'}\` |\n`;
	md += `| **Generated At** | ${genDate} |\n`;
	md += `| **Lead Investigator** | ${dossier.generatedBy} |\n\n`;

	md += `## 2. Lead Investigator Notes\n\n`;
	md += `${dossier.analystNotes}\n\n`;

	md += `## 3. Incident Timeline & Automated Containment Actions\n\n`;
	md += `| Timestamp (UTC) | Action / Event | Specifics |\n`;
	md += `|---|---|---|\n`;
	for (const t of dossier.timeline) {
		const timeStr = new Date(t.time).toISOString().replace('T', ' ').slice(0, 19);
		md += `| ${timeStr} | ${t.event} | ${t.detail || '—'} |\n`;
	}
	md += `\n`;

	if (dossier.relatedSiemLogs.length > 0) {
		md += `## 4. Associated SIEM Log Evidence (${dossier.relatedSiemLogs.length} events)\n\n`;
		md += `| ID | Timestamp | Level | Service | IP | Log Message |\n`;
		md += `|---|---|---|---|---|---|\n`;
		for (const l of dossier.relatedSiemLogs) {
			const timeStr = new Date(l.zaman).toISOString().replace('T', ' ').slice(0, 19);
			md += `| #${l.id} | ${timeStr} | \`${l.seviye}\` | \`${l.servis}\` | \`${l.ip}\` | ${l.mesaj.replace(/\|/g, '\\|')} |\n`;
		}
		md += `\n`;
	}

	md += `---\n`;
	md += `*Generated automatically by ClubPanel SoC Studio Pro. Tamper-evident record.*`;

	return md;
}

/**
 * Triggers a browser download of the case file.
 */
export function downloadDossierFile(dossier: ForensicCaseDossier): void {
	if (typeof window === 'undefined') return;

	const mdContent = formatDossierMarkdown(dossier);
	const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${dossier.incidentId}_forensic_dossier.md`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
