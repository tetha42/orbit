#!/usr/bin/env node
// Public showcase (landing) synchronization verification.
//
//   node scripts/verify-landing-sync.mjs [--base http://localhost:3000] [--require-data]
//
// Verifies that published news and events via /api/public/v1 flow in the expected
// format (date, image URL, category, CORS) required by the public showcase site.
// Uses only GET/OPTIONS requests; never mutates data.
//
//   --base          Portal address to inspect (default: PUBLIC_BASE_URL or http://localhost:3000)
//   --require-data  Throw error instead of warning if no published news/events exist
//   --origins       Comma-separated list of allowed origins (default: localhost & domain defaults)
//
// Exit code: 0 = all passed, 1 = at least one check failed.
import { loadConfigIni } from './ini-loader.mjs';

const c = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m' };

const arg = (name, fallback) => {
	const i = process.argv.indexOf(name);
	return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes(name);

loadConfigIni(process.cwd());
const BASE = (arg('--base', process.env.PUBLIC_BASE_URL || 'http://localhost:3000')).replace(/\/+$/, '');
const API = `${BASE}/api/public/v1`;
const REQUIRE_DATA = flag('--require-data');
const ORIGINS = arg(
	'--origins',
	process.env.PUBLIC_API_ALLOWED_ORIGINS ||
		'https://orbit.local,http://localhost:4321,http://localhost:3000'
)
	.split(',')
	.map((o) => o.trim().replace(/\/+$/, ''))
	.filter(Boolean);
/** An origin that must never be echoed back. */
const FOREIGN_ORIGIN = 'https://evil.example';

let passed = 0;
let failed = 0;
let warned = 0;
const ok = (msg) => {
	passed++;
	console.log(`${c.green}[PASS]${c.reset} ${msg}`);
};
const fail = (msg) => {
	failed++;
	console.log(`${c.red}[FAIL]${c.reset} ${msg}`);
};
const warn = (msg) => {
	warned++;
	console.log(`${c.yellow}[WARN]${c.reset} ${msg}`);
};
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const isIso = (v) => typeof v === 'string' && ISO.test(v) && !Number.isNaN(Date.parse(v));
const isHttpsUrl = (v) => {
	try {
		return new URL(v).protocol === 'https:' || new URL(v).protocol === 'http:';
	} catch {
		return false;
	}
};

async function get(path, headers = {}) {
	const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/json', ...headers } });
	const body = await res.json().catch(() => null);
	return { res, body };
}

function verifyArticle(a, label, { withContent = false } = {}) {
	const problems = [];
	for (const key of ['id', 'slug', 'title', 'summary']) {
		if (typeof a[key] !== 'string' || !a[key]) problems.push(`${key} is empty`);
	}
	if (!a.category || typeof a.category.id !== 'string' || typeof a.category.label !== 'string') problems.push('category { id, label } missing');
	if (typeof a.featured !== 'boolean') problems.push('featured is not boolean');
	if (a.imageUrl !== null && !(typeof a.imageUrl === 'string' && isHttpsUrl(a.imageUrl))) problems.push(`imageUrl must be null or valid URL (${a.imageUrl})`);
	if (!isIso(a.publishedAt)) problems.push(`publishedAt is not ISO (${a.publishedAt})`);
	if (!isIso(a.updatedAt)) problems.push(`updatedAt is not ISO (${a.updatedAt})`);
	if (isIso(a.publishedAt) && Date.parse(a.publishedAt) > Date.now() + 60_000) problems.push('publishedAt is in the future');
	if (withContent && (typeof a.content !== 'string' || !a.content)) problems.push('content is empty');
	check(problems.length === 0, `${label}${problems.length ? ` — ${problems.join('; ')}` : ''}`);
}

async function verifyNews() {
	console.log(`\n${c.bold}${c.cyan}==> News Feed (/news)${c.reset}`);
	const { res, body } = await get('/news?pageSize=24');
	check(res.status === 200, `GET /news → ${res.status}`);
	if (res.status !== 200 || !body) return;

	check(Array.isArray(body.data), 'data is an array');
	check(body.meta && body.meta.page === 1 && body.meta.pageSize === 24, 'meta.page/pageSize matches request');
	check(Number.isInteger(body.meta?.total) && body.meta.total >= body.data.length, `meta.total (${body.meta?.total}) >= returned items (${body.data.length})`);
	check(Array.isArray(body.categories) && body.categories.length > 0, 'categories populated for filter tabs');
	const categoryIds = new Set((body.categories ?? []).map((cat) => cat.id));
	check(
		(body.categories ?? []).every((cat) => typeof cat.label === 'string' && Number.isInteger(cat.count)),
		'every category has { id, label, count }'
	);

	if (body.data.length === 0) {
		(REQUIRE_DATA ? fail : warn)('No published public news articles; content checks skipped.');
	} else {
		for (const article of body.data) {
			verifyArticle(article, `article "${article.slug}"`);
			check(categoryIds.has(article.category?.id), `  category "${article.category?.id}" in categories list`);
		}
		const times = body.data.map((a) => Date.parse(a.publishedAt));
		check(times.every((t, i) => i === 0 || times[i - 1] >= t), 'news ordered newest to oldest');

		const first = body.data[0];
		const detail = await get(`/news/${encodeURIComponent(first.slug)}`);
		check(detail.res.status === 200, `GET /news/${first.slug} → ${detail.res.status}`);
		if (detail.body?.data) {
			verifyArticle(detail.body.data, 'article detail', { withContent: true });
			check(detail.body.data.slug === first.slug && detail.body.data.id === first.id, 'detail matches list item');
		}
	}

	const missing = await get('/news/__non_existent_article__');
	check(missing.res.status === 404 && missing.body?.error?.code === 'not_found', 'non-existent slug → 404 not_found');
	const badSize = await get('/news?pageSize=999');
	check(badSize.res.status === 400 && badSize.body?.error?.code === 'invalid_page_size', 'pageSize=999 → 400 invalid_page_size');
	const badCategory = await get('/news?category=__invalid__');
	check(badCategory.res.status === 400 && badCategory.body?.error?.code === 'invalid_category', 'unknown category → 400 invalid_category');
}

async function verifyEvents() {
	console.log(`\n${c.bold}${c.cyan}==> Events Calendar (/events)${c.reset}`);
	const { res, body } = await get('/events');
	check(res.status === 200, `GET /events → ${res.status}`);
	if (res.status !== 200 || !body) return;
	check(Array.isArray(body.data), 'data is an array');

	if (body.data.length === 0) {
		(REQUIRE_DATA ? fail : warn)('No upcoming public events; content checks skipped.');
		return;
	}
	const types = new Set(['workshop', 'seminar', 'hackathon', 'meeting', 'atolye', 'seminer', 'yarisma', 'toplanti']);
	const now = Date.now();
	for (const e of body.data) {
		const problems = [];
		for (const key of ['id', 'title', 'typeLabel', 'location']) {
			if (typeof e[key] !== 'string' || !e[key]) problems.push(`${key} is empty`);
		}
		if (!types.has(e.type)) problems.push(`type invalid (${e.type})`);
		if (!isIso(e.startsAt) || !isIso(e.endsAt)) problems.push('startsAt/endsAt is not ISO');
		else {
			if (Date.parse(e.endsAt) < Date.parse(e.startsAt)) problems.push('endsAt < startsAt');
			if (Date.parse(e.endsAt) < now) problems.push('past event included in list');
		}
		if (e.capacity !== null && !(Number.isInteger(e.capacity) && e.capacity > 0)) problems.push(`capacity must be null or > 0 (${e.capacity})`);
		if (e.capacity === null ? e.seatsLeft !== null : !(Number.isInteger(e.seatsLeft) && e.seatsLeft >= 0 && e.seatsLeft <= e.capacity)) {
			problems.push(`seatsLeft inconsistent (${e.seatsLeft}/${e.capacity})`);
		}
		check(problems.length === 0, `event "${e.title}"${problems.length ? ` — ${problems.join('; ')}` : ''}`);
	}
	const starts = body.data.map((e) => Date.parse(e.startsAt));
	check(starts.every((t, i) => i === 0 || starts[i - 1] <= t), 'events ordered chronologically');
}

async function verifyCors() {
	console.log(`\n${c.bold}${c.cyan}==> CORS Headers (Public Origins)${c.reset}`);
	for (const origin of ORIGINS) {
		for (const path of ['/news', '/events']) {
			const pre = await fetch(`${API}${path}`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } });
			check(
				pre.status === 204 && pre.headers.get('access-control-allow-origin') === origin,
				`OPTIONS ${path} Origin=${origin} → ${pre.status}, ACAO=${pre.headers.get('access-control-allow-origin')}`
			);
			const get_ = await fetch(`${API}${path}`, { headers: { Origin: origin } });
			check(get_.headers.get('access-control-allow-origin') === origin && /Origin/i.test(get_.headers.get('vary') ?? ''), `GET ${path} Origin=${origin} → ACAO + Vary: Origin`);
		}
	}
	const foreign = await fetch(`${API}/news`, { headers: { Origin: FOREIGN_ORIGIN } });
	check(foreign.headers.get('access-control-allow-origin') === null, `unauthorized origin (${FOREIGN_ORIGIN}) does not receive ACAO`);
}

async function verifyCaching() {
	console.log(`\n${c.bold}${c.cyan}==> HTTP Caching (ETag)${c.reset}`);
	const first = await fetch(`${API}/events`);
	const etag = first.headers.get('etag');
	check(Boolean(etag) && /public/.test(first.headers.get('cache-control') ?? ''), 'ETag and public Cache-Control present');
	if (!etag) return;
	const again = await fetch(`${API}/events`, { headers: { 'If-None-Match': etag } });
	check(again.status === 304, `If-None-Match → ${again.status} (304 expected)`);
}

console.log(`${c.bold}Public Showcase Sync Verification — ${API}${c.reset}`);
console.log(`Configured Origins: ${ORIGINS.join(', ')}`);

try {
	await verifyNews();
	await verifyEvents();
	await verifyCors();
	await verifyCaching();
} catch (err) {
	fail(`Could not connect to portal API (${API}): ${err instanceof Error ? err.message : err}`);
}

console.log(`\n${c.bold}Summary:${c.reset} ${c.green}${passed} passed${c.reset}, ${failed ? c.red : ''}${failed} failed${c.reset}, ${warned} warnings`);
process.exit(failed ? 1 : 0);
