# Orbit Community OS — Uçtan Uca Mimari, Veri ve Fonksiyon Denetimi

**Tarih:** 2026-10-30  
**Kapsam:** `src/apps`, `src/app/api`, `src/server/db`, `src/db`, pencere/DE katmanı, yerel kalıcılık, kimlik/RBAC, veri modeli, test/CI ve release yüzeyi.  
**Yöntem:** Manifest/registry taraması, 156 API rotası, 47+ tablo, 17 uygulama, üretilen `APP_SURFACE_INDEX.md` ham buton/form envanteri, canlı API/DB testleri ve statik kod okuma.

> Bu rapor bir “iyi niyet değerlendirmesi” değildir. Var olan kodun gerçek davranışını ve açık kalan riskleri esas alır.

---

## 0. Yönetici özeti

### Karar

**Herkese açık açık kaynak release: HAYIR.**  
**Davetli beta / iç kullanım: KOŞULLU EVET.**  
**Kendi sunucusunda deneyen teknik kullanıcı: güvenlik sertleştirmesi sonrası evet.**

Uygulama ciddi bir ürün iskeleti; ancak “production-ready open-source platform” iddiasını taşımak için gereken hukuki, güvenlik, test ve operasyonel olgunluk henüz yok.

### Puanlama

| Alan | Puan | Kısa gerekçe |
|---|---:|---|
| Vizyon ve kapsam | 8/10 | 17 manifest, 16 kullanıcıya açık uygulama, web-desktop, SoC, OAuth, komiteler |
| Modülerlik | 7/10 | Manifest tabanlı registry, ayrı context’ler, dinamik app yükleme |
| Veri mimarisi | 4/10 | `users` monoliti, legacy view’lar, çift isimlendirme, dağınık source-of-truth |
| Güvenlik | 4/10 | WAF/2FA/passkey var; bağımlılık açıkları ve zayıf varsayılanlar var |
| Test/CI | 4/10 | Test altyapısı var; kritik DB/UI akışları CI kapısı değil |
| Açık kaynak uyumu | 2/10 | Lisans, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT yok |
| Operasyonel olgunluk | 3/10 | Root compose eksik, varsayılan DB parolası, migration rollback yok |
| **Genel** | **4/10** | **İyi beta; sorumlu public release değil** |

### Bu denetim sırasında kapatılanlar

- Database Studio tablo/data/schema/import API’lerindeki camelCase uyumsuzluğu düzeltildi.
- Şema grafiğindeki `undefined`/yinelenen key uyarısı giderildi.
- Bildirim polling’indeki unhandled `Failed to fetch` hatası yakalandı.
- Kayıt doğrulama maili SMTP yokken `mail_outbox` kuyruğuna alınıyor; admin onay paneli eklendi.
- Topluluk kimliği DB’den runtime config’e senkronize edildi; mail başlığındaki eski “English Community” düzeltildi.
- SOC Change History, Settings/Roles CSS’inden ayrılıp SOC varyantına alındı.
- `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` eklendi.
- `APP_SURFACE_INDEX.md` otomatik üretildi.


1. **Lisans yok.** README “open-source” diyor; `package.json.license` ve `LICENSE` dosyası yok. `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` artık var, fakat lisans kararı hâlâ ürün sahibinde.
2. **3 critical dependency vulnerability** (`next`, `dompurify`); toplam 22 açık.
3. **Root `docker-compose.yml` çalışma ağacında silinmiş**, README hâlâ onu kullanmayı söylüyor.
4. **Varsayılan PostgreSQL parolası** `orbit_secret_2026`; compose’da 5432 dışarı açık.
5. **Database API sözleşmesi** yakın zamanda tamamen kırıktı (`table_name`/`tableName` uyumsuzluğu); otomatik regresyon testi yok.
6. **Legacy `kullanicilar` view’ı** aynı alanları iki isimle sunuyor; `SELECT *` çıktısı yanıltıcı.
7. **CI gerçek kullanıcı akışlarını çalıştırmıyor**: UI E2E, mail outbox onayı, passkey, admin reset, DB API.
8. **DB Studio domain katmanını bypass ediyor**; doğrudan tablo mutasyonu iş kurallarını atlayabilir.
9. **Yerel ve sunucu state’i karışık**: wallpaper seçimi, pencere düzeni, bildirim “görüldü” bilgisi tarayıcıda; kullanıcı hesabına bağlı değil.
10. **Tek `users` tablosu** kişi + hesap + üyelik + güvenlik telemetrisini birlikte taşıyor; hedef modelden sapıyor.

---

## 1. Sistem topolojisi

