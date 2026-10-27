// Authenticator codes that the server will accept.
//
// The server accepts a code once: a second use of the same 30-second window is
// refused. `totpCode` therefore waits for the next window when the secret was
// already used in the current one. The windows are remembered in the temp folder, so
// the bookkeeping also holds from one run to the next.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { TMP } from './env.mjs';

const require = createRequire(import.meta.url);
const { generate } = require('otplib');

const STEP_MS = 30_000;
const FILE = path.join(TMP, 'totp-windows.json');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const keyOf = (secret) => crypto.createHash('sha256').update(secret).digest('hex').slice(0, 16);
const windowNow = () => Math.floor(Date.now() / STEP_MS);

function read() {
	try {
		return JSON.parse(fs.readFileSync(FILE, 'utf8'));
	} catch {
		return {};
	}
}

/** Tell the bookkeeping a code was spent outside `totpCode` (another script, the browser). */
export function markTotpUsed(secret) {
	fs.mkdirSync(TMP, { recursive: true });
	fs.writeFileSync(FILE, JSON.stringify({ ...read(), [keyOf(secret)]: windowNow() }));
}

/** A fresh code for `secret`; waits (up to 30 s) if this window's code was already spent. */
export async function totpCode(secret) {
	if (read()[keyOf(secret)] >= windowNow()) await sleep(STEP_MS + 500 - (Date.now() % STEP_MS));
	markTotpUsed(secret);
	return generate({ secret });
}
