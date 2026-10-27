// Sertifikalar: rozetler gerçek kayıttan kazanılır; yönetim tek üyeye ya da bir etkinliğin
// katılımcılarına sertifika verir; sertifika sayfası ve vektör PDF; herkese açık doğrulama;
// iptal; üye ve "Sadece Haberler" yetkileri.
import fs from 'node:fs';
import { answerDialog, openWide, stepper } from '../lib/arayuz.mjs';
import { makeEvent, sweepEvents } from '../lib/etkinlik.mjs';
import { addTask, makeTeam, sweepStale } from '../lib/takim.mjs';
import { newMember, runTag } from '../lib/uyelik.mjs';

export const meta = { title: 'Sertifikalar: rozetler, sertifika verme modalı, PDF, doğrulama' };

const BADGES = ['ilk-adim', 'mudavim', 'takim-oyuncusu', 'kaptan', 'gorev-avcisi', 'belgeli', 'yapimci', 'yildiz'];

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	await sweepStale(admin);
	await sweepEvents(admin);

	const star = await newMember(t, admin, { label: 'rozet', rolId: fx.roles.uye });
	const peer = await newMember(t, admin, { label: 'akran', rolId: fx.roles.uye });
	const [starApi, peerApi] = await Promise.all([star.api(), peer.api()]);
	const certsOf = async (id) => (await admin.get(`/api/sertifikalar?kullaniciId=${encodeURIComponent(id)}`)).json ?? [];
	t.cleanup(async () => {
		for (const id of [star.id, peer.id]) for (const c of await certsOf(id)) await admin.del(`/api/sertifikalar?id=${encodeURIComponent(c.id)}`);
	});

	const badges = async (page) => {
		const win = await openWide(page, 'certificates');
		await win.locator('[data-badge]').first().waitFor();
		return Object.fromEntries(await win.locator('[data-badge]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-badge'), e.getAttribute('data-earned') === 'yes'])));
	};

	await t.step('yeni üye: sekiz rozet var, hiçbiri kazanılmamış', async () => {
		const { page } = await star.open();
		const got = await badges(page);
		t.sameSet(Object.keys(got), BADGES, 'sekiz rozet');
		t.eq(Object.values(got).filter(Boolean).length, 0, 'hiçbiri kazanılmamış');
		await t.shot(page, 'rozetler-bos');
	});

	const live = [];
	await t.step('rozetler gerçek kayıttan: etkinlik, takım, kaptanlık, görev, proje, XP', async () => {
		// Beş etkinliğe yoklama (İlk Adım + Müdavim).
		for (let i = 0; i < 5; i++) live.push(await makeEvent(t, admin, { label: `Rozet${i}`, startMin: -5, lengthMin: 60 }));
		for (const e of live) await admin.post('/api/etkinlikler', { action: 'manuelYoklama', etkinlikId: e.id, kullaniciId: star.id });
		// Kaptanı olduğu takım (Takım Oyuncusu + Kaptan) ve tamamladığı on görev (Görev Avcısı).
		const team = await makeTeam(t, admin, { label: 'Rozet', liderId: star.id });
		for (let i = 0; i < 10; i++) {
			const g = await addTask(starApi, team.id, { baslik: `Rozet görevi ${i}`, atananUyeId: star.id });
			await starApi.post('/api/takimlar', { action: 'updateTask', gorevId: g.id, durum: 'tamamlandi' });
		}
		// Üyenin önerisi yayınlanınca "Yapımcı".
		const own = await starApi.post('/api/projeler', { baslik: `E2E Rozetim ${runTag()}`, ozet: 'Üyenin kendi yayındaki projesi', repoUrl: 'https://example.com/benim', teknolojiler: 'Go' });
		t.cleanup(() => admin.del(`/api/projeler/${own.json.proje.id}`));
		const { page: before } = await star.open();
		t.eq((await badges(before)).yapimci, false, 'öneri aşamasında "Yapımcı" yok');
		await admin.patch(`/api/projeler/${own.json.proje.id}`, { durum: 'yayinda' });

		const { page } = await star.open();
		const got = await badges(page);
		for (const id of ['ilk-adim', 'mudavim', 'takim-oyuncusu', 'kaptan', 'gorev-avcisi', 'yapimci']) t.eq(got[id], true, `"${id}" kazanıldı`);
		t.eq(got.belgeli, false, 'sertifikasız: "Belgeli" yok');
		// 5×150 + 10×100 = 1750 XP: Kulüp Yıldızı da gelir.
		t.eq(got.yildiz, true, '"Kulüp Yıldızı" (1000 XP) kazanıldı');
		await t.shot(page, 'rozetler-kazanildi');
	});

	const { page: ap } = await t.open('admin');
	const astep = stepper(t, ap);
	const title = `E2E Başarı Belgesi ${runTag()}`;

	await astep('yönetim: modal ile tek üyeye sertifika verir', async () => {
		const win = await openWide(ap, 'certificates');
		await win.getByRole('button', { name: 'Yeni Sertifika Düzenle' }).click();
		const form = ap.locator('[data-cert-issue]');
		await form.locator('select').first().selectOption(star.id);
		await form.locator('input[type=text]').fill(title);
		await form.locator('select').nth(1).selectOption(live[0].id);
		await form.getByRole('button', { name: 'Sertifikayı Onayla & Ver' }).click();
		await form.waitFor({ state: 'detached' });
		const mine = await certsOf(star.id);
		const cert = mine.find((c) => c.baslik === title);
		t.check(Boolean(cert), 'sertifika kayıtlı');
		t.eq(cert?.etkinlikId, live[0].id, 'etkinliğe bağlı');
		t.check(/\S{6,}/.test(cert?.dogrulamaKodu ?? ''), 'doğrulama kodu üretildi');
		await win.getByRole('button', { name: /Tüm Kulüp Sertifikaları/ }).click();
		t.eq(await win.locator(`[data-cert-code="${cert.dogrulamaKodu}"]`).count(), 1, '"Tüm Kulüp Sertifikaları"nda görünüyor');
	});

	await astep('yönetim: etkinlik katılımcılarına toplu sertifika; ikinci kez verilmez', async () => {
		await admin.post('/api/etkinlikler', { action: 'manuelYoklama', etkinlikId: live[1].id, kullaniciId: peer.id });
		const win = await openWide(ap, 'certificates');
		await win.getByRole('button', { name: 'Yeni Sertifika Düzenle' }).click();
		const form = ap.locator('[data-cert-issue]');
		await form.getByRole('button', { name: 'Etkinlik katılımcıları' }).click();
		t.eq(await form.locator('select').count(), 1, 'toplu kipte üye seçimi yok');
		await form.locator('input[type=text]').fill(`E2E Katılım ${runTag()}`);
		await form.locator('select').selectOption(live[1].id);
		await form.getByRole('button', { name: 'Sertifikayı Onayla & Ver' }).click();
		await win.getByText('2 katılımcıya sertifika verildi').waitFor();
		t.eq((await certsOf(peer.id)).length, 1, 'diğer katılımcı da aldı');
		const again = await admin.post('/api/sertifikalar', { action: 'bulk', etkinlikId: live[1].id, baslik: 'Tekrar' });
		t.eq(again.json?.verilen, 0, 'ikinci toplu verme kimseye yeni sertifika vermedi');
		t.eq(again.json?.zatenVar, 2, 'iki kişide zaten var');
	});

	await t.step('üye: sertifikalarım, "Belgeli" rozeti, sertifika sayfası ve vektör PDF', async () => {
		const { page } = await star.open();
		const got = await badges(page);
		t.eq(got.belgeli, true, '"Belgeli" kazanıldı');
		const win = page.locator('[data-window-frame=certificates]');
		const cert = (await starApi.get('/api/sertifikalar')).json.find((c) => c.baslik === title);
		const cardEl = win.locator(`[data-cert-code="${cert.dogrulamaKodu}"]`);
		await cardEl.getByRole('button', { name: 'Görüntüle' }).click();
		const view = page.locator('[data-cert-view]');
		await view.waitFor();
		t.check(await view.getByText(star.adSoyad).count() === 1, 'sertifikada üyenin adı');
		t.check(await view.getByText(title).count() >= 1, 'sertifikada başlık');
		const kulup = (await starApi.get('/api/kulup')).json;
		t.check(await view.getByText(kulup.universite.toLocaleUpperCase('tr-TR')).count() === 1, 'sertifikada Belge Ayarları\'ndaki üniversite (PDF ile aynı)');
		await view.locator('img').first().waitFor();
		const [download] = await Promise.all([page.waitForEvent('download'), view.getByRole('button', { name: 'Vektör PDF İndir' }).click()]);
		t.eq(download.suggestedFilename(), `Sertifika_${cert.dogrulamaKodu}.pdf`, 'PDF dosya adı doğrulama koduyla');
		const pdf = fs.readFileSync(await download.path());
		t.eq(pdf.subarray(0, 5).toString(), '%PDF-', 'gerçek bir PDF');
		t.check(pdf.length > 5000, `PDF boş değil (${pdf.length} bayt)`);
		await t.shot(page, 'sertifika-sayfasi');
	});

	await t.step('herkese açık doğrulama: geçerli kod doğrulanır, uydurma kod reddedilir', async () => {
		const cert = (await certsOf(star.id)).find((c) => c.baslik === title);
		const anon = await t.anonymous();
		const api = await anon.page.request.get(`${t.base}/api/sertifikalar/${cert.dogrulamaKodu}`);
		t.eq(api.status(), 200, 'oturumsuz doğrulama 200');
		t.eq((await api.json()).gecerliMi, true, 'gecerliMi: true');
		t.eq((await anon.page.request.get(`${t.base}/api/sertifikalar/UYDURMA-${runTag()}`)).status(), 404, 'uydurma kod 404');
		await anon.page.goto(`${t.base}/dogrula/${cert.dogrulamaKodu}`);
		await anon.page.getByText('Dijital Sertifika Doğrulandı').waitFor();
		t.check(await anon.page.getByText(star.adSoyad).count() === 1, 'doğrulama sayfasında üyenin adı');
		t.eq((await anon.page.request.get(`${t.base}/api/sertifikalar`)).status(), 401, 'oturumsuz liste 401');
	});

	await t.step('üye yetkisi: sertifika veremez, başkasınınkini listeleyemez; düğme yok', async () => {
		t.eq((await peerApi.post('/api/sertifikalar', { kullaniciId: peer.id, baslik: 'Kendime' })).status, 403, 'üye sertifika veremez');
		const listed = (await peerApi.get(`/api/sertifikalar?kullaniciId=${star.id}`)).json;
		t.check(listed.every((c) => c.kullaniciId === peer.id), 'başkasının kimliği istense de yalnız kendi sertifikaları');
		const someone = (await certsOf(star.id))[0];
		t.eq((await peerApi.del(`/api/sertifikalar?id=${someone.id}`)).status, 403, 'üye iptal edemez');
		const { page } = await peer.open();
		const win = await openWide(page, 'certificates');
		await win.locator('[data-badge]').first().waitFor();
		t.eq(await win.getByRole('button', { name: 'Yeni Sertifika Düzenle' }).count(), 0, '"Yeni Sertifika Düzenle" yok');
		t.eq(await win.getByRole('button', { name: /Tüm Kulüp Sertifikaları/ }).count(), 0, 'kulüp geneli sekmesi yok');
		t.eq(await win.locator('button[title="Sertifikayı İptal Et / Sil"]').count(), 0, 'iptal düğmesi yok');
	});

	await astep('yönetim: sertifikayı iptal eder; doğrulama artık reddeder', async () => {
		const cert = (await certsOf(star.id)).find((c) => c.baslik === title);
		const win = await openWide(ap, 'certificates');
		await ap.reload();
		await ap.locator('[data-window-frame=certificates]').waitFor();
		await win.getByRole('button', { name: /Tüm Kulüp Sertifikaları/ }).click();
		await win.locator(`[data-cert-code="${cert.dogrulamaKodu}"]`).locator('button[title="Sertifikayı İptal Et / Sil"]').click();
		await answerDialog(ap);
		await win.getByText('Sertifika iptal edildi.').waitFor();
		t.eq((await admin.get(`/api/sertifikalar/${cert.dogrulamaKodu}`)).status, 404, 'iptal edilen kod 404');
	});

	await t.step('yetkisiz rol: "Sadece Haberler" sertifikalara ulaşamaz', async () => {
		const okur = await t.api('okur');
		t.eq((await okur.get('/api/sertifikalar')).status, 403, 'GET 403');
		const { page } = await t.open('okur');
		t.eq(await page.locator('[data-dock-app=certificates]').count(), 0, 'Dock\'ta Sertifikalar yok');
	});
}