```
Next.js App Router
├── src/app/api/*                 156 route
├── src/apps/*                    17 manifest + UI
├── src/core
│   ├── apps                      manifest/registry/loader
│   ├── windows                   pencere state ve komutlar
│   ├── session                   kimlik/rol istemcisi
│   ├── shell / theme / sound     DE kabuğu
│   ├── persistence               IndexedDB workspace
│   ├── notifications             SSE + polling
│   └── permissions               RBAC
├── src/server/db                 domain repository’leri
├── src/db                        pool, migration, audit, roles
└── PostgreSQL                   47+ tablo, legacy view’lar
```

### İstek yaşam döngüsü

```
UI action
  → fetch('/api/...')
  → route guard (requireApp / requireAdmin / requireDatabaseAdmin)
  → server service/repository
  → PostgreSQL
  → JSON DTO
  → app hook/state
  → window/DE veya başka uygulama
```

### Pencere/DE yaşam döngüsü

```
manifest.ts
  → registry.gen.ts / loaders.gen.ts
  → APP_COMPONENTS (dynamic import)
  → WindowFrame
  → AppContent
  → useAppCommand (menü/kısayol)
```

Manifest; uygulamanın başlığı, ikonu, izni, penceresi, menüsü, bildirim türleri ve yüklenecek bileşeni **tek kaynaktan** tanımlar. Bu, projenin en güçlü mimari kararıdır.

---

## 2. Source of truth matrisi

| Alan | Kanonik kaynak | Diğer kopyalar | Çakışma / risk |
|---|---|---|---|
| Kişi/hesap/üyelik | `users` | `kullanicilar` compatibility view | Aynı alan iki isimle; `users` monoliti kişi/hesap/üyeliği ayırmıyor |
| Rol | `roles` | `role_permissions`, session cache, manifest permission | Cache invalidation ve legacy rol kimlikleri |
| Uygulama tanımı | `src/apps/*/manifest.ts` | `registry.gen.ts`, `loaders.gen.ts`, `apps.config.ts` | Generated dosyalar build’de güncellenmeli |
| Topluluk kimliği | `system_settings.kulup_adi/domain` | `data/runtime-config.json`, `CONFIG`, env | Mail eski “English Community” gösteriyordu; init sync eklendi |
| Üyelik politikası | `system_settings.membership_policy` | UI form state | Server enforcement ile UI aynı normalize modeli kullanmalı |
| Form alanları | `form_fields` | `member_field_values` | Snapshot/legacy alanlar; arşivleme |
| Yasal metin | `legal_documents` | `legal_document_versions`, `legal_acceptances` | Version + hash kanıtı doğru; eski metinler arşivde |
| Takım/komite | `teams`, `team_members` | `team_application_decisions`, `committee_meetings` | Komite ayrı tablo değil, `teams.type`; oy hakkı membership’te |
| Karar | `decisions` | `tutanaklar_kararlar` view | Karar body/oy alanları yeni; legacy belge türleri |
| Proje | `projects` | `owner_team_id`, `teamId`, `olusturanId`, `created_by` | Aynı ilişki iki alan setiyle temsil ediliyor |
| Etkinlik | `events` | `owner_team_id`, `owner_user_id`, `olusturanId`, `created_by` | Aynı çift temsil |
| Posta | IMAP sunucusu | `mail_outbox`, SMTP settings | İşlem e-postaları queue; gelen kutusu DB’de değil |
| Dosya | `files` + `data/uploads` | app-specific URL’ler | Merkezi sahiplik/erişim politikası zayıf |
| Bildirim | SQL veri + `olaylar` SSE | manifest notification kinds | Tek merkezi outbox/event log yok |
| Audit | `audit_logs` (`denetim_kaydi`) | `system_logs`, `soc_incidents` | Üç ayrı denetim/telemetri alanı |
| Pencere/DE | Browser IndexedDB | `localStorage` wallpaper | Sunucuya bağlı değil; cihazlar arası taşınmıyor |
| Dosya önizleme | Media viewer window | chat/upload metadata | Geçici pencere; restore edilmiyor |

### Temel sonuç

Sistemde **tek bir genel “source of truth” katmanı** yok. Domain bazında iyi kararlar var; fakat aynı kavramın (kimlik, sahiplik, rol, posta kimliği, audit) birden fazla temsili bulunuyor.

---

## 3. Uygulama-arası veri akışları

