// Proje Vitrini: üyenin önerisi → yönetim onayı/yayın, yıldız, öne çıkarma, arşiv,
// yayından geri alma, silme; öneri sahibi dışında kimseye görünmez; yetkisiz roller.
import { answerDialog, openWide, stepper, toast } from '../lib/arayuz.mjs';
import { makeTeam, sweepStale } from '../lib/takim.mjs';
import { newMember, runTag } from '../lib/uyelik.mjs';

export const meta = { title: 'Projeler: öneri → onay/yayın, yıldız, arşiv, öne çıkarma' };

/** Projects named "E2E …" left by a killed run. */
async function sweepProjects(admin) {
	for (const p of (await admin.get('/api/projeler')).json?.projeler ?? []) {
		if (/^E2E /.test(p.baslik)) await admin.del(`/api/projeler/${encodeURIComponent(p.id)}`);
	}
}

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	await sweepStale(admin);
	await sweepProjects(admin);

	const author = await newMember(t, admin, { label: 'yazar', rolId: fx.roles.uye });
	const fan = await newMember(t, admin, { label: 'hayran', rolId: fx.roles.uye });
	const [authorApi, fanApi] = await Promise.all([author.api(), fan.api()]);
	const team = await makeTeam(t, admin, { label: 'Proje', liderId: author.id });
	const other = await makeTeam(t, admin, { label: 'Baska', liderId: fan.id });

	const title = `E2E Proje ${runTag()}`;
	let id = null;
	t.cleanup(async () => {
		if (id) await admin.del(`/api/projeler/${encodeURIComponent(id)}`);
	});
	const read = async (who = admin) => (await who.get(`/api/projeler/${encodeURIComponent(id)}`)).json;

	const { page } = await author.open();
	const win = await openWide(page, 'projects');
	const step = stepper(t, page);
	const card = () => win.locator(`[data-project-id="${id}"]`);

	await step('üye: bağlantısız öneri reddedilir, başkasının takımına bağlanamaz', async () => {
		t.eq((await authorApi.post('/api/projeler', { baslik: 'E2E bağlantısız', ozet: 'Bağlantısı olmayan öneri metni', teknolojiler: 'Go' })).status, 400, 'bağlantı yoksa 400');
		t.eq((await authorApi.post('/api/projeler', { baslik: 'E2E kötü', ozet: 'Zararlı bağlantılı öneri', repoUrl: 'javascript:alert(1)', teknolojiler: 'Go' })).status, 400, 'javascript: bağlantısı 400');
		const r = await authorApi.post('/api/projeler', { baslik: 'E2E yabancı takım', ozet: 'Başka takıma bağlı öneri', repoUrl: 'https://example.com/x', teknolojiler: 'Go', takimId: other.id });
		t.eq(r.status, 400, 'üyesi olmadığı takıma bağlayamaz');
	});

	await step('üye: "Proje Öner" formu öneri oluşturur (yayına girmez)', async () => {
		await win.getByRole('button', { name: 'Proje Öner' }).click();
		const dlg = page.getByRole('dialog', { name: 'Yeni Proje' });
		await dlg.getByLabel('Proje adı').fill(title);
		await dlg.getByLabel('Kısa açıklama').fill('Kulüp için uçtan uca sınanan örnek proje.');
		await dlg.getByLabel('Depo bağlantısı').fill('https://github.com/example/e2e-proje');
		await dlg.getByLabel('Teknolojiler').fill('Next.js, PostgreSQL, next.js');
		await dlg.getByLabel('Bağlı takım').selectOption(team.id);
		t.check(await dlg.getByText('Öneriniz yönetim onayından sonra vitrinde yer alır.').count() === 1, 'üye ipucu görünüyor');
		await dlg.getByRole('button', { name: 'Öneriyi Gönder' }).click();
		await toast(page, 'Öneriniz yönetime iletildi.');
		const mine = (await authorApi.get('/api/projeler')).json.projeler.find((p) => p.baslik === title);
		id = mine?.id;
		t.eq(mine?.durum, 'oneri', 'durum: öneri');
		t.eq(mine?.teknolojiler, ['Next.js', 'PostgreSQL'], 'teknolojiler tekilleştirildi');
		t.eq(mine?.takimId, team.id, 'kendi takımına bağlandı');
		const sheet = page.getByRole('dialog', { name: title });
		await sheet.waitFor();
		t.check(await sheet.getByText('Onay bekliyor').count() >= 1, 'sayfada "Onay bekliyor"');
		t.eq(await sheet.getByRole('button', { name: 'Yayınla' }).count(), 0, 'üyede "Yayınla" yok');
		t.check(await sheet.getByRole('button', { name: /^\d+$/ }).isDisabled(), 'öneri yıldızlanamaz (düğme kapalı)');
		await t.shot(page, 'oneri-gonderildi');
	});

	await step('öneri yalnız sahibine ve yönetime görünür', async () => {
		t.eq((await fanApi.get(`/api/projeler/${id}`)).status, 404, 'başka üye için 404');
		t.check(!(await fanApi.get('/api/projeler')).json.projeler.some((p) => p.id === id), 'başka üyenin listesinde yok');
		t.eq((await fanApi.post(`/api/projeler/${id}`, { action: 'star' })).status, 404, 'başka üye yıldızlayamaz (404)');
		t.eq((await authorApi.post(`/api/projeler/${id}`, { action: 'star' })).status, 400, 'öneri yıldızlanamaz (400)');
		t.eq((await authorApi.patch(`/api/projeler/${id}`, { durum: 'yayinda' })).status, 403, 'sahibi kendi önerisini yayınlayamaz');
	});

	await step('üye: kendi önerisini düzenler', async () => {
		await card().click();
		const sheet = page.getByRole('dialog', { name: title });
		await sheet.getByRole('button', { name: 'Düzenle' }).click();
		const dlg = page.getByRole('dialog', { name: 'Projeyi Düzenle' });
		await dlg.getByLabel('Canlı demo bağlantısı').fill('https://example.com/demo');
		await dlg.getByRole('button', { name: 'Kaydet' }).click();
		await toast(page, 'Değişiklikler kaydedildi.');
		t.eq((await read(authorApi)).canliUrl, 'https://example.com/demo', 'demo bağlantısı kaydedildi');
	});

	await step('yönetim: Öneriler sekmesinde onaylar ve yayınlar', async () => {
		const { page: ap } = await t.open('admin');
		const aw = await openWide(ap, 'projects');
		await aw.getByRole('tab', { name: /Öneriler/ }).click();
		await aw.locator(`[data-project-id="${id}"]`).click();
		const sheet = ap.getByRole('dialog', { name: title });
		await sheet.getByRole('button', { name: 'Yayınla' }).click();
		await toast(ap, 'Proje yayınlandı.');
		t.eq((await read()).durum, 'yayinda', 'durum: yayında');
		t.check((await fanApi.get('/api/projeler')).json.projeler.some((p) => p.id === id), 'artık başka üyeler de görüyor');
		await t.shot(ap, 'yayinlandi');
	});

	await step('yıldız: üye yıldızlar ve geri alır; sayaç doğru', async () => {
		const { page: fp } = await fan.open();
		const fw = await openWide(fp, 'projects');
		const star = fw.locator(`[data-project-id="${id}"]`).locator('button[aria-pressed]');
		t.eq(await star.getAttribute('aria-pressed'), 'false', 'başta yıldız yok');
		await star.click();
		await t.waitFor(async () => (await read(fanApi)).begeniSayisi === 1);
		t.eq((await read(fanApi)).begeniSayisi, 1, 'sunucuda 1 yıldız');
		t.eq(await star.getAttribute('aria-pressed'), 'true', 'düğme basılı');
		t.eq((await authorApi.post(`/api/projeler/${id}`, { action: 'star' })).json?.begeniSayisi, 2, 'ikinci üye yıldızlayınca 2');
		await star.click();
		await t.waitFor(async () => (await read(fanApi)).begeniSayisi === 1);
		t.eq((await read(fanApi)).begeniSayisi, 1, 'geri alınca 1');
		t.eq((await read(fanApi)).begendimMi, false, 'üyenin yıldızı kalktı');
	});

	await step('öne çıkarma: yalnız yönetim; kartta "Öne çıkan" rozeti', async () => {
		t.eq((await authorApi.patch(`/api/projeler/${id}`, { oneCikan: true })).status, 403, 'sahibi öne çıkaramaz');
		const { page: ap } = await t.open('admin');
		const aw = await openWide(ap, 'projects');
		await aw.locator(`[data-project-id="${id}"]`).click();
		const sheet = ap.getByRole('dialog', { name: title });
		await sheet.getByRole('button', { name: 'Öne çıkar' }).click();
		await toast(ap, 'Değişiklikler kaydedildi.');
		t.eq(Number((await read()).oneCikan), 1, 'sunucuda öne çıkan');
		await ap.keyboard.press('Escape');
		t.check(await aw.locator(`[data-project-id="${id}"]`).getByText('Öne çıkan').count() === 1, 'kartta "Öne çıkan"');
		const first = await aw.locator('[data-project-id]').first().getAttribute('data-project-id');
		t.eq(first, id, '"Öne çıkanlar" sıralamasında ilk kart');
	});

	await step('arşiv: arşivlenen proje vitrinden çıkar, öne çıkarma düşer, yıldızlanamaz, sahibi düzenleyemez', async () => {
		const { page: ap } = await t.open('admin');
		const aw = await openWide(ap, 'projects');
		await aw.locator(`[data-project-id="${id}"]`).click();
		await ap.getByRole('dialog', { name: title }).getByRole('button', { name: 'Arşivle' }).click();
		await toast(ap, 'Değişiklikler kaydedildi.');
		const p = await read();
		t.eq(p.durum, 'arsiv', 'durum: arşiv');
		t.eq(Number(p.oneCikan), 0, 'öne çıkarma kalktı');
		t.eq((await fanApi.get(`/api/projeler/${id}`)).status, 404, 'arşivdeki proje başka üyeye görünmez');
		t.eq((await authorApi.post(`/api/projeler/${id}`, { action: 'star' })).status, 400, 'arşivdeki proje (sahibince bile) yıldızlanamaz');
		t.eq((await authorApi.patch(`/api/projeler/${id}`, { ozet: 'Arşivdeyken değiştirmeye çalışıyor' })).status, 403, 'sahibi arşivdeki projeyi düzenleyemez');
		await ap.keyboard.press('Escape');
		await aw.getByRole('tab', { name: /Arşiv/ }).click();
		t.eq(await aw.locator(`[data-project-id="${id}"]`).count(), 1, 'Arşiv sekmesinde');
		await aw.locator(`[data-project-id="${id}"]`).click();
		// The "Arşivle" toast says the same thing; let it go so the next one is really this save's.
		await ap.locator('[role=status] > div').filter({ hasText: 'Değişiklikler kaydedildi.' }).waitFor({ state: 'detached', timeout: 15_000 });
		await ap.getByRole('dialog', { name: title }).getByRole('button', { name: 'Arşivden çıkar' }).click();
		await toast(ap, 'Değişiklikler kaydedildi.');
		t.eq((await read()).durum, 'yayinda', 'arşivden çıkınca yayında');
		t.eq((await read()).begeniSayisi, 1, 'yıldızlar korunmuş');
	});

	await step('yayından geri alma ve silme yetkisi', async () => {
		t.eq((await authorApi.del(`/api/projeler/${id}`)).status, 403, 'sahibi yayındaki projeyi silemez');
		t.eq((await admin.patch(`/api/projeler/${id}`, { durum: 'oneri' })).status, 200, 'yönetim öneriye geri aldı');
		t.eq((await fanApi.get(`/api/projeler/${id}`)).status, 404, 'öneriye dönünce başka üyeden gizlendi');
		await page.reload();
		await page.locator('[data-window-frame=projects]').waitFor();
		const w = await openWide(page, 'projects');
		await w.getByRole('tab', { name: /Öneriler/ }).click();
		await w.locator(`[data-project-id="${id}"]`).click();
		await page.getByRole('dialog', { name: title }).getByRole('button', { name: 'Sil', exact: true }).click();
		await answerDialog(page);
		await t.waitFor(async () => (await authorApi.get(`/api/projeler/${id}`)).status === 404);
		t.eq((await admin.get(`/api/projeler/${id}`)).status, 404, 'sahibi kendi önerisini sildi');
		id = null;
	});

	await step('yetkisiz rol: "Sadece Haberler" projeleri göremez ve öneremez', async () => {
		const okur = await t.api('okur');
		t.eq((await okur.get('/api/projeler')).status, 403, 'GET /api/projeler 403');
		t.eq((await okur.post('/api/projeler', { baslik: 'E2E sızma', ozet: 'Yetkisiz kullanıcı önerisi', repoUrl: 'https://example.com', teknolojiler: 'Go' })).status, 403, 'öneri 403');
		const { page: op } = await t.open('okur');
		t.eq(await op.locator('[data-dock-app=projects]').count(), 0, 'Dock\'ta Projeler yok');
	});
}
