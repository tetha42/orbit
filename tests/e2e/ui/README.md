# Tarayıcı (Playwright) uçtan uca testleri

Gerçek Google Chrome (başsız), gerçek sunucu, gerçek PostgreSQL. Tarayıcı indirilmez;
bağımlılık yalnızca `playwright-core`. Hiçbir test kullanıcının gerçek veritabanına
(`localhost:5432`) dokunmaz: sıfırlama (`DROP DATABASE`) yalnız test konteynerinde
(`127.0.0.1:55432`, kullanıcı `test`) çalışır ve bu kural `lib/db.mjs` içinde kodla zorlanır.

```
pnpm e2e              # bütün paketler, sırayla
pnpm e2e roller 2fa   # yalnız adı verilenler
pnpm e2e --list       # paketleri listeler
pnpm e2e performans   # isteğe bağlı ölçüm paketi (aşağıya bakın); PERF_TRANSPARENCY=on ile saydamlık açık
pnpm e2e performans-etkilesim   # isteğe bağlı: pencere/Dock etkileşimi başına React commit sayısı
```

Ekran görüntüleri `tests/e2e/shots/<paket>/` altına yazılır (git'e alınmaz).
Sunucu günlükleri ve geçici dosyalar `tests/e2e/.tmp/` altındadır (git'e alınmaz).

## İki çalıştırma biçimi

**1. Her şeyi koşucu yapsın (sıfırdan, CI gibi).** Test konteynerinde kendi veritabanınızı açın,
adını `E2E_DATABASE_URL` ile verin. Koşucu veritabanını DROP/CREATE eder, `.env` adminini
(`BOOTSTRAP_ADMIN_*`) kendisi üretir, sunucuyu kendisi başlatır, `scripts/dev-fixtures.mjs`
ile fikstürü kurar ve paketleri koşar. `2fa` gibi boş veritabanı isteyen paketler (`isolated`)
ayrı bir veritabanında, kendi sunucularında koşar; aynı klasörde tek `next dev` olabildiği için
sunucular art arda açılıp kapanır.

```
docker exec beu-test-db psql -U test -d postgres -c 'CREATE DATABASE "benim_e2e"'
E2E_DATABASE_URL=postgresql://test:test@127.0.0.1:55432/benim_e2e E2E_PORT=3101 pnpm e2e
```

Bu biçimde portta (`E2E_PORT`, varsayılan 3100) çalışan başka sunucu olmamalıdır; `pnpm e2e`
bittiğinde sunucuları kapatır.

**2. Kendi sunucunuza bağlanın (geliştirirken hızlı döngü).** Sunucuyu ve fikstürü siz kurarsınız:

```
export DATABASE_URL=postgresql://test:test@127.0.0.1:55432/benim_e2e
export BOOTSTRAP_ADMIN_EMAIL=admin@e2e.test BOOTSTRAP_ADMIN_PASSWORD='en-az-12-karakter'
pnpm exec next dev --port 3101 &
node scripts/dev-fixtures.mjs --base http://localhost:3101 --out /tmp/fx.json
pnpm e2e roller --base http://localhost:3101 --fixtures /tmp/fx.json
#   aynısı: E2E_BASE=… E2E_FIXTURES=/tmp/fx.json pnpm e2e roller
node tests/e2e/rbac-api.mjs --fixtures /tmp/fx.json --base http://localhost:3101   # API testi, aynı fikstür
node tests/e2e/onboarding-api.mjs --fixtures /tmp/fx.json --base http://localhost:3101   # takım vitrini / rolsüz üye başvurusu (DATABASE_URL gerekir)
```

Bu biçimde `isolated` paketler atlanır ("atlandı" olarak yazılır): kendi boş veritabanı ve
sunucusu ister, çalışan sunucunuzla aynı klasörde ikinci bir `next dev` açılamaz.

Fikstür dosyasında admin ve 2FA'lı hesapların TOTP gizli anahtarları vardır (`adminTotp`,
`users.zeynep.totp`). Aynı 30 sn'lik pencerede bir kod iki kez kullanılamaz; `lib/totp.mjs`
bunu bilir ve gerekirse sonraki pencereyi bekler (pencereler çalıştırmalar arasında da
`tests/e2e/.tmp/` içinde hatırlanır).

## Yeni paket eklemek

`tests/e2e/ui/suites/<ad>.mjs` dosyası bir pakettir; koşucu klasörü tarar, kayıt gerekmez.
Her paket kendi verisini kurar ve işi bitince geri alır (`t.cleanup`), fikstürü yalnız okur;
paketler arasında sıra bağımlılığı olmamalıdır.

```js
// tests/e2e/ui/suites/ornek.mjs
import { openApp } from '../lib/browser.mjs';

export const meta = { title: 'Kısa açıklama' };   // isolated: true → boş veritabanı + kendi sunucusu

export default async function suite(t) {
	const { fx } = t;                                // fikstür (isolated pakette null; t.bootstrap = .env admini)
	const admin = await t.api('admin');              // cookie'li API istemcisi; 2FA'lı hesap için TOTP'yi kendisi girer
	t.cleanup(() => admin.patch('/api/uyeler', { id: fx.users.can.id, rolId: fx.roles.uye })); // hata olsa da çalışır

	await t.step('Üye Rehberi açılıyor', async () => {   // step içindeki hata yalnız o adımı düşürür
		const { page } = await t.open('can');            // 'admin' | 'zeynep' | 'ege' | 'can' | 'okur'; { mobile: true } → 390×844
		const win = await openApp(page, 'members');
		t.check(await win.locator('[data-role-badge]').count() > 0, 'rozetler var');
		t.sameSet(await page.locator('[data-dock-app]').evaluateAll((e) => e.map((x) => x.dataset.dockApp)), ['news', 'settings'], 'Dock');
		await t.shot(page, 'uye-rehberi');
	});
}
```

`t` üzerindekiler (`lib/context.mjs` başındaki listeye bakın): `check / eq / sameSet / includes /
excludes` (iddialar), `step`, `waitFor`, `shot`, `cleanup`, `api(anahtar)`, `open(anahtar, {mobile})`,
`anonymous()`, `adopt(anahtar, context)`, `track(context)`, `browser`, `base`, `fx`.
Tarayıcı yardımcıları `lib/browser.mjs` içindedir: `loginUi` (TOTP/kurtarma kodu dahil),
`logoutUi`, `openApp`, `openSettingsTab`, `dockApps`, `openWindows`, `desktopToolMenu`,
`sessionToken`. Yardımcı ekleyeceğiniz zaman `lib/` altına koyun; paket içinde kopyalamayın.

`meta.optIn: true` olan paket (şimdilik yalnız `performans`) `pnpm e2e` ile koşmaz; yalnız adı
verilince koşar. `performans` kendi Chrome'unu WebGL açık başlatır (3B duvar kağıdı çalışır),
boş masaüstü / 3 pencere + 3B / sürükleme için FPS, kare süreleri, React commit sayısı (DevTools
kancası) ve uzun görevleri tablo olarak basar ve `tests/e2e/.tmp/perf-<tarih>.json` dosyasına
yazar (öncesi/sonrası karşılaştırması için). Eşikler gevşektir ve gerekçeleri paketin içinde;
yazılım GPU'sunda 3B sahnenin çizildiği boş masaüstü FPS'i yalnız raporlanır.

`performans-etkilesim` (isteğe bağlı) 3 pencere açma, 6 odak değişimi, 6 Dock simgesinde gezinme ve 3 pencereyi kapatıp açma sırasında kaç React commit'i olduğunu (3 tur, medyan) sayar ve `tests/e2e/.tmp/perf-etkilesim-<tarih>.json` dosyasına yazar. 3B kapalıdır; eşik yoktur, yalnız ölçer. Eski bir commit'in sunucusuna `--base` ve `--fixtures` ile bağlanarak öncesi/sonrası karşılaştırılabilir (eski arayüzde `data-menu-item` yoktur; `performans` paketi eski sürümde bu yüzden çalışmaz, `performans-etkilesim` çalışır).

Masaüstü davranış yardımcıları (pencere kutusu, sürükleme/boyutlandırma, bağlam menüleri,
sayfa hata izleyici) `lib/desktop.mjs`, ölçüm yardımcıları `lib/perf.mjs` içindedir.

### Seçiciler

Metne değil `data-` özniteliklerine bağlanın: `[data-dock-app=<uygulama>]`,
`[data-window-frame=<uygulama>]`, `[data-settings-tab=roles|security|smtp|…]`,
`[data-role-id]`, `[data-role-badge="<rol adı>"]`, `[data-role-select=<üye id>]`,
`[data-no-role-notice]`, `[data-launcher-app=<uygulama>]` (mobil), `[data-menubar-category=<id>]`,
`[data-menu-item=<öğe id>]` (menü çubuğu ve sağ tık menüsü), `[data-window-control=close|minimize|maximize]`,
`[data-notification-toggle]`, `[data-notification-badge=<sayı>]`, `[data-notification-panel]`,
`[data-notification-item=<tür:id>]` (`data-unread`), `[data-notification-group=pinned|action|fresh|earlier]`,
`[data-notification-action=onayla|reddet]`, `[data-app-loading]` (uygulama parçası yükleniyor),
`[data-about-modal]`, sürükleme/boyutlandırma sırasında `html[data-window-moving]`, zorunlu 2FA modalı
`[role=dialog][aria-labelledby=twofa-enforce-title]`. Gerekirse bileşene yeni bir `data-`
özniteliği eklemek serbesttir.

### Bilinmesi gerekenler

- **Tek oturum kuralı:** bir hesapla form üzerinden giriş yapmak onun önceki oturumunu bitirir.
  `t.api`/`t.open` oturumu paketler arasında paylaşır; formla giriş yapıp devam edecekseniz
  `t.adopt(anahtar, context)` ile yeni oturumu devredin.
- **WebGL kapalı:** başsız Chrome yazılımla 3B duvar kağıdını çizip birkaç çekirdeği yer ve
  sayfanın zamanlayıcılarını (15 sn'lik yetki yoklamasını) geciktirir. Bu yüzden Chrome
  `--disable-3d-apis` ile açılır, uygulama statik arka plana düşer. `E2E_WEBGL=1` açar.
- **Geliştirme sunucusunda** portal normalde "uygulamayı yükle" sayfası gösterir; testler sekme
  başına geliştirici atlatma bayrağını (`beu_pwa_dev_bypass`) kendisi koyar.
- **Giriş sınırı:** hesap başına 5 hatalı giriş 15 dakika kilitler; hatalı parola/kodla
  deneme sayısını düşük tutun.
- **İki sunucu süreci (`sse`):** aynı klasörde ikinci bir `next dev` ancak kendi derleme klasörüyle açılabilir
  (`BEU_DIST_DIR=.next-b`, `next.config.mjs`). `sse` paketi ikinci süreci `E2E_PORT+1` portunda ve aynı
  veritabanında kendisi başlatır (`E2E_DATABASE_URL`/`DATABASE_URL` yoksa o adımı atlar), `next-env.d.ts` ve
  `tsconfig.json`'ı geri yazar. Canlı olay (SSE) paketleri 15 sn'lik yoklamayı beklemez; yoklamaya düşüş
  yalnız `sse` paketinde (akış engellenerek) sınanır.
