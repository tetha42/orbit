import { NextResponse } from 'next/server';
import { getSetupStatus, testPostgresConnection } from '@/db';
import { isSetupLocked } from '@/lib/setup';
import { clientAddress } from '@/lib/http';
import { CONFIG } from '@/server/config';
import { enforceSetupAccessGuards, verifySetupTokenGate } from '../setupGuards';
import {
	discoverDevDockerPostgres,
	rememberDetectedCandidate,
	type CandidateTarget,
} from './dockerDetect';

export const dynamic = 'force-dynamic';

function addCandidate(
	candidates: CandidateTarget[],
	seenUrls: Set<string>,
	id: string,
	url: string | undefined,
	label: string,
	type: CandidateTarget['type'],
	allowIpv4Fallback = true
) {
	const clean = (url || '').trim();
	if (!clean || seenUrls.has(clean)) return;
	seenUrls.add(clean);
	candidates.push({ id, url: clean, label, type });

	if (!allowIpv4Fallback) return;
	try {
		const parsed = new URL(clean);
		if (parsed.hostname === 'localhost') {
			parsed.hostname = '127.0.0.1';
			const ipv4Url = parsed.toString();
			if (!seenUrls.has(ipv4Url)) {
				seenUrls.add(ipv4Url);
				candidates.push({ id: `${id}-ipv4`, url: ipv4Url, label: `${label} (IPv4)`, type });
			}
		}
	} catch {
		// Non-standard connection string format; skip IPv4 rewrite.
	}
}

function extractSafeTarget(url: string): { host: string; dbName: string } {
	try {
		const parsed = new URL(url);
		return {
			host: parsed.host,
			dbName: parsed.pathname.replace(/^\//, '') || 'postgres',
		};
	} catch {
		const match = url.match(/@([^/]+)\/([^?]+)/);
		return {
			host: match?.[1] || 'localhost:5432',
			dbName: match?.[2] || 'orbit',
		};
	}
}

export async function GET(request: Request) {
	if (isSetupLocked()) {
		return NextResponse.json({ error: 'Setup is locked and permanently disabled.' }, { status: 403 });
	}
	const ip = clientAddress(request);
	const guardError = await enforceSetupAccessGuards(request, ip);
	if (guardError) return guardError;
	const tokenError = await verifySetupTokenGate(request, {}, ip, { path: '/api/setup/auto-detect' });
	if (tokenError) return tokenError;

	const setupStatus = await getSetupStatus().catch(() => ({ ready: false }));
	if (setupStatus.ready) {
		return NextResponse.json({ detected: false, count: 0, candidates: [] });
	}

	const candidates: CandidateTarget[] = [];
	const seenUrls = new Set<string>();

	addCandidate(candidates, seenUrls, 'env:process', process.env.DATABASE_URL, 'Environment (DATABASE_URL)', 'env');
	addCandidate(candidates, seenUrls, 'env:runtime', CONFIG.database.url, 'Runtime Configuration', 'env');

	if (process.env.NODE_ENV === 'development') {
		const dockerCandidates = await discoverDevDockerPostgres();
		for (const cand of dockerCandidates) {
			addCandidate(candidates, seenUrls, cand.id, cand.url, cand.label, cand.type, false);
		}
	}

	const probePromises = candidates.map(async (candidate) => {
		try {
			const res = await testPostgresConnection(candidate.url);
			if (!res.ok) return null;
			rememberDetectedCandidate(candidate.id, candidate.url);
			const { host, dbName } = extractSafeTarget(candidate.url);
			return {
				id: candidate.id,
				label: candidate.label,
				type: candidate.type,
				host,
				dbName,
				reachable: true,
			};
		} catch {
			// Candidate unreachable during probe.
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
