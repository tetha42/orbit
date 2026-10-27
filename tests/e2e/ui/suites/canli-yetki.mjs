// Canlı yetki değişimi: admin bir üyenin rolünü değiştirir, üyenin açık oturumu
// sayfa yenilenmeden güncellenir: SSE akışıyla (/api/olaylar) saniyeler içinde. Akış yokken
// 15 sn'lik yoklamaya düşüş `sse` paketinde sınanır.
import { dockApps, openApp, openWindows } from '../lib/browser.mjs';

export const meta = { title: 'Rol değişince açık oturum SSE ile saniyeler içinde güncelleniyor' };

const UYE_DOCK = ['teams', 'events', 'projects', 'decisions', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'mail'];
const HABER_DOCK = ['news', 'settings'];
// SSE olayı + /api/auth/me + çizim; 15 sn'lik yoklamadan çok uzakta (yoklama olsaydı bu sınır aşılırdı).
const LIMIT_MS = 4_000;

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const canId = fx.users.can.id;
	const setRole = (rolId) => admin.patch('/api/uyeler', { id: canId, rolId });
	t.cleanup(() => setRole(fx.roles.uye));

	// "can" (Üye) kendi tarayıcı bağlamında Etkinlikler'i açık tutuyor; admin ayrı bir istemci.
	const { page } = await t.open('can');
	await t.step('başlangıç: Üye rolü uygulamaları açabiliyor', async () => {
		await openApp(page, 'events');
		t.sameSet(await dockApps(page), UYE_DOCK, 'Dock: Üye rolünün uygulamaları');
		t.includes(await openWindows(page), 'events', 'Etkinlikler penceresi açık');
		await t.shot(page, 'once-uye-etkinlikler-acik');
		await t.sleep(1000); // canlı akışın açılması için kısa pay
	});

	await t.step('admin rolü "Sadece Haberler" yapıyor → ≤4 sn içinde Dock ve pencere güncelleniyor', async () => {
		const res = await setRole(fx.roles.haber);
		t.eq(res.status, 200, 'PATCH /api/uyeler {rolId: Sadece Haberler} 200');
		const ms = await t.waitFor(async () => {
			const dock = await dockApps(page);
			return !dock.includes('events') && !dock.includes('teams');
		}, { timeout: 25_000, every: 100 });
		t.check(ms >= 0 && ms <= LIMIT_MS, `Dock'tan Etkinlikler ve Takımlar sayfa yenilenmeden kayboldu (${ms} ms ≤ ${LIMIT_MS})`);
		t.sameSet(await dockApps(page), HABER_DOCK, 'Dock yalnız Haberler ve Ayarlar');
		t.excludes(await openWindows(page), 'events', 'açık Etkinlikler penceresi kapandı');
		t.excludes(await openWindows(page), 'teams', 'varsayılan açık Takımlar penceresi kapandı');
		await t.shot(page, 'sonra-sadece-haberler');
	});

	await t.step('admin rolü geri veriyor → uygulamalar Dock\'a geri geliyor', async () => {
		await setRole(fx.roles.uye);
		const ms = await t.waitFor(async () => (await dockApps(page)).includes('events'), { timeout: 25_000, every: 100 });
		t.check(ms >= 0 && ms <= LIMIT_MS, `Üye rolü geri verilince Dock güncellendi (${ms} ms)`);
		t.sameSet(await dockApps(page), UYE_DOCK, 'Dock yeniden Üye rolünün uygulamaları');
	});
}