```
Settings (policy/identity/legal/forms/roles)
   ├─→ Members (kayıt politikası, roller, alanlar, rıza)
   ├─→ Auth (OTP, legal acceptance, invite)
   ├─→ Mail (kimlik, SMTP, alıcı grupları)
   ├─→ All apps (RBAC/window permission)
   └─→ SOC (audit, security)

Members / Roles
   ├─→ Teams (üyelik, kaptanlık)
   ├─→ Committees (üyelik/oy hakkı)
   ├─→ Projects (owner_user_id)
   ├─→ Events (owner_user_id)
   ├─→ Mail (role/team/committee recipient groups)
   └─→ Audit (rol/üyelik değişimleri)

Teams / Committees
   ├─→ Projects (owner_team_id)
   ├─→ Events (owner_team_id)
   ├─→ Decisions (body_id)
   ├─→ Meetings (committee_id)
   ├─→ Mail (recipient groups)
   └─→ Teams app (Kanban, roster)

Events
   ├─→ Attendances → Members (attendance count)
   ├─→ Certificates (event-linked certificates)
   ├─→ Notifications
   └─→ Projects (event/project link where present)

Mail
   ├─→ Members (recipient directory)
   ├─→ Teams/Committees (recipient groups)
   ├─→ Roles (recipient groups)
   └─→ Mail outbox → registration/password reset

Files
   ├─→ Budget (receipts)
   ├─→ Inventory (photos)
   ├─→ Chat (attachments)
   ├─→ Mail (attachments via IMAP)
   └─→ Certificates (PDF output)
```

### Kim neyi “biliyor”?

| Değişiklik | Yazan | Okuyan / tüketen | Anlık bildirim |
|---|---|---|---|
| Üye rolü | Settings/Members | Tüm app permission’ları, Teams, Mail groups, Audit | `olaylar` / session refresh |
| Üyelik durumu | Members/Admin | Auth, Members, Teams, Mail | `olaylar` |
| Takım üyeliği | Teams | Members roster, Projects/Events owner, Mail, Committees | Kısmi |
| Komite kararı | Decisions | Decisions, Committees, Mail, Audit | Yok (yalnız kayıt) |
| Yasal metin | Settings/Legal | Auth kayıt, Hesabım, Reconsent | Yok (yeniden onay kullanıcı ekranında) |
| Kayıt politikası | Settings | Auth register | Anlık config okuma |
| Topluluk kimliği | Settings | UI, mail, PWA manifest | Init sync + runtime config |
| Mail gönderimi | Auth/Admin | Mail outbox, SMTP | Queue paneli |
| Audit | Tüm yazma yolları | SOC Change History | `audit_logs` |

### Eksik entegrasyonlar

- Teams/committee üyeliği değiştiğinde proje/etkinlik sahipliği otomatik doğrulanmıyor.
- Bir takım kapatıldığında projeler/etkinlikler/kararlar için **orphan policy** yok.
- Bir kullanıcı anonimleştirildiğinde team lead/project owner/event owner ilişkileri tamamen normalize edilmiyor; isimler anonimleşiyor ama sahiplik ID’leri kalıyor.
- Legal doküman güncellendiğinde ilgili kullanıcıya merkezi “reconsent gerekli” push/bildirimi yok; Hesabım ekranına girince görüyor.
- Mail outbox onayı ile registration OTP yaşam süresi arasında otomatik uzatma var; fakat onay reddedilirse kullanıcıya ayrı bildirim yok.
- Chat/Notes/Projects/Events arasında ortak “mention/activity” veri modeli yok.

---

## 4. Pencere yönetimi, DE ve yerel durum

### Sunucu tarafı

- Manifest → permission → window metadata.
- `requireApp` sunucu guard’ı.
- Session cookie; rol/permission sunucudan.
- Uygulama verisi API’den.

### İstemci tarafı

- Pencere konumu/boyutu/minimize/maximize: window store.
- Pencere düzeni: IndexedDB (`saveWorkspaceSession`).
- Aktif wallpaper: `localStorage` + IndexedDB; **sunucuya yazılmaz**.
- Bildirim “görüldü” zamanı: `localStorage` (`beu_notif_seen:<userId>`).
- Dil/tema/ses: çoğunlukla yerel tercih.
- Özel wallpaper dosyası: sunucuda; seçim yerelde.

### Riskler

1. Aynı kullanıcı farklı cihazda farklı wallpaper/pencere düzeni görür.
2. Özel wallpaper seçimi cihazda kalır; başka cihazda katalogdan yeniden seçilmesi gerekir.
3. Admin özel wallpaper’ı silerse eski yerel URL 404 olur.
4. Bildirim “görüldü” bilgisi cihaz bazlıdır; çoklu cihazda tutarsızdır.
5. Pencere durumu sunucuda olmadığı için “oturum devam ettirme” cihazlar arası çalışmaz.
6. IndexedDB restore yalnızca built-in wallpaper’ları kabul ediyor; custom wallpaper URL’si restore edilmez (ilk localStorage değeri kurtarır, ama yeni cihazda katalogdan seçim gerekir).

### “Daha iyisi yapılabilir” notu

