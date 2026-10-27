// Kanban (Takımlar → Görev Panosu): görev oluşturma, sürükle-bırak, atama, kontrol listesi,
// yorumlar, etkinlik geçmişi, süzgeçler ve silme. Kaptan ve üye izinleri: kanban-izinler.mjs.
import { answerDialog, dateInput, drag, openTeam, refreshBoard, stepper, toast } from '../lib/arayuz.mjs';
import { makeTeam, addTask, readTeam, readTask, sweepStale, xpOf } from '../lib/takim.mjs';
import { newMember } from '../lib/uyelik.mjs';

export const meta = { title: 'Kanban: görev oluşturma, sürükle-bırak, atama, kontrol listesi, yorumlar' };

const COLUMN = { yapilacak: 'Yapılacak', suruyor: 'Sürüyor', inceleme: 'İncelemede', tamamlandi: 'Tamamlandı' };

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');

	await sweepStale(admin);

	// Kendi takımı: bir kaptan ve görev sahibi bir üye.
	const captain = await newMember(t, admin, { label: 'kaptan', rolId: fx.roles.uye });
	const worker = await newMember(t, admin, { label: 'uye', rolId: fx.roles.uye });
	const team = await makeTeam(t, admin, { label: 'Kanban', liderId: captain.id });
	await (await worker.api()).post('/api/takimlar', { action: 'join', takimId: team.id });

	const { page } = await t.open('admin');
	const win = await openTeam(page, team.id);
	const step = stepper(t, page);
	const card = (title) => win.locator('[data-task-id]').filter({ hasText: title });
	const column = (id) => win.locator(`section[aria-label="${COLUMN[id]}"]`);
	const tasksOf = async () => (await readTeam(admin, team.id)).gorevler;
	const byTitle = async (title) => (await tasksOf()).find((g) => g.baslik === title);

	await step('boş pano: dört sütun, sayaçlar sıfır', async () => {
		t.sameSet(await win.locator('section[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))), Object.values(COLUMN), 'dört sütun var');
		t.eq(await win.locator('[data-task-id]').count(), 0, 'pano boş');
		t.check(await win.getByText('Görev yok').count() === 4, 'her sütun "Görev yok" diyor');
		await t.shot(page, 'bos-pano');
	});

	const title = `Kanban görevi ${Date.now().toString(36)}`;
	await step('"Yeni Görev" formundan görev oluşturma (açıklama, öncelik, atama, teslim, etiket)', async () => {
		await win.getByRole('button', { name: 'Yeni Görev' }).click();
		const dlg = page.getByRole('dialog', { name: 'Yeni Görev' });
		await dlg.getByLabel('Başlık').fill(title);
		await dlg.getByLabel('Açıklama').fill('Kabul ölçütleri burada.');
		await dlg.getByLabel('Atanan').selectOption(worker.id);
		await dlg.getByLabel('Teslim').fill(dateInput(5));
		await dlg.getByRole('radio', { name: 'Yüksek' }).click();
		const labels = dlg.getByPlaceholder(/Etiket yazıp/);
		await labels.fill('Ön Yüz');
		await labels.press('Enter');
		await dlg.getByRole('button', { name: 'Görevi Oluştur' }).click();
		await dlg.waitFor({ state: 'detached' });
		await card(title).waitFor();
		const stored = await byTitle(title);
		t.check(Boolean(stored), 'görev API\'de kayıtlı');
		t.eq(stored?.durum, 'yapilacak', 'ilk sütun: Yapılacak');
		t.eq(stored?.oncelik, 'yuksek', 'öncelik Yüksek');
		t.eq(stored?.atananUyeId, worker.id, 'atanan üye');
		t.eq(stored?.etiketler, ['ön-yüz'], 'etiket küçük harfe ve tireye çevrildi');
		t.check(stored?.teslimTarihi > Date.now(), 'teslim tarihi ileride');
		t.check(Boolean(stored?.olusturanId), 'oluşturan kayıtlı');
		t.check(await card(title).getByText('#ön-yüz').count() === 1, 'kartta etiket görünüyor');
		t.check(await card(title).getByText('Yüksek').count() === 1, 'kartta öncelik rozeti');
		t.check(await column('yapilacak').locator('[data-task-id]').filter({ hasText: title }).count() === 1, 'kart Yapılacak sütununda');
		await t.shot(page, 'gorev-olustu');
	});

	await step('boş başlıkla görev oluşturulamaz', async () => {
		await win.getByRole('button', { name: 'Yeni Görev' }).click();
		const dlg = page.getByRole('dialog', { name: 'Yeni Görev' });
		t.check(await dlg.getByRole('button', { name: 'Görevi Oluştur' }).isDisabled(), '"Görevi Oluştur" başlık yokken kapalı');
		await dlg.getByRole('button', { name: 'Vazgeç' }).click();
		await dlg.waitFor({ state: 'detached' });
	});

	const doingTitle = `Sürüyor sütunundan ${Date.now().toString(36)}`;
	await step('sütundaki "+" düğmesi görevi o sütunda açar; atanmamış görev havuza düşer', async () => {
		await column('suruyor').getByRole('button', { name: 'Bu sütuna ekle' }).click();
		const dlg = page.getByRole('dialog', { name: 'Yeni Görev' });
		t.eq(await dlg.getByLabel('Sütun').inputValue(), 'suruyor', 'sütun seçimi "Sürüyor"');
		t.check(await dlg.getByText('Atanmamış görevleri takımdaki herkes üstlenebilir.').count() === 1, 'havuz ipucu görünüyor');
		await dlg.getByLabel('Başlık').fill(doingTitle);
		await dlg.getByRole('button', { name: 'Görevi Oluştur' }).click();
		await dlg.waitFor({ state: 'detached' });
		await card(doingTitle).waitFor();
		const stored = await byTitle(doingTitle);
		t.eq(stored?.durum, 'suruyor', 'görev Sürüyor sütununda saklandı');
		t.eq(stored?.atananUyeId, null, 'atanan yok (havuz)');
	});

	await step('sürükle-bırak: kart başka sütuna taşınır ve kalıcı olur', async () => {
		await drag(page, card(title), column('inceleme'));
		await column('inceleme').locator('[data-task-id]').filter({ hasText: title }).waitFor();
		const ok = await t.waitFor(async () => (await byTitle(title))?.durum === 'inceleme');
		t.check(ok >= 0, 'sunucuda durum "inceleme" oldu');
		await refreshBoard(page);
		t.check(await column('inceleme').locator('[data-task-id]').filter({ hasText: title }).count() === 1, 'sunucudan yeniden okununca kart hâlâ İncelemede');
		await t.shot(page, 'surukle-birak');
	});

	await step('sürükle-bırak: aynı sütunda sıralama değişir', async () => {
		const a = await addTask(admin, team.id, { baslik: `Sıra A ${Date.now().toString(36)}`, durum: 'tamamlandi' });
		const b = await addTask(admin, team.id, { baslik: `Sıra B ${Date.now().toString(36)}`, durum: 'tamamlandi' });
		await refreshBoard(page);
		const col = column('tamamlandi');
		await col.locator(`[data-task-id="${a.id}"]`).waitFor();
		const order = async () => col.locator('[data-task-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-task-id')));
		const before = await order();
		const [first, second] = before.filter((id) => id === a.id || id === b.id);
		// İkincisini birincinin üstüne bırak.
		const target = col.locator(`[data-task-id="${first}"]`);
		const box = await target.boundingBox();
		await drag(page, col.locator(`[data-task-id="${second}"]`), target, { x: box.width / 2, y: 4 });
		const moved = await t.waitFor(async () => (await order()).filter((id) => id === a.id || id === b.id)[0] === second);
		t.check(moved >= 0, 'ekranda sıra değişti');
		// Pano iyimser günceller (ekran önce, istek sonra): sunucudaki durum için kaydın inmesi beklenir.
		let stored = await tasksOf();
		const sira = (id) => stored.find((g) => g.id === id)?.sira;
		await t.waitFor(async () => {
			stored = await tasksOf();
			return sira(second) < sira(first);
		}, { timeout: 5000, every: 150 });
		t.check(sira(second) < sira(first), 'sunucudaki "sira" da değişti', `${sira(second)} < ${sira(first)}`);
		await admin.post('/api/takimlar', { action: 'deleteTask', gorevId: a.id });
		await admin.post('/api/takimlar', { action: 'deleteTask', gorevId: b.id });
	});

	await step('ok düğmeleri ve Alt+ok: bir sütun sola/sağa', async () => {
		const target = card(title);
		await target.hover();
		await target.getByRole('button', { name: 'Önceki sütuna taşı' }).click();
		await column('suruyor').locator('[data-task-id]').filter({ hasText: title }).waitFor();
		await t.waitFor(async () => (await byTitle(title))?.durum === 'suruyor', { timeout: 5000, every: 150 });
		t.eq((await byTitle(title))?.durum, 'suruyor', 'sola düğmesi: Sürüyor');
		await card(title).focus();
		await page.keyboard.press('Alt+ArrowRight');
		await column('inceleme').locator('[data-task-id]').filter({ hasText: title }).waitFor();
		await t.waitFor(async () => (await byTitle(title))?.durum === 'inceleme', { timeout: 5000, every: 150 });
		t.eq((await byTitle(title))?.durum, 'inceleme', 'Alt+→: İncelemede');
	});

	await step('görev sayfası: ayrıntılar, atama değiştirme ve etkinlik geçmişi', async () => {
		await card(title).click();
		const sheet = page.getByRole('dialog', { name: title });
		await sheet.waitFor();
		t.check(await sheet.getByText('Kabul ölçütleri burada.').count() === 1, 'açıklama görünüyor');
		const assignee = sheet.locator('aside select').nth(1);
		await assignee.selectOption('');
		await t.waitFor(async () => (await byTitle(title))?.atananUyeId === null);
		t.eq((await byTitle(title))?.atananUyeId, null, 'atama kaldırıldı');
		await assignee.selectOption(captain.id);
		await t.waitFor(async () => (await byTitle(title))?.atananUyeId === captain.id);
		t.eq((await byTitle(title))?.atananUyeId, captain.id, 'görev kaptana atandı');
		const log = await sheet.locator('ul li').allInnerTexts();
		t.check(log.some((l) => /taşıdı/.test(l)), 'geçmişte taşıma var', log.join(' | '));
		t.check(log.some((l) => /atad/.test(l) || /atamayı kaldırdı/.test(l)), 'geçmişte atama var', log.join(' | '));
		await t.shot(page, 'gorev-sayfasi');
		await sheet.getByRole('button', { name: 'Kapat' }).click();
	});

	await step('görev sayfası: başlık, açıklama, öncelik, etiket ve teslim düzenleme', async () => {
		await card(title).click();
		const sheet = page.getByRole('dialog', { name: title });
		await sheet.waitFor();
		await sheet.getByRole('radio', { name: 'Kritik' }).click();
		await t.waitFor(async () => (await byTitle(title))?.oncelik === 'kritik');
		t.eq((await byTitle(title))?.oncelik, 'kritik', 'öncelik Kritik oldu');
		const label = sheet.getByPlaceholder(/Etiket yazıp/);
		await label.fill('acil');
		await label.press('Enter');
		await t.waitFor(async () => (await byTitle(title))?.etiketler.includes('acil'));
		t.includes((await byTitle(title)).etiketler, 'acil', 'etiket eklendi');
		await sheet.getByRole('button', { name: 'ön-yüz ×' }).click();
		await t.waitFor(async () => !(await byTitle(title))?.etiketler.includes('ön-yüz'));
		t.eq((await byTitle(title)).etiketler, ['acil'], 'etiket kaldırıldı');
		await sheet.getByRole('button', { name: 'Düzenle' }).click();
		await sheet.locator('textarea').first().fill('Yeni açıklama metni.');
		await sheet.getByRole('button', { name: 'Kaydet' }).click();
		await t.waitFor(async () => (await byTitle(title))?.aciklama === 'Yeni açıklama metni.');
		t.eq((await byTitle(title)).aciklama, 'Yeni açıklama metni.', 'açıklama kaydedildi');
		const due = sheet.locator('input[type=date]');
		await due.fill(dateInput(9));
		await t.waitFor(async () => (await byTitle(title))?.teslimTarihi > Date.now() + 8 * 86_400_000);
		t.check((await byTitle(title)).teslimTarihi > Date.now() + 8 * 86_400_000, 'teslim tarihi güncellendi');
		await sheet.getByRole('button', { name: 'Kapat' }).click();
	});

	await step('kontrol listesi: ekleme, işaretleme, kart sayacı, silme', async () => {
		await card(title).click();
		const sheet = page.getByRole('dialog', { name: title });
		await sheet.waitFor();
		const input = sheet.getByPlaceholder('Yeni madde ekle…');
		for (const text of ['Taslağı çiz', 'Kodla', 'Gözden geçir']) {
			await input.fill(text);
			await sheet.getByRole('button', { name: 'Ekle', exact: true }).click();
			await sheet.getByText(text, { exact: true }).waitFor();
		}
		t.eq(await sheet.locator('input[type=checkbox]').count(), 3, 'üç madde');
		await sheet.locator('input[type=checkbox]').nth(0).check();
		await sheet.locator('input[type=checkbox]').nth(1).check();
		const detail = async () => (await readTask(admin, (await byTitle(title)).id)).json;
		await t.waitFor(async () => (await detail()).maddeler.filter((m) => Number(m.tamamMi) === 1).length === 2);
		const d = await detail();
		t.eq(d.maddeler.filter((m) => Number(m.tamamMi) === 1).length, 2, 'iki madde sunucuda tamam');
		t.check(await sheet.getByText('2/3').count() >= 1, 'sayfada 2/3');
		await sheet.locator('label').filter({ hasText: 'Gözden geçir' }).getByRole('button', { name: 'Sil', exact: true }).click();
		await t.waitFor(async () => (await detail()).maddeler.length === 2);
		t.eq((await detail()).maddeler.length, 2, 'madde silindi');
		await sheet.getByRole('button', { name: 'Kapat' }).click();
		t.check(await card(title).getByText(/\d\/2/).count() === 1, 'kart yüzünde madde sayacı (x/2)');
		const gelen = (await detail()).aktivite.map((a) => a.tur);
		t.includes(gelen, 'madde_eklendi', 'geçmişte madde_eklendi');
		t.includes(gelen, 'madde_tamamlandi', 'geçmişte madde_tamamlandi');
	});

	await step('yorumlar: yazma, sayaç, kendi yorumunu silme', async () => {
		await card(title).click();
		const sheet = page.getByRole('dialog', { name: title });
		await sheet.waitFor();
		t.check(await sheet.getByText('Henüz yorum yok.').count() === 1, 'başta yorum yok');
		const box = sheet.getByPlaceholder(/Yorum yazın/);
		await box.fill('İlk yorum');
		await sheet.getByRole('button', { name: 'Gönder' }).click();
		await sheet.locator('[data-comment-id]').filter({ hasText: 'İlk yorum' }).waitFor();
		await box.fill('İkinci yorum');
		// Typed while the first comment is still being saved: the text must survive that save
		// (it used to be wiped). A send while busy is ignored, so wait for the button.
		t.check((await t.waitFor(() => sheet.getByRole('button', { name: 'Gönder' }).isEnabled())) >= 0, 'ilk yorum kaydedilirken yazılan metin silinmedi');
		await box.press('Control+Enter');
		await sheet.locator('[data-comment-id]').filter({ hasText: 'İkinci yorum' }).waitFor();
		const detail = async () => (await readTask(admin, (await byTitle(title)).id)).json;
		t.eq((await detail()).yorumlar.length, 2, 'iki yorum kayıtlı');
		await sheet.locator('[data-comment-id]').filter({ hasText: 'İlk yorum' }).getByRole('button', { name: 'Sil', exact: true }).click();
		await answerDialog(page);
		await t.waitFor(async () => (await detail()).yorumlar.length === 1);
		t.eq((await detail()).yorumlar.length, 1, 'yorum silindi');
		await sheet.getByRole('button', { name: 'Kapat' }).click();
		t.check(await card(title).locator('[title="Yorumlar"]').count() === 1, 'kartta yorum sayacı');
	});

	await step('görevi tamamlama +100 XP verir (bir kez)', async () => {
		const mine = await addTask(admin, team.id, { baslik: `XP görevi ${Date.now().toString(36)}`, atananUyeId: worker.id });
		const api = await worker.api();
		const before = await xpOf(api);
		await refreshBoard(page);
		await card(mine.baslik).waitFor();
		await drag(page, card(mine.baslik), column('tamamlandi'));
		await toast(page, '+100 XP');
		t.eq(await xpOf(api), before + 100, 'görev sahibi 100 XP kazandı');
		// Geri alıp yeniden tamamlamak ikinci kez XP vermez.
		await admin.post('/api/takimlar', { action: 'updateTask', gorevId: mine.id, durum: 'suruyor' });
		const again = await admin.post('/api/takimlar', { action: 'updateTask', gorevId: mine.id, durum: 'tamamlandi' });
		t.eq(again.json?.xpVerildi, false, 'ikinci tamamlamada XP verilmedi');
		t.eq(await xpOf(api), before + 100, 'XP değişmedi');
	});

	await step('süzgeçler: arama, "Benim", "Atanmamış", öncelik, etiket, sıralama', async () => {
		await win.getByPlaceholder('Görevlerde ara…').fill(doingTitle);
		t.eq(await win.locator('[data-task-id]').count(), 1, 'aramada tek kart');
		await win.getByPlaceholder('Görevlerde ara…').fill('hiçbir-görev-bunu-içermez');
		t.check(await win.getByText('Filtreye uyan görev yok.').count() === 1, 'eşleşme yoksa uyarı');
		await win.getByRole('button', { name: 'Filtreleri temizle' }).click();
		t.check(await win.locator('[data-task-id]').count() >= 3, 'filtre temizlenince kartlar geri geldi');
		await win.getByRole('button', { name: 'Atanmamış', exact: true }).click();
		t.check(await win.locator('[data-task-id]').filter({ hasText: doingTitle }).count() === 1, 'Atanmamış: havuzdaki görev var');
		t.eq(await win.locator('[data-task-id]').filter({ hasText: title }).count(), 0, 'Atanmamış: kaptana atanmış görev gizli');
		await win.getByRole('button', { name: 'Tümü', exact: true }).click();
		await win.getByLabel('Öncelik').selectOption('kritik');
		t.check(await win.locator('[data-task-id]').filter({ hasText: title }).count() === 1, 'Kritik süzgeci: ilgili görev görünüyor');
		t.eq(await win.locator('[data-task-id]').filter({ hasText: doingTitle }).count(), 0, 'Kritik süzgeci: diğerleri gizli');
		await win.getByLabel('Öncelik').selectOption('');
		await win.getByLabel('Etiketler').selectOption('acil');
		t.eq(await win.locator('[data-task-id]').count(), 1, 'Etiket süzgeci: tek kart');
		await win.getByLabel('Etiketler').selectOption('');
		await win.getByLabel('Sort').selectOption('priority');
		const order = await column('inceleme').locator('[data-task-id]').allInnerTexts();
		t.check(order.length >= 1, 'öncelik sıralamasında kartlar duruyor');
		await win.getByLabel('Sort').selectOption('manual');
	});

	await step('görev silme: onay isteniyor, silinince kart ve kayıt gider', async () => {
		const victim = await addTask(admin, team.id, { baslik: `Silinecek ${Date.now().toString(36)}` });
		await refreshBoard(page);
		await card(victim.baslik).click();
		const sheet = page.getByRole('dialog', { name: victim.baslik });
		await sheet.getByRole('button', { name: 'Görevi Sil' }).click();
		await answerDialog(page, false);
		t.check(await byTitle(victim.baslik) !== undefined, 'vazgeçince görev duruyor');
		await sheet.getByRole('button', { name: 'Görevi Sil' }).click();
		await answerDialog(page);
		await sheet.waitFor({ state: 'detached' });
		t.eq(await card(victim.baslik).count(), 0, 'kart panodan kalktı');
		t.eq(await byTitle(victim.baslik), undefined, 'kayıt silindi');
	});

	await step('yetkisiz rol: "Sadece Haberler" kullanıcısı takımları ve görevleri göremez', async () => {
		const okur = await t.api('okur');
		const list = await okur.get('/api/takimlar');
		t.eq(list.status, 403, 'GET /api/takimlar 403');
		const task = (await tasksOf())[0];
		const detail = await readTask(okur, task.id);
		t.eq(detail.status, 403, 'görev ayrıntısı 403');
		const add = await okur.post('/api/takimlar', { action: 'addTask', takimId: team.id, baslik: 'sızma' });
		t.eq(add.status, 403, 'görev ekleme 403');
		const { page: okurPage } = await t.open('okur');
		t.eq(await okurPage.locator('[data-dock-app=teams]').count(), 0, 'Dock\'ta Takımlar yok');
	});
}
