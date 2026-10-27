// Öğrenci öncelikli akış: telefon kokpiti (alt gezinme, hızlı eylemler) ve rolsüz üyenin
// takım vitrini (başvuru + kaptan yanıtı sayfa yenilenmeden gelir).
import { makeTeam } from '../lib/takim.mjs';
import { makeEvent } from '../lib/etkinlik.mjs';

export const meta = { title: 'Mobil kokpit ve rolsüz üye takım başvurusu' };

const overflowOf = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const ege = await t.api('ege');
	const can = await t.api('can');
	const okur = await t.api('okur');

	// A team of our own, open to everyone: the showcase must still turn a join into an application.
	const team = await makeTeam(t, admin, { label: 'Kokpit', liderId: fx.users.ege.id, katilimTuru: 'acik' });
	const event = await makeEvent(t, admin, { label: 'Kokpit', startMin: -10, lengthMin: 90 });

	await t.step('kokpit: alt gezinme ve dört sekme (can, 390×844)', async () => {
		const { page } = await t.open('can', { mobile: true });
		await page.locator('[data-mobile-nav]').waitFor();
		t.eq(await page.locator('[data-mobile-nav] [data-mobile-tab]').evaluateAll((els) => els.map((e) => e.dataset.mobileTab)), ['home', 'apps', 'teams', 'profile'], 'dört sekme: Kokpit, Uygulamalar, Takımlar, Profil');
		t.eq(await page.locator('[data-mobile-tab=home]').getAttribute('aria-current'), 'page', 'açılışta Kokpit seçili');
		t.check((await page.locator('[data-mobile-tab=apps]').boundingBox()).height >= 44, 'sekmeler parmakla basılacak boyda (≥44px)');
		t.eq(await page.locator('[data-cockpit=xp]').count(), 1, 'kokpitte seviye/XP kartı var');
		t.eq(await page.locator('[data-cockpit=checkin], [data-cockpit=tasks], [data-cockpit=event]').count(), 3, 'üç hızlı eylem kartı: QR yoklama, görevlerim, yaklaşan etkinlik');
		t.check((await overflowOf(page)) <= 0, 'kokpitte yatay taşma yok');
		await t.shot(page, 'kokpit');

		await page.locator('[data-mobile-tab=apps]').click();
		await page.locator('[data-launcher-app=teams]').waitFor();
		t.eq(await page.locator('[data-mobile-tab=apps]').getAttribute('aria-current'), 'page', 'Uygulamalar sekmesi seçili');

		await page.locator('[data-mobile-tab=teams]').click();
		await page.locator(`[data-team-id="${team.id}"]`).waitFor();
		t.check(await page.locator(`[data-team-id="${team.id}"]`).isVisible(), 'Takımlar sekmesi vitrini gösteriyor');
		t.check(await page.locator('[data-mobile-action=open-teams]').isVisible(), 'Takımlar uygulaması olan rolde "uygulamayı aç" düğmesi var');
		t.check((await overflowOf(page)) <= 0, 'Takımlar sekmesinde yatay taşma yok');
		await t.shot(page, 'takimlar-sekmesi');

		await page.locator('[data-mobile-tab=profile]').click();
		await page.locator('[data-mobile-profile]').waitFor();
		t.eq(await page.locator('[data-mobile-profile] [data-role-badge="Üye"]').count(), 1, 'profilde rol rozeti');
		await page.locator('[data-badge]').first().waitFor();
		t.check((await page.locator('[data-badge]').count()) >= 1, 'profilde rozetler listeleniyor');
		t.check((await overflowOf(page)) <= 0, 'profilde yatay taşma yok');
		await t.shot(page, 'profil');

		await page.locator('[data-mobile-action=settings]').click();
		await page.getByRole('button', { name: 'Geri' }).waitFor();
		await page.getByRole('button', { name: 'Geri' }).click();
		await page.locator('[data-mobile-profile]').waitFor();
		t.eq(await page.locator('[data-mobile-tab=profile]').getAttribute('aria-current'), 'page', 'uygulamadan dönünce aynı sekmede');
	});

	await t.step('kokpit: görevlerim ve yaklaşan etkinlik gerçek veriden geliyor', async () => {
		t.eq((await can.post('/api/takimlar', { action: 'join', takimId: team.id })).status, 200, 'can açık takıma katıldı');
		const task = await ege.post('/api/takimlar', { action: 'addTask', takimId: team.id, baslik: 'Kokpit test görevi', atananUyeId: fx.users.can.id });
		t.eq(task.status, 200, 'kaptan görevi can’a atadı', JSON.stringify(task.json));

		const { page } = await t.open('can', { mobile: true });
		const card = page.locator('[data-cockpit=tasks]');
		await card.getByText('Kokpit test görevi').waitFor();
		t.check((await card.innerText()).includes(team.ad), 'görev kartında takım adı yazıyor');
		const ev = page.locator('[data-cockpit=event]');
		await ev.getByText(event.baslik).waitFor();
		t.check(/devam ediyor/i.test(await ev.innerText()), 'başlamış etkinlik "Şu an devam ediyor" diyor');
		await t.shot(page, 'kokpit-veri');

		// Canlı: kaptan görevi tamamlandı yapınca kart sayfa yenilenmeden güncellenir.
		const gorev = (await can.get(`/api/takimlar?takimId=${team.id}`)).json.gorevler.find((g) => g.baslik === 'Kokpit test görevi');
		t.eq((await ege.post('/api/takimlar', { action: 'updateTask', gorevId: gorev.id, durum: 'tamamlandi' })).status, 200, 'görev tamamlandı');
		const ms = await t.waitFor(async () => (await card.getByText('Kokpit test görevi').count()) === 0, { timeout: 15_000 });
		t.check(ms >= 0, `tamamlanan görev kartan canlı düştü (${ms} ms)`);

		// QR yoklama: tek dokunuşla tarayıcı/elle kod ekranı açılır.
		await page.locator('[data-cockpit=checkin]').click();
		await page.getByText('Yoklama karekodunu okut').waitFor();
		t.check(await page.getByText('Yoklama karekodunu okut').isVisible(), 'QR yoklama ekranı açıldı');
		await t.shot(page, 'qr-yoklama');
	});

	await t.step('rolsüz üye (mobil): vitrinden başvuru → kaptan onayı canlı gelir', async () => {
		t.cleanup(() => admin.patch('/api/uyeler', { id: fx.users.okur.id, rolId: fx.roles.haber }));
		t.eq((await admin.patch('/api/uyeler', { id: fx.users.okur.id, rolId: null })).status, 200, 'okur’un rolü kaldırıldı');

		const { page } = await t.open('okur', { mobile: true });
		const notice = page.locator('[data-no-role-notice]');
		await notice.waitFor();
		const card = notice.locator(`[data-team-id="${team.id}"]`);
		await card.waitFor();
		t.check(await card.isVisible(), 'rolsüz üyeye takım vitrini açılıyor');
		t.check((await card.innerText()).includes('Kaptan'), 'kartta kaptan adı var');
		t.check((await overflowOf(page)) <= 0, 'yatay taşma yok');
		await t.shot(page, 'rolsuz-vitrin');

		await card.getByRole('button', { name: 'Başvur' }).click();
		await card.getByRole('button', { name: 'C++' }).click();
		await card.getByRole('button', { name: 'ROS2' }).click();
		t.eq(await card.getByRole('button', { name: 'C++' }).getAttribute('aria-pressed'), 'true', 'seçilen uzmanlık işaretli');
		await card.locator('textarea').fill('Roket aviyoniği ile ilgileniyorum.');
		await t.shot(page, 'rolsuz-basvuru-formu');
		await card.getByRole('button', { name: 'Başvuruyu Gönder' }).click();
		await card.getByText('Başvurun kaptanda').waitFor();
		t.check(true, 'başvuru gitti, kart "kaptanda" diyor');

		const board = (await ege.get(`/api/takimlar?takimId=${team.id}`)).json;
		const app = board.basvurular.find((b) => b.kullaniciId === fx.users.okur.id);
		t.check(!!app, 'açık takıma bile başvuru olarak düştü (üye olmadı)');
		t.eq(app?.basvuruNotu, 'Uzmanlık: C++, ROS2\nRoket aviyoniği ile ilgileniyorum.', 'kaptan not ve uzmanlıkları görüyor');
		t.check(!board.uyeler.some((u) => u.kullaniciId === fx.users.okur.id), 'başvuran henüz üye değil');

		// Başvuruyu geri çek, sonra yeniden başvur → kaptan onaylar → kart canlı güncellenir.
		await card.getByRole('button', { name: 'Başvuruyu geri çek' }).click();
		await card.getByRole('button', { name: 'Başvur' }).waitFor();
		t.check(true, 'geri çekince "Başvur" düğmesi döndü');
		t.eq((await okur.post('/api/takimlar/kesfet', { action: 'apply', takimId: team.id })).status, 200, 'yeniden başvuru');
		await card.getByText('Başvurun kaptanda').waitFor();
		t.eq((await ege.post('/api/takimlar', { action: 'approve', takimId: team.id, kullaniciId: fx.users.okur.id })).status, 200, 'kaptan onayladı');
		const ms = await t.waitFor(async () => (await card.getByText('Başvurun kabul edildi').count()) === 1, { timeout: 15_000 });
		t.check(ms >= 0, `onay sayfa yenilenmeden kartta göründü (${ms} ms)`);
		await t.shot(page, 'rolsuz-kabul');
	});

	await t.step('rolsüz üye (masaüstü): uyarı kartının altında vitrin', async () => {
		const { page } = await t.open('okur');
		const notice = page.locator('[data-no-role-notice]');
		await notice.waitFor();
		t.eq(await notice.locator('[data-onboarding-teams]').count(), 1, 'uyarı kartında vitrin var');
		t.eq(await page.locator('[data-no-role-settings]').count(), 1, 'Ayarlar düğmesi yerinde');
		const box = await notice.boundingBox();
		t.check(box.y >= 0 && box.y + box.height <= 900, 'kart ekranın içinde kalıyor', JSON.stringify(box));
		await t.shot(page, 'rolsuz-masaustu-vitrin');
	});
}