DE state’i için üç katman ayrılmalı:
- **Sunucu:** kullanıcı tercihleri (wallpaper, tema, dil, bildirim görüldü).
- **Yerel:** pencere geometrisi/geçici UI state.
- **Cihaz:** PWA/cihaz kimliği.

---

## 5. Mini-app bazlı denetim

> Buton/form sayıları `docs/APP_SURFACE_INDEX.md` içindeki otomatik taramadan alınmıştır; bu sayılar statik JSX yüzeyini yaklaşık ölçer, çalışma zamanı koşullarını tam kapsamaz. Menü komutları ve kısayollar ayrıca manifestten gelir.

### 5.1 Budget / Finans

- **Yetki:** `kullan`, `yonet`.
- **UI:** 25 buton, 16 form alanı.
- **API:** `/api/budget`, `/api/budget/vaults`, `/api/upload`.
- **Tablolar:** `budget_records`, `files`, `users`, `teams`, audit.
- **Akış:** kasa seçimi → ledger → gelir/gider/transfer → receipt upload → audit.
- **Eksikler:** kasa-team ilişkisi `teamId`; takım kapanınca kasa politikası yok. CSV dışa aktarımı var; mutabakat/çift kayıt garantisi yok.
- **Daha iyisi:** budget line + double-entry ledger ayrımı, kasa kapanış dönemi, onay workflow’u.

### 5.2 Certificates / Sertifikalar

- **Yetki:** `kullan`, `yonet`.
- **UI:** 22 buton, 10 alan.
- **API:** `/api/certificates`, `/api/community`, `/api/events`, `/api/members`, `/api/profile`.
- **Tablolar:** `certificates`, `users`, `events`, files/PDF output.
- **Akış:** event/member seçimi → sertifika üretimi → PDF → public `/verify`.
- **Eksikler:** imzacı modeli ayrı tablo değil; sertifika iptal politikası/expiry yok; PDF üretimi server/client dağınık.
- **Daha iyisi:** `certificate_templates`, `certificate_signatories`, immutable issue snapshot.

### 5.3 Chat / Mesajlar

- **Yetki:** herkese açık `kullan`; `yonet`.
- **UI:** 81 buton, 14 alan.
- **API:** `/api/chat/messages`, `/api/chat/poll`, `/api/chat/rooms`, `/api/chat/stream`, `/api/chat/upload`.
- **Tablolar:** `chat_rooms`, `chat_members`, `chat_messages`, `chat_polls/options/votes`, `files`.
- **Akış:** oda → üyelik → mesaj → poll → SSE.
- **Eksikler:** mesaj silme/retention, read receipt, mention, dosya erişim kontrolü, room ACL’nin team/committee ile birleşmesi.
- **Daha iyisi:** tek `conversation` modeli + policy; mesaj arama indeksi.

### 5.4 Database / Veritabanı Studio

- **Yetki:** admin/`database`.
- **UI:** 74 buton, 31 alan.
- **API:** auth, tables, data, schema, query, mutate, import, audit.
- **Tablolar:** tüm şema + `information_schema`.
- **Akış:** 2FA/passkey → kısa ömürlü db token → tablo/veri/SQL.
- **Eksikler:** domain katmanını tamamen bypass ediyor; hücre düzenleme audit’i sınırlı; satır düzeyi erişim yok; SQL sonuçları hassas veri maskeleme dışında korunmalı.
- **Daha iyisi:** DB Studio’yu “break-glass” moduna al, yalnızca read-only + kontrollü migration; tüm mutasyonlar audit + onay.

### 5.5 Decisions / Yönetişim

- **Yetki:** `kullan`, `yonet`.
- **UI:** 13 buton, 17 alan.
- **API:** `/api/committees`, `/api/committees/members`, `/api/decisions`.
- **Tablolar:** `teams` (committee), `team_members`, `committee_meetings`, `decisions`, `users`.
- **Akış:** komite → üye/oy hakkı → toplantı → karar (body_id, oy).
- **Eksikler:** karar yayınlama/duyuru akışı yok; karar-toplantı ilişkisi yok (meeting_id); oy kayıtları ayrı tablo değil, sadece sayı.
- **Daha iyisi:** `committee_motions`, `committee_votes`, `decision_meetings`.

### 5.6 Events / Etkinlikler

- **Yetki:** `kullan`, `yonet`.
- **UI:** 35 buton, 3 alan (form çoğu modal içinde).
- **API:** `/api/events`, attendance/check-in alt rotaları.
- **Tablolar:** `events`, `event_registrations`, `attendances`, `users`.
- **Akış:** event → kayıt → QR/kısa kod → attendance → certificate/member metrics.
- **Eksikler:** owner team/user yeni; UI’da tam seçici yok. Event-project ilişkisi yok. Check-in kodu güvenliği/expiry.
- **Daha iyisi:** event series, ticket types, capacity waitlist, attendance policy.

