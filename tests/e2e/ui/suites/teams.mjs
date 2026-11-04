// Takımlar: kurma, katılma/ayrılma, başvuru (onay/ret/geri çekme), kontenjan, takım sınırı,
// takım içi roller, üye çıkarma, kaptan ayarları, kaptan devri, askıya alma, silme ve roller.
import { answerDialog, backToTeams, openTeam, openWide, stepper, teamTab, toast } from '../lib/arayuz.mjs';
import { addTask, makeTeam, readTeam, sweepStale } from '../lib/team.mjs';
import { newMember, runTag } from '../lib/membership.mjs';

export const meta = { title: 'Takımlar: kurma, katılma/başvuru, kaptan devri, takım içi roller, kontenjan' };

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	await sweepStale(admin);

	const member = fx.roles.member;
	const captain = await newMember(t, admin, { label: 'kaptan', roleId: member });
	const deniz = await newMember(t, admin, { label: 'deniz', roleId: member });
	const ece = await newMember(t, admin, { label: 'ece', roleId: member });
	const [capApi, denizApi, eceApi] = await Promise.all([captain.api(), deniz.api(), ece.api()]);
	const card = (win, id) => win.locator(`[data-team-id="${id}"]`);
	const statusOf = async (teamId, userId) => (await readTeam(admin, teamId)).uyeler.find((u) => u.userId === userId);

	const { page: ap } = await t.open('admin');
	const astep = stepper(t, ap);
	const name = `E2E Başvurulu ${runTag()}`;
	let appTeam = null;

	await astep('yönetim: "Yeni Takım" ile başvurulu takım kurar; kaptan otomatik üye', async () => {
		const win = await openWide(ap, 'teams');
		await win.getByRole('button', { name: 'Yeni Takım' }).click();
		const dlg = ap.getByRole('dialog', { name: 'Yeni Takım' });
		await dlg.getByLabel('Takım adı').fill(name);
		await dlg.getByLabel('Kategori').selectOption('Robotik & Gömülü');
		await dlg.getByLabel('Kontenjan').fill('3');
		await dlg.locator('label:has(> span:text-is("Captain")) select').selectOption(captain.id);
		await dlg.getByLabel('Açıklama ve hedefler').fill('Başvuru ile üye alan geçici sınama takımı.');
		await dlg.getByText('Başvuru ile — kaptan onaylar').click();
		await dlg.getByRole('button', { name: 'Takımı Kur' }).click();
		await toast(ap, 'Yeni takım kuruldu.');
		appTeam = (await admin.get('/api/takimlar')).json.find((tm) => tm.name === name);
		t.cleanup(() => admin.post('/api/takimlar', { action: 'deleteTeam', teamId: appTeam.id }));
		t.eq(appTeam?.participationType, 'onayli', 'katılım: başvuru ile');
		t.eq(appTeam?.capacity, 3, 'kontenjan 3');
		t.eq(appTeam?.category, 'Robotik & Gömülü', 'kategori');
		t.eq(appTeam?.leadId, captain.id, 'kaptan');
		const cap = appTeam.uyeler.find((u) => u.userId === captain.id);
		t.eq(cap?.teamRole, 'Takım Kaptanı', 'kaptan "Takım Kaptanı" unvanıyla üye');
		await card(win, appTeam.id).getByText('Başvuru ile', { exact: true }).waitFor();
		t.eq((await admin.post('/api/takimlar', { action: 'createTeam', name: 'E2E kötü', category: 'Uydurma', description: 'Geçersiz kategori denemesi' })).status, 400, 'geçersiz kategori 400');
		t.eq((await admin.post('/api/takimlar', { action: 'createTeam', name: 'E2E kötü', category: 'Yapay Zeka', description: 'Kontenjan sınır dışı', capacity: 99 })).status, 400, 'kontenjan sınır dışı 400');
		await t.shot(ap, 'takim-kuruldu');
	});

	await t.step('üye: başvurur (not ile), "Başvurun bekliyor"; geri çeker; yeniden başvurur', async () => {
		const { page } = await deniz.open();
		const step = stepper(t, page);
		await step('başvuru', async () => {
			const win = await openWide(page, 'teams');
			await card(win, appTeam.id).getByRole('button', { name: 'Başvur' }).click();
			const dlg = page.getByRole('dialog', { name: 'Takıma Başvur' });
			await dlg.locator('textarea').fill('Gömülü sistemlerde deneyimim var.');
			await dlg.getByRole('button', { name: 'Başvuruyu Gönder' }).click();
			await toast(page, 'Başvurunuz takım kaptanına iletildi.');
			await card(win, appTeam.id).getByText('Başvurun bekliyor').waitFor();
			t.eq((await statusOf(appTeam.id, deniz.id)) ?? null, null, 'başvuru kadroda değil');
			t.eq((await readTeam(denizApi, appTeam.id)).myMyStatus, 'basvurdu', 'durum: başvurdu');
			t.eq((await denizApi.post('/api/takimlar', { action: 'join', teamId: appTeam.id })).status, 409, 'ikinci başvuru 409');
			t.eq((await readTeam(denizApi, appTeam.id)).applications, [], 'üye başvuru listesini görmüyor');
			await card(win, appTeam.id).getByRole('button', { name: 'Başvuruyu geri çek' }).click();
			await answerDialog(page);
			await toast(page, 'Başvurunuz geri çekildi.');
			t.eq((await readTeam(denizApi, appTeam.id)).myMyStatus, null, 'başvuru geri çekildi');
		});
		await denizApi.post('/api/takimlar', { action: 'join', teamId: appTeam.id, applicationNote: 'Yeniden başvuruyorum.' });
		await eceApi.post('/api/takimlar', { action: 'join', teamId: appTeam.id, applicationNote: 'Ben de katılmak isterim.' });
	});

	await t.step('kaptan: başvuruyu kabul eder, diğerini reddeder', async () => {
		const { page } = await captain.open();
		const win = await openTeam(page, appTeam.id);
		await teamTab(win, 'Üyeler');
		const denizApp = win.locator(`[data-applicant-id="${deniz.id}"]`);
		await denizApp.waitFor();
		t.check(await denizApp.getByText('Yeniden başvuruyorum.').count() === 1, 'başvuru notu görünüyor');
		await denizApp.getByRole('button', { name: 'Kabul et' }).click();
		await toast(page, 'Başvuru kabul edildi.');
		t.eq((await statusOf(appTeam.id, deniz.id))?.status, 'aktif', 'kabul edilen aktif üye');
		await win.locator(`[data-applicant-id="${ece.id}"]`).getByRole('button', { name: 'Reddet' }).click();
		await answerDialog(page);
		await toast(page, 'Başvuru reddedildi.');
		t.eq((await readTeam(eceApi, appTeam.id)).myMyStatus, null, 'reddedilen başvuru silindi');
		t.eq((await eceApi.post('/api/takimlar', { action: 'approve', teamId: appTeam.id, userId: ece.id })).status, 403, 'üye kendi başvurusunu onaylayamaz');
		await t.shot(page, 'basvurular');
	});

	await t.step('takım içi roller: kaptan unvan verir; kaptanın unvanı yalnız devirle değişir', async () => {
		const { page } = await captain.open();
		const win = await openTeam(page, appTeam.id);
		await teamTab(win, 'Üyeler');
		const role = win.locator(`[data-member-id="${deniz.id}"] input`);
		await role.fill('Donanım   Sorumlusu');
		await role.press('Enter');
		await t.waitFor(async () => (await statusOf(appTeam.id, deniz.id))?.teamRole === 'Donanım Sorumlusu');
		t.eq((await statusOf(appTeam.id, deniz.id))?.teamRole, 'Donanım Sorumlusu', 'unvan kaydedildi (boşluklar toplandı)');
		t.check(await win.locator(`[data-member-id="${captain.id}"] input`).isDisabled(), 'kaptanın unvan kutusu kapalı');
		t.eq((await capApi.post('/api/takimlar', { action: 'setMemberRole', teamId: appTeam.id, userId: captain.id, teamRole: 'Üye' })).status, 409, 'kaptanın unvanı değiştirilemez (409)');
		t.eq((await denizApi.post('/api/takimlar', { action: 'setMemberRole', teamId: appTeam.id, userId: deniz.id, teamRole: 'Lider' })).status, 403, 'üye kendine unvan veremez');
		const { page: dp } = await deniz.open();
		const dw = await openTeam(dp, appTeam.id);
		await teamTab(dw, 'Üyeler');
		t.check(await dw.locator(`[data-member-id="${deniz.id}"] input`).isDisabled(), 'üyenin unvan kutusu kapalı');
		t.eq(await dw.getByText('Bekleyen Başvurular').count(), 0, 'üye başvuru bölümünü görmüyor');
	});

	await t.step('kaptan ayarları: açıklama/kontenjan/katılım türü; ad ve kaptan yönetimde', async () => {
		const { page } = await captain.open();
		const win = await openTeam(page, appTeam.id);
		await teamTab(win, 'Ayarlar');
		t.check(await win.getByLabel('Takım adı').isDisabled(), 'kaptan için ad kutusu kapalı');
		t.eq(await win.getByLabel('Durum').count(), 0, 'kaptan durumu göremez');
		await win.getByLabel('Kontenjan').fill('2');
		await win.getByText('Açık — herkes doğrudan katılır').click();
		await win.getByRole('button', { name: 'Kaydet' }).click();
		await toast(page, 'Takım güncellendi.');
		const tm = await readTeam(admin, appTeam.id);
		t.eq(tm.capacity, 2, 'kontenjan 2');
		t.eq(tm.participationType, 'acik', 'katılım açık');
		t.eq((await capApi.post('/api/takimlar', { action: 'updateTeam', teamId: appTeam.id, capacity: 1 })).status, 400, 'aktif üyelerin altına düşürülemez');
		t.eq((await capApi.post('/api/takimlar', { action: 'updateTeam', teamId: appTeam.id, name: 'Yeni ad' })).status, 403, 'kaptan adı değiştiremez');
		t.eq((await capApi.post('/api/takimlar', { action: 'updateTeam', teamId: appTeam.id, leadId: deniz.id })).status, 403, 'kaptan kaptanlığı kendi devredemez');
	});

	await t.step('kontenjan dolu: açık takıma katılım kapalı', async () => {
		const { page } = await ece.open();
		const win = await openWide(page, 'teams');
		const full = card(win, appTeam.id).getByRole('button', { name: 'Kontenjan dolu' });
		t.check(await full.isDisabled(), '"Kontenjan dolu" düğmesi kapalı');
		const r = await eceApi.post('/api/takimlar', { action: 'join', teamId: appTeam.id });
		t.eq(r.status, 409, 'API 409');
		t.includes(r.json?.error ?? '', 'kontenjan', 'hata kontenjanı söylüyor');
	});

	await t.step('kaptan devri (yönetim): yeni kaptan unvanı alır, eski kaptan takımda kalır', async () => {
		t.eq((await capApi.post('/api/takimlar', { action: 'leave', teamId: appTeam.id })).status, 409, 'kaptan devretmeden ayrılamaz');
		const win = await openTeam(ap, appTeam.id);
		await teamTab(win, 'Ayarlar');
		await win.locator('label:has(> span:text-is("Captain")) select').selectOption(deniz.id);
		await win.getByRole('button', { name: 'Kaydet' }).click();
		await toast(ap, 'Takım güncellendi.');
		const tm = await readTeam(admin, appTeam.id);
		t.eq(tm.leadId, deniz.id, 'yeni kaptan');
		t.eq(tm.uyeler.find((u) => u.userId === deniz.id)?.teamRole, 'Takım Kaptanı', 'yeni kaptanın unvanı');
		t.eq(tm.uyeler.find((u) => u.userId === captain.id)?.status, 'aktif', 'eski kaptan takımda');
		t.check(tm.uyeler.find((u) => u.userId === captain.id)?.teamRole !== 'Takım Kaptanı', 'eski kaptanın unvanı değişti');
		t.eq((await readTeam(capApi, appTeam.id)).permissions.manage, false, 'eski kaptanın yönetim yetkisi kalktı');
		t.eq((await readTeam(denizApi, appTeam.id)).permissions.manage, true, 'yeni kaptan yönetiyor');
		await backToTeams(win);
	});

	await t.step('üye çıkarma: açık görevleri havuza döner; üye kendisi ayrılabilir', async () => {
		const task = await addTask(denizApi, appTeam.id, { title: 'Eski kaptanın açık görevi', assigneeMemberId: captain.id });
		const { page } = await deniz.open();
		const win = await openTeam(page, appTeam.id);
		await teamTab(win, 'Üyeler');
		await win.getByRole('button', { name: `Takımdan çıkar: ${captain.nameSurname}` }).click();
		await answerDialog(page);
		await toast(page, 'Üye takımdan çıkarıldı.');
		t.eq(await statusOf(appTeam.id, captain.id), undefined, 'üye kadrodan çıktı');
		const after = (await readTeam(admin, appTeam.id)).tasks.find((g) => g.id === task.id);
		t.eq(after?.assigneeMemberId, null, 'açık görevi havuza döndü');
		// Açık takıma kendisi katılıp kendisi ayrılır.
		await capApi.post('/api/takimlar', { action: 'join', teamId: appTeam.id });
		const { page: cp } = await captain.open();
		const cw = await openWide(cp, 'teams');
		await card(cw, appTeam.id).getByRole('button', { name: 'Ayrıl' }).click();
		await answerDialog(cp);
		await toast(cp, 'Takımdan ayrıldınız.');
		t.eq(await statusOf(appTeam.id, captain.id), undefined, 'üye ayrıldı');
	});

	await t.step('takım sınırı: bir üye aynı anda en fazla 3 takımda', async () => {
		const extra = [];
		for (const i of [1, 2, 3, 4]) extra.push(await makeTeam(t, admin, { label: `Sinir${i}` }));
		for (const tm of extra.slice(0, 3)) t.eq((await eceApi.post('/api/takimlar', { action: 'join', teamId: tm.id })).status, 200, `${tm.name}: katıldı`);
		const fourth = await eceApi.post('/api/takimlar', { action: 'join', teamId: extra[3].id });
		t.eq(fourth.status, 409, 'dördüncü takım 409');
		const { page } = await ece.open();
		const win = await openWide(page, 'teams');
		t.check(await card(win, extra[3].id).getByRole('button', { name: 'Katıl' }).isDisabled(), 'arayüzde "Katıl" kapalı');
		t.check(await win.getByText('3/3').count() >= 1, '"Takımlarım 3/3"');
	});

	await t.step('askıya alınan takım üye almaz; yönetim takımı siler', async () => {
		const paused = await makeTeam(t, admin, { label: 'Askida' });
		await admin.post('/api/takimlar', { action: 'updateTeam', teamId: paused.id, status: 'askida' });
		t.eq((await denizApi.post('/api/takimlar', { action: 'join', teamId: paused.id })).status, 409, 'askıdaki takıma katılım 409');
		// The list is read once when the app opens: reload to see the paused team.
		await ap.reload();
		await ap.locator('[data-window-frame=teams]').waitFor();
		const w = await openWide(ap, 'teams');
		await card(w, paused.id).getByText('Askıda').waitFor();
		await card(w, paused.id).getByRole('button', { name: /Takımı sil/ }).click();
		await answerDialog(ap);
		await toast(ap, 'Takım silindi.');
		t.eq((await admin.get(`/api/takimlar?teamId=${paused.id}`)).status, 404, 'takım silindi');
	});

	await t.step('yetkisiz roller: üye takım kuramaz/silemez; "Sadece Haberler" hiç göremez', async () => {
		t.eq((await eceApi.post('/api/takimlar', { action: 'createTeam', name: 'E2E izinsiz', category: 'Yapay Zeka', description: 'Üyenin takım kurma denemesi' })).status, 403, 'üye takım kuramaz');
		t.eq((await eceApi.post('/api/takimlar', { action: 'deleteTeam', teamId: appTeam.id })).status, 403, 'üye takım silemez');
		t.eq((await eceApi.post('/api/takimlar', { action: 'addMember', teamId: appTeam.id, userId: ece.id })).status, 403, 'üye kendini doğrudan ekleyemez');
		t.eq((await denizApi.post('/api/takimlar', { action: 'addMember', teamId: appTeam.id, userId: ece.id })).status, 403, 'kaptan bile doğrudan üye ekleyemez (yönetim işi)');
		const { page } = await ece.open();
		const win = await openWide(page, 'teams');
		t.eq(await win.getByRole('button', { name: 'Yeni Takım' }).count(), 0, 'üyede "Yeni Takım" yok');
		t.eq(await win.getByRole('button', { name: /Takımı sil/ }).count(), 0, 'üyede silme düğmesi yok');
		const reader = await t.api('okur');
		t.eq((await reader.post('/api/takimlar', { action: 'join', teamId: appTeam.id })).status, 403, '"Sadece Haberler": katılım 403');
	});
}
