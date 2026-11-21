// Decisions (Official Documents): writing, editing, and locking a document (only an admin can unlock),
// reference numbers, public verification page summary, and role boundaries.
import { client } from '../lib/api.mjs';
import { dockApps, openApp } from '../lib/browser.mjs';
import { dialogReply } from '../lib/dialog.mjs';
import { uniq } from '../lib/temporary.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Decisions: document writing/editing/locking, reference number, verification page, roles' };

/** 2026005 → "2026/005", the way the portal prints it. */
const document = (no) => `${Math.floor(no / 1000)}/${String(no % 1000).padStart(3, '0')}`;

export default async function suite(t) {
	const admin = await t.api('admin');
	const zeynep = await t.api('zeynep');
	const can = await t.api('can');
	const reader = await t.api('reader');
	const tag = uniq();
	const year = new Date().getFullYear();
	const TITLE = `E2E Decision ${tag}`;
	const TITLE_2 = `E2E Secret Document ${tag}`;
	const CONTENT = 'The board accepted this trial unanimously.';

	// Whatever the suite made goes: a locked document is unlocked first (the admin may), then deleted.
	const made = [];
	t.cleanup(async () => {
		for (const id of made) {
			await admin.post('/api/decisions', { action: 'unlock', id });
			await admin.del(`/api/decisions?id=${encodeURIComponent(id)}`);
		}
	});
	const list = async (c = admin) => (await c.get('/api/decisions')).json;
	const byTitle = async (title, c = admin) => (await list(c)).find((d) => d.title === title);
	const row = (win, title) => win.locator('[data-focus-id^="decision:"]', { hasText: title });

	const before = await list();
	const maxBefore = Math.max(year * 1000, ...before.map((d) => d.referenceNumber).filter((n) => Math.floor(n / 1000) === year));

	let doc = null; // the public document written in the UI
	let secret = null; // the members-hidden one written over the API

	const { page: zeynepPage, context: zeynepCtx } = await t.open('zeynep');
	const zWin = await openApp(zeynepPage, 'decisions');

	await t.step('board writes a document in the UI; reference number is year/sequence', async () => {
		await zWin.getByRole('button', { name: tr('decisionsNewDoc') }).click();
		await zWin.getByText(tr('decisionsTemplateResolution')).click();
		const form = zWin.locator('form');
		await form.locator('input[type=text]').fill(TITLE);
		await form.locator('textarea').nth(0).fill('1. Trial agenda');
		await form.locator('textarea').nth(1).fill(CONTENT);
		await t.shot(zeynepPage, 'new-document-form');
		await form.getByRole('button', { name: tr('decisionsSealAndSave') }).click();
		await row(zWin, TITLE).waitFor();

		doc = await byTitle(TITLE);
		t.check(doc, 'document is in the API list');
		if (!doc) return;
		made.push(doc.id);
		t.eq(doc.referenceNumber, maxBefore + 1, 'reference number continues from the previous one');
		t.eq(Math.floor(doc.referenceNumber / 1000), year, 'number belongs to this year (YYYYnnn)');
		t.eq(doc.documentType, 'resolution', 'selected template document type was saved');
		t.eq(Number(doc.isPublic), 1, 'document written in the UI is public to members');
		t.eq(Number(doc.isLocked), 0, 'new document is not locked');
		t.check(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(doc.summary ?? ''), 'content digest has the form XXXX-XXXX-XXXX-XXXX', doc.summary);
		const listed = await row(zWin, TITLE).innerText();
		t.includes(listed, `${tr('decisionsDocRef')} ${document(doc.referenceNumber)}`, 'list shows the document number as YYYY/nnn');
		const page = await zWin.innerText();
		t.includes(page, `${tr('decisionsDocNo')} ${document(doc.referenceNumber)}`, 'document view shows the reference number');
		t.includes(page, `${tr('decisionsVerifyCode')} ORBIT-DOC-${doc.referenceNumber}`, 'printed verification code matches the number');
		t.includes(page, doc.summary, 'printed content digest matches the server');
		await t.shot(zeynepPage, 'document-view');
	});

	await t.step('document numbers increase in sequence (API)', async () => {
		const res = await zeynep.post('/api/decisions', { title: TITLE_2, content: CONTENT, documentType: 'event_permission', isPublic: false });
		t.eq(res.status, 201, 'board can write a document via the API');
		secret = res.json;
		if (secret?.id) made.push(secret.id);
		t.eq(secret?.referenceNumber, (doc?.referenceNumber ?? -1) + 1, 'second document received the next number');
		const bad = await zeynep.post('/api/decisions', { title: 'ab', content: CONTENT });
		t.eq(bad.status, 400, 'too-short title was rejected');
		const bad2 = await zeynep.post('/api/decisions', { title: TITLE, content: 'short' });
		t.eq(bad2.status, 400, 'too-short content was rejected');
		const bad3 = await zeynep.post('/api/decisions', { title: TITLE, content: CONTENT, documentType: 'yok_boyle_tur' });
		t.eq(bad3.status, 400, 'unknown document type was rejected');
	});

	await t.step('editing: title and body change, and the content digest changes too', async () => {
		if (!doc) return;
		const oldSummary = doc.summary;
		await row(zWin, TITLE).click();
		await zWin.getByRole('button', { name: tr('edit') }).click();
		const sheet = zeynepPage.getByRole('dialog', { name: tr('decisionsEditSheetTitle', { no: document(doc.referenceNumber) }) });
		await sheet.waitFor();
		const fresh = `${TITLE} (edited)`;
		await sheet.locator('input[required]').fill(fresh);
		await sheet.locator('textarea[required]').fill(`${CONTENT} The text has been edited.`);
		await sheet.getByRole('button', { name: tr('save') }).click();
		await sheet.waitFor({ state: 'detached' });
		await row(zWin, fresh).waitFor();
		const after = await byTitle(fresh);
		t.check(after, 'new title is in the API list');
		t.eq(after?.id, doc.id, 'same document updated (no new document created)');
		t.eq(after?.referenceNumber, doc.referenceNumber, 'reference number unchanged');
		t.check(after && after.summary !== oldSummary, 'content digest changed with the text', `${oldSummary} → ${after?.summary}`);
		doc = after ?? doc;
		await t.shot(zeynepPage, 'document-edited');

		// The public checkbox toggles the isPublic field.
		await zWin.getByRole('button', { name: tr('edit') }).click();
		await sheet.waitFor();
		await sheet.getByRole('checkbox').uncheck();
		await sheet.getByRole('button', { name: tr('save') }).click();
		await sheet.waitFor({ state: 'detached' });
		await t.waitFor(async () => Number((await byTitle(fresh))?.isPublic) === 0);
		t.eq(Number((await byTitle(fresh))?.isPublic), 0, 'when the box is cleared, the document is hidden from members');
		await zWin.getByRole('button', { name: tr('edit') }).click();
		await sheet.waitFor();
		await sheet.getByRole('checkbox').check();
		await sheet.getByRole('button', { name: tr('save') }).click();
		await sheet.waitFor({ state: 'detached' });
		await t.waitFor(async () => Number((await byTitle(fresh))?.isPublic) === 1);
		t.eq(Number((await byTitle(fresh))?.isPublic), 1, 'when the box is checked, the document is public to members again');
		doc = await byTitle(fresh);
	});

	await t.step('locking: cancelling leaves it unlocked; confirming closes editing and deletion', async () => {
		if (!doc) return;
		await row(zWin, doc.title).click();
		await zWin.getByRole('button', { name: tr('decisionsLockBtn') }).click();
		const asked = await dialogReply(zeynepPage, false);
		t.includes(asked, tr('decisionsLockConfirm', { no: document(doc.referenceNumber) }), 'confirmation dialog asks for the document by name');
		t.eq(Number((await byTitle(doc.title))?.isLocked), 0, 'cancelling leaves the document unlocked');

		await zWin.getByRole('button', { name: tr('decisionsLockBtn') }).click();
		await dialogReply(zeynepPage, true);
		await zWin.locator('[data-decision-detail]').getByText(tr('decisionsLocked'), { exact: true }).waitFor();
		t.eq(Number((await byTitle(doc.title))?.isLocked), 1, 'confirming locks the document');
		for (const name of [tr('edit'), tr('decisionsLockBtn'), tr('delete')]) {
			t.eq(await zWin.getByRole('button', { name }).count(), 0, 'locked document shows no edit, lock, or delete action');
		}
		t.eq(await zWin.getByRole('button', { name: tr('decisionsUnlockBtn') }).count(), 0, 'board cannot unlock: no "Unlock" button');
		t.eq(await zWin.getByRole('button', { name: tr('decisionsGetPetition') }).count(), 1, 'official petition available for a locked document');
		await t.shot(zeynepPage, 'document-locked');

		const patch = await zeynep.patch('/api/decisions', { id: doc.id, title: 'Must not change while locked' });
		t.eq(patch.status, 409, 'locked document cannot be edited over the API either (409)');
		const del = await zeynep.del(`/api/decisions?id=${encodeURIComponent(doc.id)}`);
		t.eq(del.status, 409, 'locked document cannot be deleted over the API either (409)');
		const unlock = await zeynep.post('/api/decisions', { action: 'unlock', id: doc.id });
		t.eq(unlock.status, 403, 'board cannot unlock over the API (403)');
		t.eq(Number((await byTitle(doc.title))?.isLocked), 1, 'after rejected requests the document is still locked');
	});

	await t.step('public verification page: number, status, and content digest', async () => {
		if (!doc || !secret) return;
		const { page } = await t.anonymous();
		const open = async (no) => {
			await page.goto(`${t.base}/verify/ORBIT-DOC-${no}`, { waitUntil: 'domcontentloaded' });
			await page.locator('main').waitFor();
			return page.locator('main').textContent();
		};
		const fresh = await byTitle(doc.title);
		let text = await open(fresh.referenceNumber);
		t.includes(text, tr('verifyDocLockedBadge'), 'locked document shows "Cryptographically Locked Document"');
		t.includes(text, document(fresh.referenceNumber), 'page shows the document number');
		t.includes(text, fresh.title, 'public document title is shown');
		t.includes(text, fresh.summary, 'content digest on the page matches the server');
		await t.shot(page, 'verification-locked');

		text = await open(secret.referenceNumber);
		t.includes(text, tr('verifyDocPendingBadge'), 'unlocked document says "Registered — Pending Lock"');
		t.includes(text, tr('verifyDocRestrictedNotice'), 'secret document content is not exposed');
		t.excludes(text, TITLE_2, 'secret document title is not on the page');
		const hidden = (await list()).find((d) => d.id === secret.id);
		t.includes(text, hidden.summary, 'only the digest of the secret document is shown');

		text = await open(9999999);
		t.includes(text, tr('verifyDocNotFoundTitle'), 'nonexistent number shows "Document Not Found"');
		await t.shot(page, 'verification-missing');
	});

	await t.step('unlocking is admin-only: "Unlock" in the UI; once unlocked the document can be edited', async () => {
		if (!doc) return;
		const { page } = await t.open('admin');
		const win = await openApp(page, 'decisions');
		await row(win, doc.title).click();
		await win.getByRole('button', { name: tr('decisionsUnlockBtn') }).click();
		const asked = await dialogReply(page, true);
		t.includes(asked, tr('decisionsUnlockConfirm', { no: document(doc.referenceNumber) }), 'unlock confirmation asks for the document');
		await win.getByRole('button', { name: tr('edit') }).waitFor();
		t.eq(Number((await byTitle(doc.title))?.isLocked), 0, 'admin unlocked it');
		t.eq(await win.getByRole('button', { name: tr('decisionsUnlockBtn') }).count(), 0, 'after unlocking, "Unlock" disappeared');
		const ok = await zeynep.patch('/api/decisions', { id: doc.id, agenda: 'Edited after unlocking' });
		t.eq(ok.status, 200, 'editing is possible again after unlocking');
		await t.shot(page, 'admin-unlocked');
	});

	await t.step('deletion: an unlocked document is deleted from the UI', async () => {
		const victim = await admin.post('/api/decisions', { title: `E2E Deletable ${tag}`, content: CONTENT });
		t.eq(victim.status, 201, 'document to delete was written');
		if (victim.json?.id) made.push(victim.json.id);
		// The list on screen was loaded before this document existed: reopen the desktop to refetch.
		await zeynepPage.reload();
		const win = await openApp(zeynepPage, 'decisions');
		await win.getByPlaceholder(tr('decisionsSearchPlaceholder')).fill(`Deletable ${tag}`);
		await row(win, `E2E Deletable ${tag}`).click();
		await win.getByRole('button', { name: tr('delete'), exact: true }).click();
		const asked = await dialogReply(zeynepPage, true);
		t.includes(asked, tr('decisionsDeleteConfirm'), 'delete confirmation is shown');
		await t.waitFor(async () => !(await byTitle(`E2E Deletable ${tag}`)));
		t.check(!(await byTitle(`E2E Deletable ${tag}`)), 'document deleted');
	});
	await t.close(zeynepCtx);

	await t.step('member (viewer): can read documents but not write; cannot see the secret document', async () => {
		const { page } = await t.open('can');
		const win = await openApp(page, 'decisions');
		await win.getByText(tr('decisionsReadOnly')).waitFor();
		t.eq(await win.getByRole('button', { name: tr('decisionsNewDoc') }).count(), 0, 'member: no "New Document" button');
		const visible = await list(can);
		t.check(visible.some((d) => d.id === doc?.id), 'member can read the public document via the API');
		t.check(!visible.some((d) => d.id === secret?.id), 'member does not see the secret document in the API list');
		await row(win, doc?.title ?? TITLE).waitFor();
		t.eq(await row(win, TITLE_2).count(), 0, 'member does not see the secret document in the UI');
		await row(win, doc?.title ?? TITLE).click();
		for (const name of [tr('edit'), tr('decisionsLockBtn'), tr('delete'), tr('decisionsUnlockBtn')]) {
			t.eq(await win.getByRole('button', { name, exact: name === tr('delete') }).count(), 0, 'member sees no edit, lock, delete, or unlock action');
		}
		await t.shot(page, 'member-read-only');

		t.eq((await can.post('/api/decisions', { title: 'Member cannot write', content: CONTENT })).status, 403, 'member cannot write a document (403)');
		t.eq((await can.patch('/api/decisions', { id: doc?.id, title: 'Member cannot edit' })).status, 403, 'member cannot edit a document (403)');
		t.eq((await can.del(`/api/decisions?id=${encodeURIComponent(doc?.id ?? 'x')}`)).status, 403, 'member cannot delete a document (403)');
		t.eq((await can.post('/api/decisions', { action: 'lock', id: doc?.id })).status, 403, 'member cannot lock a document (403)');
		t.eq((await can.post('/api/decisions', { action: 'unlock', id: doc?.id })).status, 403, 'member cannot unlock a document (403)');
		t.eq((await byTitle(doc?.title ?? TITLE))?.title, doc?.title, 'document unchanged after the rejected requests');
	});

	await t.step('news-only role: the Decisions app is absent and the API is closed', async () => {
		const { page } = await t.open('reader');
		t.sameSet(await dockApps(page), ['chat', 'news', 'settings'], 'no Decisions in the dock');
		t.eq((await reader.get('/api/decisions')).status, 403, 'read 403');
		t.eq((await reader.post('/api/decisions', { title: TITLE, content: CONTENT })).status, 403, 'write 403');
		const anon = client(t.base);
		t.eq((await anon.get('/api/decisions')).status, 401, 'request without a session 401');
	});

	await t.step('board can see the secret document', async () => {
		if (!secret) return;
		const visible = await list(zeynep);
		t.check(visible.some((d) => d.id === secret.id), 'board sees the secret document');
	});
}