### 5.7 Inventory / Envanter

- **Yetki:** `kullan`, `yonet`.
- **UI:** 27 buton, 13 alan.
- **API:** `/api/inventory`, `/api/members`.
- **Tablolar:** `inventory`, `inventory_activities`, `users`.
- **Akış:** eşya → ödünç → iade → süre uzatma → hasar/kayıp.
- **Eksikler:** lokasyon, seri no unique, rezervasyon, geçmiş snapshot.
- **Daha iyisi:** item lifecycle state machine + barcode/QR.

### 5.8 Mail / Posta

- **Yetki:** admin.
- **UI:** 63 buton, 10 alan.
- **API:** `/api/mail`, `/api/mail/outbox`, `/api/mail/groups`, action, uid.
- **Tablolar:** IMAP external; `mail_outbox`, `users`, teams/roles.
- **Akış:** IMAP liste → detay → gönder → outbox onayı.
- **Eksikler:** mailbox tenant, attachment güvenliği, mail outbox onayı E2E değil; SMTP yokken kullanıcı deneyimi yeni.
- **Daha iyisi:** transactional mail provider adapter, delivery webhook, retry/backoff.

### 5.9 Media Viewer

- **Yetki:** internal window.
- **UI:** 6 buton, 0 alan.
- **API:** yok; chat/upload verisini işler.
- **Akış:** dosya önizleme → download.
- **Eksikler:** MIME/URL allowlist, oturum bağlamı.
- **Daha iyisi:** ortak `FilePreviewService`.

### 5.10 Members / Üyeler

- **Yetki:** `kullan`, `yonet`.
- **UI:** 29 buton, 26 alan.
- **API:** `/api/members`, `/api/members/[id]`, `/api/members/[id]/password-reset`, `/api/form-fields`, `/api/roles`, `/api/posta/alicilar`.
- **Tablolar:** `users`, `roles`, `role_permissions`, `membership_applications`, `invitations`, `member_field_values`, `form_fields`, `legal_acceptances`, `teams`, audit.
- **Akış:** roster → filtre → detay → düzenle → rol/statü → onay/red → e-posta.
- **Eksikler:** `users` monoliti; legacy `kullanicilar` view; rol listesi limitleri; admin reset e-postası yeni; invite team ataması UI’da yok.
- **Daha iyisi:** person/account/membership tabloları; merkezi `MemberQueryService`.

### 5.11 News / Haberler

- **Yetki:** `kullan`, `yonet`.
- **UI:** 15 buton, 8 alan.
- **API:** `/api/news`, public `/api/public/v1/news`.
- **Tablolar:** `news`, `users`, files/notifications.
- **Akış:** draft → publish tiers → public RSS/API.
- **Eksikler:** yayın iş akışı/onay, medya, çoklu dil.
- **Daha iyisi:** content workflow + revision table.

### 5.12 Notes / Notlar

- **Yetki:** herkese açık `kullan`.
- **UI:** 48 buton, 7 alan.
- **API:** `/api/notes`, `/api/notes/folders`.
- **Tablolar:** `user_notes`, `user_note_folders`.
- **Akış:** kişisel not → klasör → trash.
- **Eksikler:** “encrypted-at-rest” iddiası kodda doğrulanmalı; paylaşım/ağ yok; arama indeksi.
- **Daha iyisi:** versiyon, paylaşım policy, server-side encryption kanıtı.

### 5.13 Projects / Projeler

- **Yetki:** `kullan`, `yonet`.
- **UI:** 26 buton, 11 alan.
- **API:** `/api/projects`, `/api/projects/[id]`, `/api/teams`.
- **Tablolar:** `projects`, `project_likes`, `users`, `teams`.
- **Akış:** öneri → yayın/arşiv → star → team/owner.
- **Eksikler:** owner_user UI seçici yok; owner_team/teamId çift anlam; contributor modeli yok.
- **Daha iyisi:** project_members/contributors, explicit lifecycle.

### 5.14 Settings / Ayarlar

- **Yetki:** herkese açık `kullan`; yönetim `yonet`; rol/OAuth/veri admin.
- **UI:** 98 buton, 117 alan.
- **API:** 35+ settings/profile/legal/auth endpoint.
- **Tablolar:** `system_settings`, `form_fields`, `legal_documents/versions/acceptances`, `roles/role_permissions`, `custom_wallpapers`, `invitations`, `mail_outbox`, audit.
- **Akış:** hesap → güvenlik → görünüm → sistem politikaları.
- **Eksikler:** tek dev panel; bazı ayarlar server, bazıları local; audit/roles yetki ayrımı; wallpaper custom asset; form preview.
- **Daha iyisi:** Settings’i policy engine + typed config registry’ye ayır.

