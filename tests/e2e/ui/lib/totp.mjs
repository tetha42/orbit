// Authenticator codes that the server will accept.
//
// The server accepts monotonic steps within RFC 6238 +/-1 step tolerance (`afterTimeStep`).
// `totpCode` advances across allowed T-1 / T / T+1 steps before sleeping, avoiding unnecessary
// 30-second waits between sequential factor challenges on the same secret.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { TMP } from './env.mjs';

const require = createRequire(import.meta.url);
const { generate } = require('otplib');

const STEP_MS = 30_000;
const BOUNDARY_GUARD_MS = 5_000;
const FILE = path.join(TMP, 'totp-windows.json');
const windows = new Map();

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const keyOf = (secret, scope = '') =>
	crypto.createHash('sha256').update(`${scope}\0${secret}`).digest('hex').slice(0, 16);
const windowNow = () => Math.floor(Date.now() / STEP_MS);

function loadFromDisk() {
	if (windows.size > 0) return;
	try {
		const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
		for (const [k, v] of Object.entries(data)) {
			if (typeof v === 'number') windows.set(k, v);
		}
	} catch {
		// No prior window state saved yet.
	}
}

function flushToDisk() {
	try {
		fs.mkdirSync(TMP, { recursive: true });
		fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(windows)));
	} catch {
		// Non-fatal persistence fallback; in-memory map remains authoritative for this run.
	}
}

/** Tells the bookkeeping a step was spent outside `totpCode` (fixtures, browser, or cloned DB). */
export function markTotpUsed(secret, scope = '', usedStep = windowNow()) {
	loadFromDisk();
	const key = keyOf(secret, scope);
	windows.set(key, Math.max(windows.get(key) ?? -Infinity, usedStep));
	flushToDisk();
}

/** A fresh accepted code for `secret`, stepping monotonically across T-1 / T / T+1 without sleeping when allowed. */
export async function totpCode(secret, scope = '') {
	loadFromDisk();
	const key = keyOf(secret, scope);
	const remainingMs = STEP_MS - (Date.now() % STEP_MS);
	const minStep = remainingMs > BOUNDARY_GUARD_MS ? windowNow() - 1 : windowNow();
	const lastStep = windows.get(key) ?? -Infinity;
	const targetStep = Math.max(lastStep + 1, minStep);

	while (windowNow() + 1 < targetStep) {
		const waitMs = Math.max(200, (targetStep - 1) * STEP_MS - Date.now() + 200);
		await sleep(Math.min(waitMs, STEP_MS));
	}

	markTotpUsed(secret, scope, targetStep);
	return generate({ secret, epoch: targetStep * 30 });
}
