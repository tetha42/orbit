// Kanban izinleri: kaptan panoyu yönetir; üye yalnız kendi görevini taşır/işaretler, havuzdan
// görev üstlenir, herkesin görevine yorum yazar; takım dışındaki üye panoyu görmez; başka
// takımın kaptanı bu takımın görevine dokunamaz; mezun salt okur.
import { drag, openTeam, refreshBoard, stepper } from '../lib/arayuz.mjs';
import { addTask, makeTeam, readTask, readTeam, sweepStale } from '../lib/takim.mjs';
import { newMember } from '../lib/uyelik.mjs';

export const meta = { title: 'Kanban: kaptan ve üye izinleri' };

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	await sweepStale(admin);

	const uye = fx.roles.uye;
	const captain = await newMember(t, admin, { label: 'kaptan', rolId: uye });
	const ali = await newMember(t, admin, { label: 'ali', rolId: uye });
	const bek = await newMember(t, admin, { label: 'bek', rolId: uye });
	const outsider = await newMember(t, admin, { label: 'disarida', rolId: uye });
	const captain2 = await newMember(t, admin, { label: 'kaptan2', rolId: uye });
	const team = await makeTeam(t, admin, { label: 'Izin', liderId: captain.id });
	const team2 = await makeTeam(t, admin, { label: 'Izin2', liderId: captain2.id });
	const [aliApi, bekApi, outApi, cap2Api, capApi] = await Promise.all([ali.api(), bek.api(), outsider.api(), captain2.api(), captain.api()]);
	await aliApi.post('/api/takimlar', { action: 'join', takimId: team.id });
	await bekApi.post('/api/takimlar', { action: 'join', takimId: team.id });

	const aliTask = await addTask(capApi, team.id, { baslik: `Ali görevi ${Date.now().toString(36)}`, atananUyeId: ali.id });
	const bekTask = await addTask(capApi, team.id, { baslik: `Bek görevi ${Date.now().toString(36)}`, atananUyeId: bek.id });
	const poolTask = await addTask(capApi, team.id, { baslik: `Havuz görevi ${Date.now().toString(36)}` });
	const durumOf = async (id) => (await readTeam(admin, team.id)).gorevler.find((g) => g.id === id)?.durum;

	await t.step('kaptan (API): görev ekler, atar, başkasının görevini taşır ve siler', async () => {
		const extra = await addTask(capApi, team.id, { baslik: 'Kaptanın geçici görevi', atananUyeId: bek.id });
		t.eq(extra.atananUyeId, bek.id, 'kaptan görevi takım üyesine atadı');
		t.eq((await capApi.post('/api/takimlar', { action: 'updateTask', gorevId: extra.id, durum: 'suruyor' })).status, 200, 'kaptan başkasının görevini taşıdı');
		t.eq((await capApi.patch(`/api/takimlar/gorevler/${extra.id}`, { baslik: 'Yeni ad', oncelik: 'kritik' })).status, 200, 'kaptan başlık/öncelik değiştirdi');
		const outsiderAssign = await capApi.post('/api/takimlar', { action: 'addTask', takimId: team.id, baslik: 'dışarıya', atananUyeId: outsider.id });
		t.eq(outsiderAssign.status, 400, 'takım dışındaki üyeye görev atanamaz (400)');
		t.eq((await capApi.post('/api/takimlar', { action: 'deleteTask', gorevId: extra.id })).status, 200, 'kaptan görevi sildi');
	});

	await t.step('kaptan (arayüz): "Yeni Görev", sütun "+" ve Ayarlar sekmesi var; kartı sürükler', async () => {
		const { page } = await captain.open();
		const win = await openTeam(page, team.id);
		t.eq(await win.getByRole('button', { name: 'Yeni Görev' }).count(), 1, '"Yeni Görev" düğmesi var');
		t.eq(await win.getByRole('button', { name: 'Bu sütuna ekle' }).count(), 4, 'her sütunda "+" var');
		t.check(await win.locator('nav').getByText('Ayarlar').count() === 1, 'Ayarlar sekmesi var');
		t.eq(await win.locator(`[data-task-id="${bekTask.id}"]`).getAttribute('draggable'), 'true', 'başkasının kartı kaptan için sürüklenebilir');
		await drag(page, win.locator(`[data-task-id="${bekTask.id}"]`), win.locator('section[aria-label="Sürüyor"]'));
		await t.waitFor(async () => (await durumOf(bekTask.id)) === 'suruyor');
		t.eq(await durumOf(bekTask.id), 'suruyor', 'kaptan Bek\'in görevini sürükledi');
		await t.shot(page, 'kaptan-pano');
	});

	await t.step('üye (arayüz): ekleme düğmeleri yok; yalnız kendi kartı sürüklenebilir', async () => {
		const { page } = await ali.open();
		const win = await openTeam(page, team.id);
		t.eq(await win.getByRole('button', { name: 'Yeni Görev' }).count(), 0, '"Yeni Görev" yok');
		t.eq(await win.getByRole('button', { name: 'Bu sütuna ekle' }).count(), 0, 'sütun "+" düğmeleri yok');
		t.check(await win.getByText('Görev eklemek kaptan ve yönetime açıktır.').count() === 1, 'yalnız kaptan/yönetim ipucu');
		t.eq(await win.locator('nav').getByText('Ayarlar').count(), 0, 'Ayarlar sekmesi yok');
		t.eq(await win.locator('nav').getByText('Proje Kasası').count(), 0, 'Proje Kasası sekmesi yok');
		t.eq(await win.locator(`[data-task-id="${aliTask.id}"]`).getAttribute('draggable'), 'true', 'kendi kartı sürüklenebilir');
		t.eq(await win.locator(`[data-task-id="${bekTask.id}"]`).getAttribute('draggable'), 'false', 'başkasının kartı sürüklenemez');
		t.eq(await win.locator(`[data-task-id="${bekTask.id}"]`).getByRole('button', { name: /sütuna taşı/ }).count(), 0, 'başkasının kartında taşıma okları yok');
		// Başkasının kartını sürüklemeye çalışmak hiçbir şey değiştirmez.
		await drag(page, win.locator(`[data-task-id="${bekTask.id}"]`), win.locator('section[aria-label="İncelemede"]'));
		await page.waitForTimeout(500);
		t.eq(await durumOf(bekTask.id), 'suruyor', 'başkasının görevi yerinde kaldı');
		await drag(page, win.locator(`[data-task-id="${aliTask.id}"]`), win.locator('section[aria-label="İncelemede"]'));
		await t.waitFor(async () => (await durumOf(aliTask.id)) === 'inceleme');
		t.eq(await durumOf(aliTask.id), 'inceleme', 'kendi görevini sürükledi');
		await t.shot(page, 'uye-pano');
	});

	await t.step('üye (arayüz): kendi görevinde liste ve açıklama açık, başlık/öncelik/teslim/atama kapalı, silme yok', async () => {
		const { page } = await ali.open();
		const win = await openTeam(page, team.id);
		const step = stepper(t, page);
		await step('kendi görevi', async () => {
			await win.locator(`[data-task-id="${aliTask.id}"]`).click();
			const sheet = page.getByRole('dialog', { name: aliTask.baslik });
			await sheet.waitFor();
			t.check(await sheet.getByLabel('Başlık').isDisabled(), 'başlık kutusu kapalı');
			t.check(await sheet.getByRole('radio', { name: 'Kritik' }).isDisabled(), 'öncelik seçimi kapalı');
			t.check(await sheet.locator('input[type=date]').isDisabled(), 'teslim tarihi kapalı');
			t.eq(await sheet.locator('aside select').count(), 1, 'atama seçimi yok (yalnız durum seçimi)');
			t.eq(await sheet.getByRole('button', { name: 'Görevi Sil' }).count(), 0, '"Görevi Sil" yok');
			const input = sheet.getByPlaceholder('Yeni madde ekle…');
			await input.fill('Benim maddem');
			await sheet.getByRole('button', { name: 'Ekle', exact: true }).click();
			await sheet.getByText('Benim maddem', { exact: true }).waitFor();
			await sheet.locator('input[type=checkbox]').first().check();
			await t.waitFor(async () => (await readTask(aliApi, aliTask.id)).json.maddeler.some((m) => Number(m.tamamMi) === 1));
			t.check((await readTask(aliApi, aliTask.id)).json.maddeler.some((m) => Number(m.tamamMi) === 1), 'üye kendi listesini işaretledi');
			await sheet.getByRole('button', { name: 'Düzenle' }).click();
			await sheet.locator('textarea').first().fill('Ali açıklamayı güncelledi.');
			await sheet.getByRole('button', { name: 'Kaydet' }).click();
			await t.waitFor(async () => (await readTask(aliApi, aliTask.id)).json.gorev.aciklama === 'Ali açıklamayı güncelledi.');
			t.eq((await readTask(aliApi, aliTask.id)).json.gorev.aciklama, 'Ali açıklamayı güncelledi.', 'üye kendi görevinin açıklamasını değiştirdi');
		});
		await step('başkasının görevi: salt okunur, ama yorum yazılabilir', async () => {
			await win.locator(`[data-task-id="${bekTask.id}"]`).click();
			const sheet = page.getByRole('dialog', { name: bekTask.baslik });
			await sheet.waitFor();
			t.check(await sheet.getByText('Bu görevi yalnızca görüntüleyebilirsiniz.').count() === 1, '"yalnızca görüntüleyebilirsiniz" uyarısı');
			t.eq(await sheet.getByPlaceholder('Yeni madde ekle…').count(), 0, 'kontrol listesine ekleme yok');
			t.check(await sheet.locator('aside select').first().isDisabled(), 'durum seçimi kapalı');
			await sheet.getByPlaceholder(/Yorum yazın/).fill('Ali\'den soru');
			await sheet.getByRole('button', { name: 'Gönder' }).click();
			await sheet.locator('[data-comment-id]').filter({ hasText: 'Ali\'den soru' }).waitFor();
			t.check((await readTask(bekApi, bekTask.id)).json.yorumlar.some((y) => y.icerik === 'Ali\'den soru'), 'üye başkasının görevine yorum yazdı');
		});
		await step('havuzdaki görevi üstlenme', async () => {
			await win.locator(`[data-task-id="${poolTask.id}"]`).click();
			const sheet = page.getByRole('dialog', { name: poolTask.baslik });
			await sheet.getByRole('button', { name: 'Görevi Üstlen' }).click();
			await t.waitFor(async () => (await readTask(aliApi, poolTask.id)).json.gorev.atananUyeId === ali.id);
			t.eq((await readTask(aliApi, poolTask.id)).json.gorev.atananUyeId, ali.id, 'havuz görevi üyeye geçti');
			await t.waitFor(async () => (await sheet.getByRole('button', { name: 'Görevi Üstlen' }).count()) === 0);
			t.eq(await sheet.getByRole('button', { name: 'Görevi Üstlen' }).count(), 0, '"Görevi Üstlen" düğmesi kalktı');
		});
	});

	await t.step('üye (API): yetkisi olmayan yazma işlemleri 403', async () => {
		t.eq((await aliApi.post('/api/takimlar', { action: 'addTask', takimId: team.id, baslik: 'izinsiz' })).status, 403, 'görev ekleyemez');
		t.eq((await aliApi.post('/api/takimlar', { action: 'updateTask', gorevId: bekTask.id, durum: 'tamamlandi' })).status, 403, 'başkasının görevini taşıyamaz');
		t.eq((await aliApi.post('/api/takimlar', { action: 'deleteTask', gorevId: aliTask.id })).status, 403, 'kendi görevini bile silemez');
		t.eq((await aliApi.patch(`/api/takimlar/gorevler/${aliTask.id}`, { baslik: 'değişti' })).status, 403, 'kendi görevinin başlığını değiştiremez');
		t.eq((await aliApi.patch(`/api/takimlar/gorevler/${aliTask.id}`, { atananUyeId: bek.id })).status, 403, 'kendi görevini başkasına aktaramaz');
		t.eq((await aliApi.patch(`/api/takimlar/gorevler/${bekTask.id}`, { atananUyeId: ali.id })).status, 403, 'başkasına atanmış görevi üstlenemez');
		t.eq((await aliApi.post(`/api/takimlar/gorevler/${bekTask.id}`, { action: 'addItem', metin: 'x' })).status, 403, 'başkasının listesine madde ekleyemez');
		const bekComment = (await bekApi.post(`/api/takimlar/gorevler/${bekTask.id}`, { action: 'addComment', icerik: 'Bek yazdı' })).json.yorum;
		t.eq((await aliApi.post(`/api/takimlar/gorevler/${bekTask.id}`, { action: 'deleteComment', yorumId: bekComment.id })).status, 403, 'başkasının yorumunu silemez');
		t.eq((await capApi.post(`/api/takimlar/gorevler/${bekTask.id}`, { action: 'deleteComment', yorumId: bekComment.id })).status, 200, 'kaptan yorumu silebilir (moderasyon)');
		t.eq((await aliApi.post('/api/takimlar', { action: 'updateTeam', takimId: team.id, aciklama: 'Üye takım ayarını değiştiremez.' })).status, 403, 'takım ayarlarını değiştiremez');
	});

	await t.step('takım dışındaki üye: pano kilitli, görevler gizli (404)', async () => {
		const list = await readTeam(outApi, team.id);
		t.eq(list.gorevler, [], 'takım listesinde görev yok');
		t.eq((await readTask(outApi, aliTask.id)).status, 404, 'görev ayrıntısı 404');
		t.eq((await outApi.post(`/api/takimlar/gorevler/${aliTask.id}`, { action: 'addComment', icerik: 'sızma' })).status, 404, 'yorum yazamaz (404)');
		t.eq((await outApi.post('/api/takimlar', { action: 'updateTask', gorevId: aliTask.id, durum: 'tamamlandi' })).status, 403, 'görev taşıyamaz');
		const { page } = await outsider.open();
		const win = await openTeam(page, team.id);
		await win.getByText('Takım alanı üyelere özel').waitFor();
		t.eq(await win.locator('[data-task-id]').count(), 0, 'kilit ekranında kart yok');
		await t.shot(page, 'takim-disi-kilit');
	});

	await t.step('başka takımın kaptanı bu takımın görevini silemez ve taşıyamaz', async () => {
		t.eq((await cap2Api.post('/api/takimlar', { action: 'deleteTask', gorevId: aliTask.id, takimId: team2.id })).status, 403, 'deleteTask (gövdede kendi takımı) 403');
		t.eq((await cap2Api.post('/api/takimlar', { action: 'updateTask', gorevId: aliTask.id, durum: 'tamamlandi' })).status, 403, 'updateTask 403');
		t.eq((await cap2Api.patch(`/api/takimlar/gorevler/${aliTask.id}`, { baslik: 'ele geçirildi' })).status, 404, 'PATCH 404 (görünmüyor)');
		t.check((await readTask(admin, aliTask.id)).status === 200, 'görev yerinde');
	});

	await t.step('mezun üye: panoyu okur, yazamaz', async () => {
		t.eq((await admin.patch('/api/uyeler', { id: ali.id, durum: 'mezun' })).status, 200, 'üye mezun yapıldı');
		try {
			t.eq((await readTask(aliApi, aliTask.id)).status, 200, 'mezun görevi okuyabiliyor');
			t.eq((await aliApi.post(`/api/takimlar/gorevler/${aliTask.id}`, { action: 'addComment', icerik: 'mezun' })).status, 403, 'mezun yorum yazamaz');
			t.eq((await aliApi.post('/api/takimlar', { action: 'updateTask', gorevId: aliTask.id, durum: 'tamamlandi' })).status, 403, 'mezun görev taşıyamaz');
		} finally {
			await admin.patch('/api/uyeler', { id: ali.id, durum: 'aktif' });
		}
	});

	await t.step('yetkisiz rol: "Sadece Haberler" panoya ulaşamaz', async () => {
		const okur = await t.api('okur');
		t.eq((await readTask(okur, aliTask.id)).status, 403, 'görev ayrıntısı 403');
		t.eq((await okur.post('/api/takimlar', { action: 'join', takimId: team.id })).status, 403, 'takıma katılamaz');
	});

	await t.step('menü: üye "Yeni Görev Ekle" deyince açıklayıcı hata alır', async () => {
		const { page } = await bek.open();
		await openTeam(page, team.id);
		await refreshBoard(page);
		await page.locator('[data-menubar-category=file]').click();
		await page.locator('[data-menu-item=new-task]').click();
		await page.locator('[role=status] > div').filter({ hasText: 'kaptana veya yönetime' }).waitFor();
		t.eq(await page.getByRole('dialog', { name: 'Yeni Görev' }).count(), 0, 'görev formu açılmadı');
	});
}