### 5.15 SOC / Savunma

- **Yetki:** `kullan`, `yonet`.
- **UI:** 150 buton, 36 alan; menü komutları 13.
- **API:** `/api/soc`, `/api/soc/stream`, inspection, playbooks, testbench, audit.
- **Tablolar:** `security_blocks`, `soc_incidents`, `system_logs`, `audit_logs`, `users`, session telemetry.
- **Akış:** telemetry → incident → containment → audit.
- **Eksikler:** çok geniş yetki; DB freeze/terminal kill gerçek operasyonel risk; audit UI artık SOC’da; test payload’ları statik taramada yanlış pozitif üretiyor.
- **Daha iyisi:** ayrı `security_admin` rolü, dört göz onayı, playbook dry-run.

### 5.16 Teams / Takımlar

- **Yetki:** `kullan`, `yonet`.
- **UI:** 75 buton, 51 alan.
- **API:** `/api/teams`, `/api/teams/tasks/[id]`, `/api/members`, `/api/team-categories`.
- **Tablolar:** `teams`, `team_members`, `team_application_decisions`, `team_tasks/items/comments/activities`, `users`, projects/events.
- **Akış:** keşfet → başvuru → kaptan onayı → Kanban → üyeler.
- **Eksikler:** team role serbest metin; kaptan/üye yetkisi record-level; team closure cascade yok.
- **Daha iyisi:** team/committee role tablosu, explicit membership states.

### 5.17 Terminal

- **Yetki:** `kullan`/`yonet` (yüksek risk).
- **UI:** 6 buton, 1 alan.
- **API:** session/input/resize/stream.
- **Tablolar:** shell session in-memory; logs/audit.
- **Akış:** 2FA/passkey → PTY session → SSE stream.
- **Eksikler:** container escape/shell command denylist yok; idle timeout var; passkey bypass doğru.
- **Daha iyisi:** allowlist command policy, per-command approval, audit transcript.

---

## 6. Veri mimarisi bulguları

### 6.1 `users` monoliti

`users` 30 kolonda:
- kişi (ad, bio, avatar, department),
- hesap (email, password, role),
- üyelik (status, xp),
- güvenlik telemetrisi (IP/UA/TOTP/session)

tutuyor. Hedef modelde bunlar ayrılmalı. Tek topluluk kararı doğru; fakat person/account/membership ayrımı hâlâ implementasyon borcu.

### 6.2 Legacy view ve çift isimlendirme

`kullanicilar` view’ı kasıtlı olarak:
```
first_name AS ad,
first_name,
password_hash AS sifrehash,
password_hash,
```
gibi çift kolonlar üretir. `SELECT *` çıktısı iki kat görünür. Base `users` temizdir; fakat DB kullanıcıları için bu kafa karıştırıcıdır.

**Daha iyisi:** compatibility view’ı yalnızca legacy alias’larla sınırla; yeni kodun `users` kullanmasını zorunlu kıl; view’ı deprecate et.

### 6.3 camelCase/snake_case sözleşmesi

`getPgPool` tüm satırları camelCase’e çevirir. Buna rağmen:
- `/api/database/tables` `table_name` okuyordu.
- `/api/database/data` `column_name`, `data_type`, `foreign_table_name` okuyordu.
- `/api/database/schema` aynı hatayı taşıyordu.
- `/api/database/import` aynı.

Sonuç: tablo listesi boş, veri grid’i boş, şema grafiği `undefined` key üretiyordu. Düzeltildi; ancak bu, **tek bir satır eşleme sözleşmesi** olmadığını gösteriyor.

**Daha iyisi:** tüm DTO’lar için açık `RowMapper`/repository contract; API’lerde snake_case property erişimini yasaklayan lint/test.

### 6.4 API alias çokluğu

156 route içinde aynı işlevi gören Türkçe/İngilizce alias’lar var:
- `/api/members` ↔ `/api/uyeler`
- `/api/projects` ↔ `/api/projeler`
- `/api/events` ↔ `/api/etkinlikler`
- `/api/teams` ↔ `/api/takimlar`
- `/api/budget` ↔ `/api/butce`
- `/api/news` ↔ `/api/haberler`
- `/api/audit` ↔ `/api/denetim`

Bakım ve güvenlik yüzeyini ikiye katlar.

**Daha iyisi:** tek canonical route + 308 redirect/deprecated alias; API sözleşmesi.

### 6.5 Uygulamalar arası doğrudan DB erişimi

Çoğu uygulama kendi domain repository’sini kullanıyor; fakat:
- Database Studio tüm tablolara doğrudan erişir.
- Chat/Teams/Projects birbirinin tablolarını JOIN’ler.
- `members` roster, `teams` üyelerini ve `projects` sahiplerini okur.
- `mail` alıcı grupları users/teams/roles/committees tablolarını birleştirir.

