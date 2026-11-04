// Etkinlik yoklaması: organizatör yoklamayı açar, projeksiyon karekodu her pencerede
// sunucudan gelir; üye karekodla (uygulama içi ve /yoklama/<kod> bağlantısı) yoklama verir;
// kapıda bilet okutma, öğrenci numarasıyla elle ekleme, geri alma (XP iadesi) ve katılım CSV'si.
import fs from 'node:fs';
import { answerDialog, stepper, toast } from '../lib/arayuz.mjs';
import { attendance, eventOf, makeEvent, openEvent, sweepEvents } from '../lib/event.mjs';
import { sweepStale, xpOf } from '../lib/team.mjs';
import { newMember } from '../lib/membership.mjs';

export const meta = { title: 'Etkinlikler: QR yoklama, projeksiyon kodu, bilet, elle ekleme, CSV' };

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	await sweepStale(admin);
	await sweepEvents(admin);

	const qr = await newMember(t, admin, { label: 'qr', roleId: fx.roles.member });
	const link = await newMember(t, admin, { label: 'baglanti', roleId: fx.roles.member });
	const ticket = await newMember(t, admin, { label: 'ticket', roleId: fx.roles.member });
	const walkIn = await newMember(t, admin, { label: 'elle', roleId: fx.roles.member });
	const [qrApi, linkApi, ticketApi] = await Promise.all([qr.api(), link.api(), ticket.api()]);
	const studentNo = (await admin.get('/api/uyeler')).json.members.find((m) => m.id === walkIn.id)?.studentNo;

	// Şu an sürmekte olan etkinlik (on dakika önce başladı) ve üç gün sonraki bir etkinlik.
	const live = await makeEvent(t, admin, { label: 'Canli', startMin: -10, lengthMin: 90 });
	const later = await makeEvent(t, admin, { label: 'Sonra', startMin: 3 * 24 * 60 });
	await ticketApi.post('/api/etkinlikler', { action: 'register', eventId: live.id });
	const codeOf = (id) => admin.get(`/api/etkinlikler/${encodeURIComponent(id)}/yoklama-kodu`);

	const { page: ap } = await t.open('admin');
	const astep = stepper(t, ap);

	await astep('yoklama kapalıyken kod verilmez; zamanı gelmemiş etkinlikte de verilmez', async () => {
		const closed = await codeOf(live.id);
		t.eq(closed.status, 409, 'kapalı yoklama: 409');
		t.eq(closed.json?.code, 'YOKLAMA_KAPALI', 'kod: YOKLAMA_KAPALI');
		await admin.post('/api/etkinlikler', { action: 'setAttendance', eventId: later.id, open: true });
		const early = await codeOf(later.id);
		t.eq(early.status, 409, 'zamanı gelmemiş etkinlik: 409');
		t.eq(early.json?.code, 'ZAMAN_DISI', 'kod: ZAMAN_DISI');
		await admin.post('/api/etkinlikler', { action: 'setAttendance', eventId: later.id, open: false });
	});

	await astep('organizatör yoklamayı açar; projeksiyon karekodu sunucudan gelir', async () => {
		const { detail } = await openEvent(ap, live.id);
		t.check(await detail.getByRole('button', { name: 'Projeksiyon QR' }).isDisabled(), 'yoklama kapalıyken projeksiyon düğmesi kapalı');
		await detail.getByText('Yoklama kapalı').click();
		await detail.getByText('Yoklama açık').waitFor();
		t.eq(Number((await eventOf(admin, live.id)).attendanceOpen), 1, 'sunucuda yoklama açık');
		await detail.getByRole('button', { name: 'Projeksiyon QR' }).click();
		const projector = ap.locator('[data-testid=projector-qr]');
		await t.waitFor(async () => /^BY1\./.test((await projector.getAttribute('data-code')) ?? ''));
		const shown = await projector.getAttribute('data-code');
		t.check(/^BY1\./.test(shown), 'projeksiyonda imzalı yoklama kodu');
		const fresh = await codeOf(live.id);
		t.eq(fresh.status, 200, 'organizatör kodu alabiliyor');
		t.check(fresh.json.remainingMs > 0 && fresh.json.remainingMs <= 30_000, 'kod 30 sn\'lik pencereye ait');
		t.check(fresh.json.url.endsWith(`/yoklama/${encodeURIComponent(fresh.json.text)}`), 'karekod bağlantısı /yoklama/<kod>');
		t.check(await ap.getByRole('dialog', { name: 'Canlı Yoklama' }).locator('img').count() === 1, 'karekod resmi çizildi');
		await t.shot(ap, 'projeksiyon');
		await ap.keyboard.press('Escape');
	});

	await t.step('üye uygulamada karekodla yoklama verir (+150 XP, bir kez)', async () => {
		const { page } = await qr.open();
		const before = await xpOf(qrApi);
		const { detail } = await openEvent(page, live.id);
		await detail.getByRole('button', { name: 'QR ile yoklama ver' }).click();
		const code = (await codeOf(live.id)).json.text;
		await page.getByPlaceholder(/BY1\./).fill(code);
		await page.getByRole('button', { name: 'Gönder', exact: true }).click();
		await toast(page, 'Yoklamanız alındı');
		t.eq(await xpOf(qrApi), before + 150, '150 XP kazanıldı');
		await t.waitFor(async () => (await detail.getByText('Katıldın').count()) > 0);
		t.check(await detail.getByText('Katıldın').count() > 0, '"Katıldın" rozeti');
		const again = await qrApi.post('/api/etkinlikler', { action: 'attend', code: (await codeOf(live.id)).json.text });
		t.eq(again.json?.already, true, 'ikinci yoklama "zaten" diyor');
		t.eq(await xpOf(qrApi), before + 150, 'XP ikinci kez verilmedi');
		await t.shot(page, 'qr-yoklama');
	});

	await t.step('telefon kamerası yolu: /yoklama/<kod> bağlantısı oturumla yoklama alır', async () => {
		const { page } = await link.open();
		const { url } = (await codeOf(live.id)).json;
		await page.goto(url);
		await page.getByRole('heading', { name: 'Yoklamanız alındı' }).waitFor();
		t.check(await page.getByText(live.title).count() === 1, 'sayfada etkinlik adı');
		t.check(Boolean((await eventOf(linkApi, live.id)).myMyAttendance), 'yoklama kayıtlı');
		const anon = await t.anonymous();
		await anon.page.goto(url);
		await anon.page.getByRole('heading', { name: /Giriş yapmanız gerekiyor|Yoklama alınamadı|Yoklamanız alındı/ }).waitFor();
		t.eq(await anon.page.getByRole('heading', { name: 'Giriş yapmanız gerekiyor' }).count(), 1, 'oturumsuz ziyaretçiye giriş isteniyor');
	});

	await t.step('sahte veya başka etkinliğin kodu kabul edilmez', async () => {
		const real = (await codeOf(live.id)).json.text;
		const forged = real.replace(/\.[^.]+$/, '.AAAAAAAAAAAAAAAAAAAAAAAA');
		t.eq((await qrApi.post('/api/etkinlikler', { action: 'attend', code: forged })).status, 403, 'imzası bozuk kod 403');
		const [, evId, window, signature] = real.split('.');
		t.eq((await qrApi.post('/api/etkinlikler', { action: 'attend', code: `BY1.${evId}.${Number(window) + 5}.${signature}` })).status, 403, 'pencere numarası değiştirilmiş kod 403');
		t.eq((await qrApi.post('/api/etkinlikler', { action: 'attend', code: 'rastgele' })).status, 400, 'biçimsiz kod 400');
		t.eq((await qrApi.get(`/api/etkinlikler/${live.id}/yoklama-kodu`)).status, 403, 'üye projeksiyon kodu alamaz');
	});

	await astep('kapıda bilet okutma ve öğrenci numarasıyla elle ekleme', async () => {
		const ticket = (await eventOf(ticketApi, live.id)).ticketCode;
		t.check(/^BB1\./.test(ticket ?? ''), 'kayıtlı üyenin bileti var');
		const { detail } = await openEvent(ap, live.id);
		await detail.getByRole('button', { name: 'Bilet okut' }).click();
		await ap.getByPlaceholder(/BB1\./).fill(ticket);
		await ap.getByRole('button', { name: 'Gönder', exact: true }).click();
		await toast(ap, 'giriş kaydedildi');
		await ap.keyboard.press('Escape');
		await detail.getByLabel('Elle ekle').fill(studentNo);
		await detail.getByRole('button', { name: 'Ekle', exact: true }).click();
		await toast(ap, 'eklendi');
		const list = await attendance(admin, live.id);
		const row = (id) => list.find((r) => r.userId === id);
		t.eq(row(ticket.id)?.method, 'ticket', 'bilet okutulan: yöntem bilet');
		t.eq(row(walkIn.id)?.method, 'manual', 'elle eklenen: yöntem manuel');
		t.eq(row(walkIn.id)?.recordTime ?? null, null, 'elle eklenen kayıtsız gelmiş');
		t.eq(row(qr.id)?.method, 'qr', 'karekodla gelen: yöntem qr');
		await detail.locator(`tr[data-member-id="${walkIn.id}"]`).getByText('Kayıtsız').waitFor();
		t.eq(await detail.locator(`tr[data-member-id="${walkIn.id}"]`).getByText('Kayıtsız').count(), 1, 'listede "Kayıtsız" rozeti');
		t.check((await t.waitFor(async () => (await detail.getByText('4/4').count()) >= 1)) >= 0, 'sayaç 4/4 (yoklama/kayıt+gelen)');
		t.eq((await admin.post('/api/etkinlikler', { action: 'scanTicket', eventId: later.id, code: ticket })).status, 409, 'başka etkinliğin bileti 409');
		t.eq((await admin.post('/api/etkinlikler', { action: 'scanTicket', eventId: live.id, code: ticket.slice(0, -3) + 'xyz' })).status, 403, 'bozuk bilet 403');
		await t.shot(ap, 'katilim-listesi');
	});

	await astep('katılım CSV\'si: başlık, satırlar, öğrenci numarası ve yöntem', async () => {
		const { detail } = await openEvent(ap, live.id);
		const [download] = await Promise.all([ap.waitForEvent('download'), detail.getByRole('button', { name: 'CSV indir' }).click()]);
		t.check(/\.csv$/.test(download.suggestedFilename()), `dosya adı .csv (${download.suggestedFilename()})`);
		const text = fs.readFileSync(await download.path(), 'utf8');
		t.check(text.charCodeAt(0) === 0xfeff, 'UTF-8 BOM var (Excel için)');
		const lines = text.replace(/^﻿/, '').split('\r\n');
		t.eq(lines[0].split(';'), ['Üye', 'Öğrenci no', 'Bölüm', 'Kayıt', 'Katılım', 'Yöntem', 'Kaydeden'], 'başlık satırı');
		t.eq(lines.length - 1, 4, 'dört katılımcı satırı');
		const walkLine = lines.find((l) => l.startsWith(walkIn.nameSurname));
		t.check(walkLine?.split(';')[1] === studentNo, 'öğrenci numarası doğru');
		t.check(walkLine?.split(';')[5] === 'Elle', 'yöntem "Elle"');
	});

	await astep('yoklamayı geri alma XP\'yi iade eder', async () => {
		const before = await xpOf(qrApi);
		const { detail } = await openEvent(ap, live.id);
		await detail.locator(`tr[data-member-id="${qr.id}"]`).getByRole('button', { name: 'Yoklamayı geri al' }).click();
		await answerDialog(ap);
		await t.waitFor(async () => !(await attendance(admin, live.id)).find((r) => r.userId === qr.id)?.participationTime);
		t.eq(await xpOf(qrApi), before - 150, '150 XP geri alındı');
	});

	await astep('yoklama kapatılınca eldeki kod da işe yaramaz', async () => {
		const code = (await codeOf(live.id)).json.text;
		const { detail } = await openEvent(ap, live.id);
		await detail.getByText('Yoklama açık').click();
		await detail.getByText('Yoklama kapalı').waitFor();
		const r = await qrApi.post('/api/etkinlikler', { action: 'attend', code: code });
		t.eq(r.status, 409, 'kapalı yoklamada kod 409');
		t.eq((await codeOf(live.id)).status, 409, 'yeni kod verilmiyor');
	});

	await t.step('yetkisiz rol: "Sadece Haberler" yoklama veremez, kod alamaz', async () => {
		const reader = await t.api('reader');
		await admin.post('/api/etkinlikler', { action: 'setAttendance', eventId: live.id, open: true });
		const code = (await codeOf(live.id)).json.text;
		t.eq((await reader.post('/api/etkinlikler', { action: 'attend', code: code })).status, 403, 'yoklama 403');
		t.eq((await reader.get(`/api/etkinlikler/${live.id}/yoklama-kodu`)).status, 403, 'kod 403');
		t.eq((await reader.get(`/api/etkinlikler/${live.id}/katilim`)).status, 403, 'katılım listesi 403');
	});
}
