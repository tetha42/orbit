# Uygulamalar: yeni uygulama nasıl eklenir

Masaüstündeki her mini uygulama (Takımlar, Etkinlikler, Posta…) `src/apps/<id>/` klasöründeki **tek bir dosyayla**, `manifest.ts` ile kayıt olur. Başka hiçbir yer (dock, başlatıcı, Spotlight, menü çubuğu, rol editörü, bildirim yetkileri, pencere varsayılanları) elle düzenlenmez; hepsi bu dosyadan türetilir.

## Adımlar

1. `src/apps/<id>/manifest.ts` oluştur (`<id>`: küçük harf/rakam, klasör adıyla aynı).
2. Uygulamanın bileşenini yaz (istersen aynı klasörde: `src/apps/<id>/<Ad>App.tsx`) ve manifestoda `component` ile göster.
3. `pnpm dev` (ya da `pnpm build`) kayıt listesini kendisi günceller; dev sunucusu açıkken yeni klasör de birkaç saniyede algılanır. Elle çalıştırmak için: `pnpm gen:apps`.

Oluşan `src/apps/registry.gen.ts` ve `src/apps/loaders.gen.ts` dosyaları otomatik üretilir, **elle düzenlenmez** ama commit edilir (`pnpm check` eskimişse hata verir).

## En küçük manifesto

```ts
import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'ornek',
	title: 'Örnek Uygulama',
	shortTitle: 'Örnek',
	description: 'Ne işe yaradığını anlatan tek cümle',
	en: { title: 'Sample App', shortTitle: 'Sample', description: 'One sentence about what it does' },
	category: 'Productivity', // 'Operations' | 'Finance' | 'Community' | 'Productivity'
	icon: 'Rocket', // herhangi bir lucide-react simgesi
	accentColor: '#0a84ff',
	window: { width: 800, height: 520, x: 120, y: 80 },
	component: { module: './OrnekApp', export: 'OrnekApp' }, // './' = bu klasör; ya da '@/…'
	permission: {
		ad: 'Örnek',
		kullan: 'Rol editöründe "kullan" seviyesinin ne yaptığı.',
		yonet: 'Rol editöründe "yönet" seviyesinin ne yaptığı.',
	},
} as const satisfies AppManifest;

export default manifest;
```

`satisfies AppManifest` zorunludur: eksik alan (özellikle `permission`) derlemede hata verir. **Her uygulama bir yetki uygulamasıdır**; yetkisiz uygulama yoktur.

## Alanlar

| Alan | Ne yapar |
| --- | --- |
| `id` | Klasör adı. `AppID` tipi ve `YetkiUygulamasi` tipi buradan türer. |
| `permission` | Rol editöründe görünen ad ve seviyelerin açıklaması (`ad`, `kullan`, `yonet`, isteğe bağlı `uyari`, `herkeseAcik`, `sira`). **Zorunlu.** |
| `title` `shortTitle` `description` `en` | Başlık, kısa başlık ve açıklama (Türkçe temel, İngilizce `en` içinde). |
| `category` `icon` `accentColor` `colors` `badge` `dockIcon` | Görünüm: kategori, simge adı, vurgu rengi, simge tonları (`icon` / `menu` / `search`), başlatıcı etiketi, dock görseli. Dock görseli yoksa simge vurgu renkli karoda çizilir. |
| `window` | `width` `height` `minWidth` `minHeight` ilk boyut; `x` `y` ilk konum; `z`, `open` isteğe bağlı. |
| `component` | `{ module, export }`: pencere açılınca tembel yüklenen bileşen; Dock hover ve Mobil touch ile önceden indirilir (`prefetchApp`). |
| `dock` `order` `shortcut` `hotkey` | Varsayılan dock sırası, liste sırası, menülerde görünen kısayol (`⌘1`) ve onu tetikleyen tuş (`1`). Verilmezse sona, kimliğe göre sıralanır. |
| `menu` | Menü çubuğu menüleri (aşağıda). Yoksa uygulama portal menülerini kullanır. |
| `notifications` | Bu uygulamanın ürettiği bildirim türleri ve alma seviyesi: `{ task: 'kullan', approval: 'yonet' }`. Sunucu bildirimleri buna göre süzer; `NotificationKind` tipi buradan türer. |

Pencereli olmayan, yalnızca yetki olarak var olan bir uygulama için `window`, `component` ve görünüm alanları atlanır (`PermissionOnlyManifest`; bugün bu biçimde bir uygulama yoktur, hepsi pencerelidir). Rol editörü ve sunucu yine de onu bilir; pencere alanları sonradan eklenince uygulama dock'ta görünür.

## Menüler

```ts
menu: {
	title: { tr: 'Örnek', en: 'Sample' }, // menü çubuğunda kalın görünen ad
	about: { id: 'about-ornek', label: { tr: 'Örnek Hakkında', en: 'About Sample' }, yetki: 'kullan', ac: true },
	categories: [
		{
			id: 'file',
			title: { tr: 'Kayıtlar', en: 'Records' },
			items: [
				{ id: 'new-ornek', label: { tr: 'Yeni Kayıt', en: 'New Record' }, shortcut: '⌘N', yetki: 'yonet', komut: 'new-record' },
			],
		},
	],
},
```

- İlk menü (`title`) `about` + `Pencereyi Kapat`, son menü `Pencere` (küçült/büyüt/kapat) otomatik eklenir; `categories` ikisinin arasına girer, `defaultItems` ilk menüye.
- `yetki`: öğe yalnızca bu seviyeye sahip rollere gösterilir (öğe hiç görünmez).
- `komut`: uygulamayı açar ve ona komut gönderir. Uygulama `useAppCommand('<id>', (komut) => …)` ile alır (`@/core/commands`).
- `ac: true`: yalnızca uygulamayı açar.
- Öğe `id`'leri portalın tamamında tekildir: aynı `id` iki uygulamada aynı etiketi taşımalıdır (`pnpm check` denetler).
- Özel davranış gerektiren öğeler (Hakkında penceresi, dışa aktarma…) menü çubuğunun `bindActions` fonksiyonunda `id` ile bağlanır.

## Doğrulama

- `pnpm verify`: kayıt dosyalarını tazeler, tsc + eslint + `check`.
- Yeni uygulama rol editöründe, dock'ta, başlatıcıda, Spotlight'ta ve menü çubuğunda kendiliğinden görünür; `admin` rolü hepsini yönetir, diğer roller rol editöründen yetki alır.

## Manifestin dışında kalanlar

Manifest görünüm ve yetkiyi kurar; uygulamanın çalışması için ayrıca yazılması gerekenler (sunucu yolu, tablo, bildirim kaynağı, arama kaynağı, çeviriler, testler) [`docs/ARCHITECTURE.md` bölüm 4](../../docs/ARCHITECTURE.md#4-yeni-uygulama-ve-yeni-rol-ekleme-rehberi)'de adım adım anlatılır.