Bu, OKB (tek doğru kaynak) açısından iyi; fakat **servis sınırı** yok. Her repository SQL’i kendi yorumluyor.

**Daha iyisi:** `IdentityService`, `MembershipService`, `TeamService`, `PolicyService` gibi iç servisler; app’ler yalnızca bu servisleri çağırsın.

### 6.6 Audit kapsamı

Audit yalnızca allowlist’li işlemleri yazıyor:
`role.*`, `uye.*`, `basvuru.*`, `ayar.smtp`, `guvenlik.2fa_kapat`, DB hücre.
Eksik:
- Database Studio SQL/mutate işlemleri tam kapsanmıyor.
- Mail outbox onay/red yalnız system log.
- Form/legal/wallpaper/identity değişimleri system log’da, audit’te değil.
- Takım/komite kararları kendi tablosunda; merkezi audit görünümünde daha sınırlı.

**Daha iyisi:** tek `AuditWriter`; tüm mutation’lar zorunlu audit context; audit okuma SOC.

### 6.7 Dosya sahipliği

`files` tablosu ve disk `data/uploads` var; fakat dosyanın hangi app’e/record’a ait olduğu, kimin erişebildiği ve retention süresi merkezi değil. Chat, budget receipt, inventory image, certificates PDF farklı yollar kullanıyor.

**Daha iyisi:** `file_objects` + `file_links(owner_type, owner_id)` + signed URL + virus scan.

### 6.8 Migration ve transaction

- `schema_migrations` custom; migration’lar idempotent `IF NOT EXISTS`.
- `ensurePostgresInit` cached; yeni migration için restart gerekir.
- Rollback/down migration yok.
- Bazı view’lar `DROP/CREATE` ile yeniden kuruluyor; bağımlılık riski.
- Domain yazımları çoğunlukla `withTransaction`, fakat app’ler arası çok adımlı işlemlerde dağıtık transaction yok.

**Daha iyisi:** migration framework (drizzle/prisma veya node-pg-migrate), forward-only ama test edilmiş; startup’ta otomatik migration lock.

---

## 7. Güvenlik, test ve release bulguları

### 7.1 Lisans/açık kaynak

- `LICENSE` yok.
- `package.json.license` yok.
- `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` eklendi.
- `LICENSE` ve `package.json.license` hâlâ yok; README “open-source” diyor, hukuken temelsiz.

**Karar gerekli:** MIT / Apache-2.0 / AGPL-3.0. Tercih ürün sahibinin.

### 7.2 Bağımlılıklar

`pnpm audit --prod`:
- 22 vulnerability
- 3 critical
- 4 high
- 13 moderate
- 2 low

Kritikler:
- `next` `>=16.0.0 <=16.4.0` → `>=16.4.1`
- `dompurify` `>=3.4.4 <=3.4.16` → `>=3.4.17`

### 7.3 Deployment

- Root `docker-compose.yml` silinmiş; README onu kullanıyor.
- `infra/docker/docker-compose.yml` varsayılan `orbit_secret_2026` ve `5432:5432`.
- Production’da secret üretimi/rotation yok.
- `data/runtime-config.json` DB URL’si içeriyor; gitignore’da ama yedeklerde sızabilir.

### 7.4 Test/CI

Var:
- `pnpm verify` (typecheck, lint, manifest)
- `pnpm test:security`
- `pnpm build`
- UI E2E suite dosyaları

Yok / eksik:
- `pnpm test` standardı.
- DB API contract testleri.
- Mail outbox onayı E2E.
- Passkey ile terminal/database E2E.
- Admin şifre sıfırlama E2E.
- CI’da UI E2E çalıştırma.
- Migration smoke testi (fresh DB + upgrade DB).

### 7.5 Kullanıcı verisi

- `users` hassas telemetri (IP/UA) ve TOTP secret taşıyor.
- TOTP secret şifreli mi? `secretBox` kullanılıyor; doğrulanmalı.
- Anonimleştirme IP/UA temizliyor; audit geçmişi PII taşımaya devam ediyor.
- `mail_outbox` payload şifreli; code kuyruğu admin onayına bağlı.

---

## 8. Öncelikli yol haritası

### P0 — Public release blocker

1. Lisans + SECURITY + CONTRIBUTING + CODE_OF_CONDUCT.
2. Next/DOMPurify/Nodemailer/source-map-js güvenlik yükseltmeleri; audit temiz.
3. Root production compose’u geri getir; default DB parolasını kaldır, secret üret.
4. DB API sözleşme testleri + camelCase lint kuralı.
5. CI’a fresh DB migration + DB API integration + UI smoke ekle.
6. DB Studio’yu break-glass/read-only moda al; tüm mutasyonları audit’e bağla.
7. Legacy `kullanicilar` view’ını sadeleştir veya deprecate et.

