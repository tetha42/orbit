# Orbit Veri Platformu ve Üyelik Modeli — Yol Haritası

> Durum: **onaylanmış yön, uygulama başladı (Faz 0)**
> Kapsam: Settings, Auth (login/register), Members, Teams, Committees, Projects, Events, Mail ve bu uygulamaların beslediği tüm veri yüzeyleri.
> İlgili doküman: [`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md)

---

## 1. Onaylanan ürün kararları

| Karar | Seçim |
|---|---|
| Topluluk sayısı | **Tek topluluk** (bir Orbit instance = bir topluluk) |
| Global roller | **Tek birincil global rol** + takım/komite kapsamlı roller |
| Topluluk kimliği | **Marka düzeyinde**; vergi/sicil/yasal temsilci verisi tutulmaz |
| Kayıt modları | **Self + admin + invite**; bulk import yok |
| Onay | **Manuel onay**; otomatik onay yok |
| E-posta değişimi | **E-posta doğrulamalı self-servis** |
| Yasal rıza | **Gerçek ve kanıtlanabilir**; kim hangi belge sürümünü ne zaman kabul etti saklanır |
| Komite / takım | **Ayrı model**: komite karar mercii, takım çalışma grubu |
| Çoklu global rol | Varsayım: **tek birincil rol**. İhtiyaç doğarsa `role_assignments` ile genişletilir. |

### 1.1 Terimler

- **Kişi (Person):** Gerçek kişi. Hesabı olabilir, üyeliği olmayabilir.
- **Hesap (Account):** Kimlik doğrulama kimliği (şifre, passkey, TOTP, oturumlar).
- **Üyelik (Membership):** Kişinin topluluğa bağlılığı; üye no, statü, birincil rol, track, seviye.
- **Başvuru (Application):** Üyelik kazanım süreci; form snapshot'ı, rıza, karar.
- **Rol:** Yetki demeti. Kişi ya da takım değildir.
- **Takım:** Görev/proje/bütçe/sohbet etrafında çalışan örgütsel birim.
- **Komite:** Karar veren mercii; üyeleri, oy hakkı, toplantı ve kararları vardır.
- **Tüzel kişi:** Hukuken topluluk/dernek/vakıf/şirket. Orbit tek toplulukta bunu marka düzeyinde tutar.

---

## 2. Değişmez ilkeler

1. **Tek doğruluk kaynağı:** Aynı alan (track, rol, e-posta, üye no) yalnızca bir yerde tanımlanır; diğer yüzeyler okur.
2. **Kişi ≠ hesap ≠ üyelik:** Üçü ayrı sorumluluk ve yaşam döngüsüne sahiptir. Tek topluluk pragmatizminde aynı `users` satırında durabilirler, ama kodda ayrı tiplerle temsil edilir.
3. **Hesap durumu ≠ üyelik durumu:** Hesap aktifken üyelik `beklemede`, `mezun` veya `reddedildi` olabilir.
4. **Rol ≠ takım rolü:** Global yetki ile takım içi görev ayrıdır.
5. **Toplama yeri ≠ görünürlük ≠ düzenleme yetkisi:** Form alanı üç ayrı politikaya sahiptir.
6. **Settings politika üretir, kayıt düzenlemez.** Bireysel üye kaydı Members app'in sorumluluğudur.
7. **Members kişi kaydını yönetir, şema tanımlamaz.** Form/legal/rol tanımları Settings'tedir.
8. **Teams takımı yönetir, global rol tanımlamaz.** Takım rolleri Teams içinde atanır.
9. **Account kişinin kendi güvenliğini yönetir.** Başka üyenin güvenliğine müdahale yetkili yöneticide ve audit'lidir.
10. **Her ilişki durum + zaman + aktör taşır.** Üyelik, takım üyeliği, rol ataması, rıza.
11. **Silme yerine arşiv/anonimleştirme.** Özellikle form alanları, takımlar, belgeler.
12. **Her hassas yazma transaction + audit.** Profil, rol, statü, rıza, konfigürasyon.
13. **Türetilmiş veri kaynak değildir.** XP, üye sayısı, katılım sayısı hesaplanır; elle yazılmaz.
14. **İstemci ve sunucu aynı doğrulamayı kullanır.** Ayrı kopya validasyon yok.
15. **Rıza değiştirilemez kanıttır.** Admin rıza veremez; yalnız kişi kabul eder.

---

## 3. Hedef mimari

### 3.1 Katmanlar

| Katman | Varlıklar | Sahip |
|---|---|---|
| Aktör | `users`, `teams`, `committees` | Members / Teams / Settings |
| İlişki | `memberships` (kavramsal), `team_members`, `committee_members`, `role_assignments` (opsiyonel) | Members / Teams |
| Politika | `roles`, `role_permissions`, `form_fields`, `legal_documents`, `registration_policy` | Settings |
| İş | `projects`, `events`, `team_tasks`, `budget_records`, `inventory` | İlgili app |
| Kanıt | `membership_applications`, `legal_acceptances`, `audit_log` | Auth + Settings |
| Türetilmiş | XP, katılım/proje sayıları, rozetler | Hesaplanır |

### 3.2 ERD — tek topluluk (uygulama hedefi)

```text
users (kişi + hesap + üyelik pragmatizmi)
 ├─ webauthn_credentials                 (0..n passkey)
 ├─ membership_applications              (0..n başvuru; 1 açık)
 ├─ legal_acceptances ── legal_document_versions ── legal_documents
 ├─ member_field_values ── form_fields
 ├─ team_members ── teams ── team_categories
 │                    └─ team_type: working_group | committee
 ├─ committee_members ── committees
 ├─ committee_meetings ── committees
 ├─ decisions ── committees (karar mercii)
 ├─ projects (owner team/user, created_by)
 └─ events (organizer team/user)

audit_log
system_settings (registration policy, identity, limits)
```

### 3.3 ERD — çok topluluk (gelecek, şimdi uygulanmaz)

```text
organizations
 ├─ memberships ── users
 ├─ teams ── team_members
 └─ external_organizations
```

> Tek topluluk kararı nedeniyle `organizations`/`memberships` tabloları **şimdi eklenmez**. `users` üyelik alanlarını taşımaya devam eder; ancak kodda `Person`, `Account`, `Membership` tipleri ayrılır. Çok topluluk gerekirse bu yol haritasının 4. fazındaki geçiş şeması kullanılır.

---

## 4. Komite / takım bağdaştırma modeli

### 4.1 Ayrım

| | Takım (working group) | Komite (decision body) |
|---|---|---|
| Amaç | Üretmek, proje/görev yürütmek | Karar vermek, denetlemek, onaylamak |
| Üyelik | Katılım başvurusu/onay | Atama/seçim + görev süresi |
| Roller | Kaptan, geliştirici, tasarımcı | Başkan, üye, raportör, oy hakkı |
| İş nesneleri | Görev, proje, bütçe, sohbet | Toplantı, gündem, karar, oylama |
| Karar | Takım içi operasyonel | Bağlayıcı topluluk kararı |

### 4.2 Pragmatik uygulama (Faz 3)

- `teams` tablosuna `type` eklenir: `working_group` (varsayılan), `committee`.
- Ortak kimlik/üyelik altyapısı korunur; `team_members` komite üyeleri için de kullanılabilir.
- Komiteye özel alanlar:
  - `team_members.voting_right` (0/1)
  - `team_members.term_start`, `term_end`
  - `committee_meetings` (id, committee_id, date, agenda, minutes, status)
  - `decisions.body_id` (nullable, teams.id) — kararın hangi merci tarafından alındığı
  - `decisions.decision_type` (`resolution`, `appointment`, `budget`, `policy`, …)
- Uzun vadede grup türü artarsa `teams` → `groups` yeniden adlandırması yapılabilir; şimdi yapılmaz.

### 4.3 Karar akışı

1. Komite toplantısı oluşturulur.
2. Gündem maddeleri eklenir.
3. Üyeler oy verir / karar metni onaylanır.
4. Karar `decisions` tablosuna `body_id` ile yazılır.
5. Karar yayınlanır, audit'lenir, ilgili uygulamalara bildirim gider.

---

## 5. Yüzey sahipliği

| Veri | Tanımlama | Kayıt yönetimi | Denetim |
|---|---|---|---|
| Kişi kimliği | Members | Members / self (politika kadar) | Members aktivite + merkezi audit |
| Hesap güvenliği | Account | Account / admin reset | Güvenlik logları |
| Üyelik | Members | Members | Audit |
| Başvuru | Settings → Membership policy | Auth (submit) + Members (decision) | Audit |
| Rol tanımı | Settings → Roles | — | Audit |
| Rol ataması | Settings → Roles (limitler) | Members | Audit |
| Takım profili | Teams | Teams | Takım aktivitesi |
| Takım kategorisi | Settings → Teams | — | Audit |
| Komite | Teams/Governance | Teams/Governance | Audit |
| Kayıt politikası | Settings → Membership | — | Audit |
| Form şeması | Settings → Forms | — | Audit |
| Yasal metin | Settings → Legal | — | Audit |
| Rıza | Auth/Account | Yalnız kişi | **Değiştirilemez kanıt** |
| Marka | Settings → Identity | — | Audit |
| Proje | Projects | Projects | Proje aktivitesi |
| Etkinlik | Events | Events | Etkinlik aktivitesi |
| Merkezi denetim | — | — | SoC Studio → Change History (read-only; yönetim) |

### 5.1 Settings menü hedefi

- **Hesabım:** profil, güvenlik, rıza geçmişi, veri talepleri.
- **Üyelik:** kayıt politikası, başvuru formu, yasal metinler.
- **Topluluk:** kimlik/marka, takım kategorileri, roller, entegrasyonlar, e-posta.
- **Sistem:** audit, bakım, teşhis.
- Kişisel tercihler (duvar kağıdı, dock, görünüm, dil, depolama) ayrı kalır.

---

## 6. Faz planı

### Faz 0 — Kanamayı durdur ve temel kanıt altyapısı (bu tur)

**Amaç:** Kırık akışları düzeltmek; rıza ve kayıt verisinin güvenilir temelini atmak.

- [x] `/api/profilee/photo` ve `/api/profilee/password` yollarını düzelt.
- [x] `/api/roles` sözleşmesini UI ile hizala (`assignableRoles`).
- [x] Mobil “Reddet”i kalıcı silme yerine `reddedildi` yap.
- [x] `legal_documents` sürüm alanı + `legal_acceptances` tablosu.
- [x] Kayıtta zorunlu belgeleri sunucuda zorunlu tut; kabul kayıtlarını sakla.
- [x] Legal panelin “Ekle” akışındaki sessiz ezmeyi engelle.
- [~] Track için tek kaynak: `registration_core_fields.track.options`.
- [x] Profil API'si ve Account/Members filtreleri bu kaynağı kullansın.
- [ ] Kayıt ve admin üye ekleme track değerini config'e karşı doğrulasın. _(Fixture/test geçişiyle birlikte Faz 1'e alındı.)_
- [x] Profil değişikliklerine audit ekle.
- [x] Roster'da yalnız `member|both` ve etkin custom alanları göster (scope sızıntısını kapat).
- [ ] Faz 0 testleri. _(Legal akışı canlı doğrulandı; otomatik testler Faz 1 ile eklenecek.)_

**Kabul:** Typecheck/lint/check yeşil; kayıt rızasız oluşamaz; kabul kaydı DB'de; self profil/şifre/foto çalışır; track tek kaynaktan gelir.

### Faz 1 — Tek üye yazma modeli ve admin düzenleme

**Amaç:** Aynı üyenin dört ayrı kod yolu yerine tek servis üzerinden yönetilmesi.

- [~] `src/server/members/service.ts`: `updateSelfProfile`, `updateMemberForAdmin` hazır; `create`, `approve`, `reject`, `resetPassword` sonraki dilimde.
- [~] Ortak doğrulama: ad/soyad/track/handle/e-posta/şifre/custom. _(Self ve admin düzenleme ortak alan doğrulamasını kullanıyor; kayıt/admin oluşturma hâlâ ayrı.)_
- [x] Admin üye düzenleme API'si: `PATCH /api/members/:id`.
- [~] Members app'te düzenleme sheet'i: Profil ve Ek Alanlar hazır; Erişim/Güvenlik/Onaylar/Aktivite sonraki dilimde.
- [x] Self-servis custom alan düzenleme (politika kadar).
- [x] `form_fields` politika kolonları: `collect_at`, `required_at`, `directory_visibility`, `self_editable`, `admin_editable`, `archived_at`.
- [x] Roster'da scope sızıntısını kapat; admin detayında tam görünüm.
- [x] Alan silme yerine arşivle; değerler korunur.
- [x] Profil/avatar/custom audit + admin şifre sıfırlama e-postası audit'i hazır.
- [~] Kullanıcı + custom değerler self/admin düzenlemede tek transaction; kayıt/admin oluşturma hâlâ ayrı.
- [x] E-posta değişimi: yeni adrese OTP + doğrulama + audit (`uye.email`).
- [x] Faz 1 pure testleri: alan politikası ve `validateAdminEditValues`.
- [~] Admin düzenleme ve e-posta değişimi canlı doğrulandı; otomatik API testi sonraki dilimde.

**Kabul:** Admin her üye alanını düzenleyebilir; self yalnız izinli alanları; custom alan scope'u sızdırmaz; tüm yazmalar audit'li ve atomik.

### Faz 2 — Başvuru yaşam döngüsü, kayıt politikası, güvenli rıza

- [~] `membership_applications` tablosu ve durum makinesi. _(pending_review / approved / rejected çalışıyor; submitted / email_verified / withdrawn geçişleri sonraki dilimde.)_
- [~] `application_answers` snapshot; onayda `member_field_values`'a materialize. _(Snapshot yazılıyor; değerler kayıt sırasında zaten üye kaydına yazıldığı için ayrıca materialize edilmiyor.)_
- [x] Settings → **Üyelik Politikası** sayfası:
  - self/admin/invite açık/kapalı
  - manuel onay
  - e-posta doğrulama zorunluluğu
  - davet süresi/kullanım sayısı
  - yeniden başvuru bekleme süresi
- [~] Invite token altyapısı: e-posta, rol, takım, süre. _(E-posta/rol/süre çalışıyor; takım ataması ve takım seçici sonraki dilimde.)_
- [x] Red gerekçesi + yeniden başvuru. _(Yeniden başvuru + cooldown + `reapply_of` çalışıyor; red gerekçesini admin UI'ından toplama sonraki dilimde.)_
- [x] Rıza sürümleme: belge güncellenince yeni sürüm, yeniden onay.
- [x] Mevcut üyeler için rıza tamamlama akışı: `/api/legal/status`, `/api/legal/accept`, Hesabım kartı.
- [x] `decisions`/denetim ile başvuru karar kaydı. _(Başvuru satırı reviewed_by/at + mevcut audit.)_

**Kabul:** Başvuru → doğrulama → onay/red → yeniden başvuru çalışır; her rıza belge sürümüyle kanıtlanır.

### Faz 3 — Komite/takım, form/legal editörü, tüm app entegrasyonu

- [x] `teams.type` (`working_group`/`committee`), komite üyeliği + oy hakkı.
- [x] `committee_meetings`; `decisions.body_id`, karar türü ve oy sayıları.
- [x] Yönetişim uygulamasında komite görünümü; toplantı ve kararlarla bağlantı.
- [x] Form tasarımcısında politika UI'ı + gerçek form önizlemesi.
- [x] Legal editörde sürüm geçmişi; her içerik değişikliği önceki metni `legal_document_versions`'a arşivler.
- [x] Projects/Events owner modeli: `owner_team_id`, `owner_user_id`, `created_by`; migration eski `teamId`/`olusturanId` değerlerini geriye dönük doldurur.
- [x] Mail: alıcı grupları (rol/takım/komite) tek kaynaktan; compose ekranında grup seçici.
- [x] SoC Studio → Change History; `/api/audit` filtre/CSV/paylaşım akışı SoC yönetiminde. Settings audit sekmesi kaldırıldı.
- [x] Veri dışa aktarma (JSON/CSV) + üye anonimleştirme; Settings → Veri ve Gizlilik.
- [x] Tüm mini-app'ler aynı `users` / `teams` / `team_members` / `roles` kaynağını kullanır; komite üye seçici ve mail alıcı grupları ortak servisten beslenir. UI seçici standardizasyonu follow-up.

**Kabul:** Komite kararı ile takım görevi ayrışır; tüm uygulamalar aynı kişi/takım/rol kaynağını kullanır.

**Faz 3 kapanış durumu:**
- Komite/takım ayrımı, oy hakkı, toplantı ve karar bağlantısı çalışıyor.
- Form önizlemesi, legal sürüm arşivi, proje/etkinlik sahipliği, audit merkezi, mail alıcı grupları ve veri/gizlilik paneli tamamlandı.
- Kalan follow-up: bazı mini-app formlarındaki seçici UI'larının ortak bileşene taşınması; veri kaynağı zaten ortak.

### Faz 4 — Çok topluluk hazırlığı (opsiyonel, yalnız ihtiyaç doğarsa)

- [ ] `organizations`, `memberships`, `membership_id` foreign key'leri.
- [ ] Track/seviye/rol alanlarını membership'e taşı.
- [ ] Tenant-scoped sorgular ve yetki kontrolleri.
- [ ] Veri göçü ve geri dönüş planı.

> Bu faz, ürün kararı değişmedikçe **uygulanmaz**. Tek toplulukta gereksiz karmaşıklık yaratır.

---

## 7. Veritabanı geçiş stratejisi

1. **Yeni migration adı:** `2026_17_member_data_foundation` ve devamı.
2. **Geri uyumluluk:** yeni kolonlar nullable/default; mevcut sorgular bozulmaz.
3. **Backfill:** mevcut belgeler için `version=1`, `content_hash`; mevcut üyelikler için uygulama yok (geçmiş başvuru uydurulmaz).
4. **Rıza:** eski hesaplar için geçmiş rıza uydurulmaz; ilk girişte yeniden onay istenir.
5. **Form alanları:** mevcut scope değerlerinden güvenli varsayılanlarla politika kolonları doldurulur; veri silinmez.
6. **Roller:** tek birincil rol korunur; çoklu rol ihtiyacı doğarsa ayrı migration.
7. **Test:** her migration idempotent; `ensurePostgresInit` tekrar çalışabilir.
8. **Rollback:** yeni tablolar/kolonlar geri alınabilir; veri silen migration yazılmaz.

---

## 8. Doğrulama ve kabul kapıları

- `pnpm typecheck`
- `pnpm lint`
- `pnpm check` (pure, i18n, token)
- `pnpm build`
- Yeni pure testler: rıza zorunluluğu, track doğrulama, rol sözleşmesi, form politikası.
- E2E: kayıt → onay → self edit → admin edit → custom alan → rıza.
- Yetki testleri: self/admin/settings/members ayrımı.
- Migration testi: boş DB + mevcut DB.

---

## 9. Açık kararlar

1. **Çoklu global rol:** Şimdilik tek birincil rol. Komite/team rolleri kapsamlı. İhtiyaç doğarsa `role_assignments` + öncelik kuralı.
2. **Komite modeli:** Faz 3'te `teams.type` + `committee_*` ile başla; grup türü artarsa `groups` refactor.
3. **E-posta değişimi:** Self-servis, yeni adres doğrulamalı. Admin e-posta değişimi audit'li ve step-up'lı.
4. **Rıza saklama süresi:** Üyelik + yasal zorunluluk süresi; audit 730 gün.
5. **Silme/anonimleştirme:** Hard delete yerine anonimleştirme; yasal istisnalar audit'te.

---

## 10. Faz 0 dosya etkisi

| Dosya | Değişiklik |
|---|---|
| `src/apps/settings/components/Account/AccountProfileHero.tsx` | doğru foto endpoint |
| `src/apps/settings/components/Account/AccountPasswordForm.tsx` | doğru şifre endpoint |
| `src/app/api/roles/route.ts` | `assignableRoles` sözleşmesi |
| `src/apps/members/hooks/useMembers.ts` | rol tipi/contract uyumu |
| `src/apps/members/components/MembersMobileView.tsx` | reddet = status |
| `src/server/db/schema.init.ts` | legal sürüm + acceptance migration |
| `src/server/db/domains/customization.repo.ts` | legal sürüm/kabul yazımı |
| `src/app/api/auth/register/route.ts` | zorunlu rıza + kayıt |
| `src/apps/settings/components/Panels/LegalSettingsPanel.tsx` | ezme engeli |
| `src/apps/settings/components/Account/AccountPanel.tsx` | track config kaynağı |
| `src/app/api/profile/route.ts` | track config doğrulaması |
| `src/apps/members/components/MembersToolbar.tsx` | track config kaynağı |
| `src/apps/members/hooks/useMembers.ts` | config track options |
| `src/app/api/members/route.ts` | track config doğrulaması |
| `scripts/check-pure.mjs` | yeni pure testler |

---

## 11. Not

Bu doküman canlıdır. Her faz tamamlandıkça işaretlenir; karar değişiklikleri burada ve `DATA_DICTIONARY.md` içinde güncellenir.
