import { NextResponse } from 'next/server';
import { testPostgresConnection } from '@/db';
import { CONFIG } from '@/lib/server/config';

export const dynamic = 'force-dynamic';

interface CandidateTarget {
	url: string;
	label: string;
	type: 'env' | 'docker' | 'baremetal';
}

export async function GET() {
	const candidates: CandidateTarget[] = [];
	const seen = new Set<string>();

	const addCandidate = (url: string | undefined, label: string, type: 'env' | 'docker' | 'baremetal') => {
		const clean = (url || '').trim();
		if (clean && !seen.has(clean)) {
			seen.add(clean);
			candidates.push({ url: clean, label, type });
		}
	};

	// 1. Process environment and config
	addCandidate(process.env.DATABASE_URL, 'Environment (DATABASE_URL)', 'env');
	addCandidate(CONFIG.database.url, 'Runtime Configuration', 'env');

	// Probe each candidate concurrently with a timeout
	const probePromises = candidates.map(async (candidate) => {
		try {
			const res = await testPostgresConnection(candidate.url);
			if (res.ok) {
				// Parse host and dbName from url
				let host = 'localhost:5432';
				let dbName = 'orbit';
				try {
					const parsed = new URL(candidate.url);
					host = parsed.host;
					dbName = parsed.pathname.replace(/^\//, '') || 'postgres';
				} catch {
					// Regex fallback
					const match = candidate.url.match(/@([^/]+)\/(.*)$/);
					if (match) {
						host = match[1];
						dbName = match[2];
					}
				}
				return {
					url: candidate.url,
					label: candidate.label,
					type: candidate.type,
					host,
					dbName,
					reachable: true,
				};
			}
			return null;
		} catch {
			return null;
		}
	});

	const results = await Promise.all(probePromises);
	const detectedCandidates = results.filter((r): r is NonNullable<typeof r> => r !== null);

	return NextResponse.json({
		detected: detectedCandidates.length > 0,
		count: detectedCandidates.length,
		candidates: detectedCandidates,
	});
}