### P1 — Beta hardening

8. Person/account/membership ayrımı için migration planı.
9. Ortak `IdentityService`/`PolicyService`/`FileService`.
10. Audit kapsamını tüm mutation’lara genişlet.
11. Dosya sahipliği/retention/signed URL.
12. Mail outbox onayı, passkey, admin reset E2E.
13. Wallpaper/pencere/bildirim state’ini kullanıcı hesabına bağla.
14. Backups/restore ve migration rollback testi.

### P2 — Mimari olgunluk

15. Team/committee role tablosu; serbest metin yerine scoped role.
16. Karar-toplantı-oy kayıtlarını ayrı tablolara ayır.
17. Events/projects owner modelini tekilleştir (`teamId`/`olusturanId` legacy temizliği).
18. Uygulama-arası olay/audit veri yolunu tek event bus’a bağla.
19. API alias’larını kaldır; canonical contract.
20. DB Studio dışında tüm SQL’i typed repository’lere taşı.

---

## 9. “Daha iyisi yapılabilir” notları

- **Kimlik:** tek `users` yerine `people`, `accounts`, `memberships`; tek topluluk olsa bile bu ayrım veri sahipliğini netleştirir.
- **Politika:** Settings’i “config UI” değil, versiyonlanmış policy engine yap.
- **DE:** pencere düzenini kullanıcı hesabına bağla; cihazlar arası deneyim.
- **Dosya:** tüm app’ler için tek `FileService`; app-specific upload kodu bırakma.
- **Audit:** her yazma yolunda zorunlu audit context; “audit’siz mutation” imkânsız olsun.
- **Test:** her API rotası için contract testi; DB camelCase sözleşmesi için tek test.
- **DB Studio:** domain’i bypass eden tek uygulama olmamalı; break-glass ve dört göz onayı.
- **Legacy:** `kullanicilar` view’ı yalnızca geriye dönük uyumluluk için; yeni kod `users` kullanmalı.
- **Release:** beta etiketi, açık güvenlik notu, imzalı artifact, checksum.

---

## Ek A — API grupları

- Auth: `/api/auth/*` (login, logout, me, register, 2FA, passkey, reset)
- Identity: `/api/identity`, `/api/community`, `/api/kulup`
- Members: `/api/members`, `/api/members/[id]`, password-reset, `/api/roles`
- Teams: `/api/teams`, tasks, discover
- Committees/Decisions: `/api/committees`, `/api/decisions`
- Projects: `/api/projects`, `/api/projects/[id]`
- Events: `/api/events`, attendance/check-in
- Budget: `/api/budget`, `/api/budget/vaults`
- Inventory: `/api/inventory`
- Certificates: `/api/certificates`, public verify
- News: `/api/news`, public v1
- Chat: `/api/chat/*`
- Notes: `/api/notes`, folders
- Mail: `/api/mail`, outbox, groups, action, uid
- Settings: `/api/settings/*`
- Legal: `/api/legal`, status, accept
- SOC: `/api/soc/*`
- Database: `/api/database/*`
- Terminal: `/api/terminal/*`
- OAuth/OIDC: `/api/oauth/*`, `/.well-known/*`
- Utility: uploads, custom assets, search, notifications, events stream

## Ek B — Tablo sahipliği

- Kimlik/güvenlik: `users`, `roles`, `role_permissions`, `webauthn_*`, `email_*`, `security_blocks`, `soc_incidents`, `system_logs`, `audit_logs`, `system_settings`
- Üyelik: `membership_applications`, `invitations`, `form_fields`, `member_field_values`, `legal_*`
- Takım/komite: `teams`, `team_members`, `team_application_decisions`, `team_tasks`, `team_task_*`, `committee_meetings`, `decisions`
- Proje/etkinlik: `projects`, `project_likes`, `events`, `event_registrations`, `attendances`
- Operasyon: `budget_records`, `inventory`, `inventory_activities`, `certificates`, `news`
- İletişim: `chat_*`, `mail_outbox`
- Kişisel: `user_notes`, `user_note_folders`
- Dosya: `files`, `custom_wallpapers`

## Ek C — Ham yüzey indeksi

Ayrıntılı buton/onClick/input envanteri: [`docs/APP_SURFACE_INDEX.md`](./APP_SURFACE_INDEX.md)

> Bu dosya otomatik üretilmiştir; 1.300+ satır buton/form kaydı içerir. Statik tarama olduğu için runtime koşulları, menü komutları ve klavye kısayolları için manifest ve ilgili hook’lar ayrıca okunmalıdır.
