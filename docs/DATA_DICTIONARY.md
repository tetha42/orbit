# Orbit Veri Sözlüğü

> Bu doküman [`DATA_MODEL_ROADMAP.md`](./DATA_MODEL_ROADMAP.md) kararlarının alan düzeyi karşılığıdır.
> Amaç: her veri parçasının **sahibini, tipini, zorunluluğunu, görünürlüğünü, kim tarafından düzenlendiğini ve ne kadar yaşadığını** tek yerde tanımlamak.

---

## 1. Veri sınıfları

| Sınıf | Örnek | Kural |
|---|---|---|
| **Public** | Görünen ad, avatar, takım adı, proje başlığı | Herkes görebilir |
| **Community** | E-posta, track, bio, takım üyeliği | Topluluk üyeleri görebilir |
| **Manager** | Üyelik durumu, rol, başvuru notu, red gerekçesi | `members: yonet` / `settings: yonet` |
| **Self** | Telefon, doğum tarihi, adres, acil iletişim | Yalnız kişi + yetkili yönetici |
| **Secret** | Şifre hash, TOTP secret, recovery kodları, oturum token'ı | Hiçbir API'de dönmez |
| **Evidence** | Rıza kaydı, audit, başvuru kararı | Değiştirilemez; yalnız ekleme/okuma |
| **Derived** | XP, katılım sayısı, proje sayısı | Hesaplanır; elle yazılmaz |

---

## 2. Kişi (Person)

Tek toplulukta `users` tablosu kişi + hesap + üyelik alanlarını taşır. Kodda `Person`, `Account`, `Membership` tipleri ayrılır.

### 2.1 Kimlik

| Alan | Tip | Zorunlu | Görünürlük | Düzenleyen | Not |
|---|---|---|---|---|---|
| `id` | TEXT (PK) | Evet | Sistem | — | `usr_...` |
| `first_name` | TEXT | Evet | Community | Self? / Members | 2–60; `<>,` ve kontrol karakteri yasak |
| `last_name` | TEXT | Evet | Community | Self? / Members | 2–60 |
| `preferred_name` | TEXT | Hayır | Community | Self / Members | Görünen ad; yoksa ad soyad |
| `handle` | TEXT (UNIQUE) | Config’e göre | Community | Members | 3–32; `[A-Za-z0-9_-]`; değişim audit'li |
| `avatar_url` | TEXT | Hayır | Community | Self / Members | 2 MB, sniff edilmiş, 320 px |
| `email` | TEXT (UNIQUE) | Evet | Manager / self | Self (doğrulamalı) / Members | Değişimde yeni adres doğrulanır |
| `email_verified_at` | BIGINT | Evet (aktif üyelik) | Manager | Sistem | Kayıt OTP'si |
| `locale` | TEXT | Hayır | Self | Self | `tr` / `en` |
| `timezone` | TEXT | Hayır | Self | Self | IANA |
| `status` | TEXT | Evet | Manager | Sistem / Members | Aşağıdaki statüler |
| `created_at` | BIGINT | Evet | Manager | Sistem | |
| `updated_at` | BIGINT | Evet | Manager | Sistem | |

### 2.2 Topluluk profili

| Alan | Tip | Zorunlu | Görünürlük | Düzenleyen | Not |
|---|---|---|---|---|---|
| `bio` | TEXT | Hayır | Community | Self / Members | 280 karakter |
| `department` (track) | TEXT | Evet | Community | Self? / Members | **Tek kaynak:** `registration_core_fields.track.options` |
| `grade` (level) | INTEGER | Evet | Community | Self? / Members | Config’teki seçeneklerden |
| `skills` | TEXT[] / JSON | Hayır | Community | Self / Members | Etiketler |
| `links` | JSONB | Hayır | Community | Self / Members | GitHub, web, LinkedIn |
| `joined_at` | BIGINT | Evet | Community | Sistem | İlk aktif üyelik |
| `directory_visibility` | TEXT | Evet | Manager | Self | `public` / `members` / `hidden` |

### 2.3 Hesap ve güvenlik

| Alan | Tip | Zorunlu | Görünürlük | Düzenleyen | Not |
|---|---|---|---|---|---|
| `password_hash` | TEXT | Evet | **Secret** | Self / sistem | Bcrypt cost 12 |
| `password_changed_at` | BIGINT | Hayır | Manager | Sistem | |
| `must_change_password` | INTEGER | Evet | Manager | Admin reset | Geçici şifre |
| `totp_secret` | TEXT | Hayır | **Secret** | Self | AES-256-GCM |
| `totp_enabled` | INTEGER | Evet | Manager | Self | |
| `totp_recovery_codes` | TEXT | Hayır | **Secret** | Self | 8 adet, hash'li |
| `auth_method` | TEXT | Evet | Manager | Sistem | `password` / `totp` / `passkey` |
| `session_token` | TEXT | Hayır | **Secret** | Sistem | SHA-256 hash |
| `session_expires_at` | BIGINT | Hayır | Manager | Sistem | |
| `last_login_at/ip/user_agent` | BIGINT/TEXT | Hayır | Manager | Sistem | Telemetri |
| `last_active_ip/at` | TEXT/BIGINT | Hayır | Manager | Sistem | |
| `mail_notifications_enabled` | INTEGER | Evet | Self | Self | |

### 2.3.1 E-posta değişim isteği

| Alan | Tip | Not |
|---|---|---|
| `id` | TEXT | |
| `user_id` | TEXT | |
| `new_email` | TEXT | Henüz hesaba yazılmaz |
| `code_hash` | TEXT | SHA-256 OTP; ham kod saklanmaz |
| `attempts` | INTEGER | En fazla 5 |
| `expires_at` | BIGINT | 15 dakika |
| `requested_ip`, `user_agent` | TEXT | Adli telemetri |
| `used_at` | BIGINT | Başarılı değişimde işaretlenir |

**Kural:** Bir üyenin aynı anda yalnızca bir açık e-posta değişim isteği olabilir. Yeni istek öncekini geçersiz kılar. E-posta ancak kod doğrulandıktan sonra `users.email` alanına yazılır ve `email_verified_at` güncellenir.

### 2.4 Üyelik

| Alan | Tip | Zorunlu | Görünürlük | Düzenleyen | Not |
|---|---|---|---|---|---|
| `member_no` / `handle` | TEXT | Config’e göre | Community | Members | Üye kimliği |
| `membership_status` | TEXT | Evet | Manager | Members | `beklemede` / `aktif` / `reddedildi` / `mezun` / `askida` |
| `role_id` | TEXT | Evet (aktif) | Manager | Members | Tek birincil global rol |
| `team_memberships` | İlişki | Hayır | Community | Teams | 0..n |
| `committee_memberships` | İlişki | Hayır | Manager | Teams/Governance | 0..n |
| `approved_by` | TEXT | Hayır | Manager | Sistem | |
| `approved_at` | BIGINT | Hayır | Manager | Sistem | |
| `joined_at` | BIGINT | Hayır | Community | Sistem | |

> **Not:** Hesap durumu ile üyelik durumu ayrıdır. Tek toplulukta tek `status` alanı kullanılsa bile anlamı “üyelik durumu” olarak tanımlanır; hesap erişimi ayrıca değerlendirilir.

### 2.5 Rıza

| Alan | Tip | Zorunlu | Görünürlük | Düzenleyen | Not |
|---|---|---|---|---|---|
| `document_id` | TEXT | Evet | Manager | — | |
| `document_version` | INTEGER | Evet | Manager | — | |
| `content_hash` | TEXT | Evet | Manager | — | Kanıt |
| `accepted_at` | BIGINT | Evet | Manager | Sistem | |
| `ip` | TEXT | Hayır | Manager | Sistem | |
| `user_agent` | TEXT | Hayır | Manager | Sistem | |
| `source` | TEXT | Evet | Manager | Sistem | `registration` / `account` / `reconsent` |

### 2.6 Özel alanlar

| Alan | Tip | Zorunlu | Görünürlük | Düzenleyen | Not |
|---|---|---|---|---|---|
| `field_key` | TEXT | Evet | Public (definition) | Settings | Auth alanlarıyla çakışamaz |
| `label_tr/en` | TEXT | Evet | Public (definition) | Settings | |
| `type` | TEXT | Evet | Public (definition) | Settings | `text/email/tel/number/date/textarea/select` |
| `collect_at` | TEXT | Evet | Manager | Settings | `registration` / `admin` / `both` |
| `required_at` | TEXT | Evet | Manager | Settings | `registration` / `activation` / `none` |
| `directory_visibility` | TEXT | Evet | Manager | Settings | `hidden` / `members` / `managers` |
| `self_editable` | INTEGER | Evet | Manager | Settings | |
| `admin_editable` | INTEGER | Evet | Manager | Settings | |
| `sensitive` | INTEGER | Evet | Manager | Settings | Maskelenir |
| `value` | TEXT | — | Politikaya göre | Self / Members | Alan başına 1 değer |

**Yasak:** `password` tipi özel alan; auth alanlarının (e-posta, handle, ad) custom field olarak tanımlanması.

### 2.7 Masaüstü ve Çalışma Alanı Tercihleri (`user_workspace_preferences`)

Cihazlar ve tarayıcılar arası masaüstü deneyiminin (roaming) kesintisiz aktarılmasını sağlayan tekil kullanıcı tercih tablosu:

| Alan | Tip | Zorunlu | Görünürlük | Düzenleyen | Not |
|---|---|---|---|---|---|
| `user_id` | TEXT (PK, FK) | Evet | Self / Sistem | — | `users.id` referansı (ON DELETE CASCADE) |
| `state` | JSONB | Evet | Self | Self / Sistem | `activeWallpaper`, `windows`, `dockApps`, `brightness`, `volume`, `isMuted`, `isDockAutoHide` |
| `updated_at` | BIGINT | Evet | Self / Sistem | Sistem | Milisaniye epoch zaman damgası (roaming eşzamanlama) |

---

## 3. Başvuru (Application)

| Alan | Tip | Zorunlu | Görünürlük | Düzenleyen | Not |
|---|---|---|---|---|---|
| `id` | TEXT (PK) | Evet | Manager | — | |
| `user_id` | TEXT | Evet | Manager | — | Başvuru sahibi |
| `source` | TEXT | Evet | Manager | Sistem | `self` / `admin` / `invite` |
| `status` | TEXT | Evet | Manager / self | Sistem | `submitted` / `email_verified` / `pending_review` / `approved` / `rejected` / `withdrawn` |
| `form_snapshot` | JSONB | Evet | Manager | Sistem | Başvuru anındaki cevaplar; değişmez |
| `consent_ids` | TEXT[] | Evet | Manager | Sistem | Kabul edilen belge sürümleri |
| `email_verified_at` | BIGINT | Hayır | Manager | Sistem | |
| `submitted_at` | BIGINT | Evet | Manager | Sistem | |
| `reviewed_by` | TEXT | Hayır | Manager | Sistem | |
| `reviewed_at` | BIGINT | Hayır | Manager | Sistem | |
| `rejection_reason` | TEXT | Hayır | Manager | Members | Red gerekçesi |
| `reapply_of` | TEXT | Hayır | Manager | Sistem | Önceki başvuru |
| `cooldown_until` | BIGINT | Hayır | Manager | Sistem | Yeniden başvuru |

**Kural:** Başvuru snapshot'ı sonradan değiştirilmez. Onayda güncel değerler `users` + `member_field_values`'a materialize edilir; başvuru kanıt olarak kalır.

### 3.1 Davet (Invitation)

| Alan | Tip | Not |
|---|---|---|
| `id` | TEXT (PK) | |
| `token_hash` | TEXT (UNIQUE) | Ham token yalnız oluşturulduğu anda gösterilir |
| `email` | TEXT | Null = herkes kullanabilir; doluysa kayıt e-postası eşleşmeli |
| `role_id` | TEXT | Kayıt sırasında üyeye atanır |
| `team_id` | TEXT | Gelecek: takım üyeliği |
| `note` | TEXT | Yönetici notu |
| `created_by` | TEXT | |
| `expires_at` | BIGINT | Varsayılan 7 gün |
| `used_at` / `used_by` | BIGINT / TEXT | Tek kullanımlık |
| `created_at` | BIGINT | |

**Kural:** Aynı davet ikinci kez kullanılamaz. Davet, manuel onayı atlamaz; yalnız başvuruyu ve rolü önceden hazırlar.

---

## 4. Rol ve yetki

### 4.1 Rol

| Alan | Tip | Zorunlu | Görünürlük | Düzenleyen | Not |
|---|---|---|---|---|---|
| `id` | TEXT (PK) | Evet | Manager | — | |
| `ad` | TEXT (UNIQUE ci) | Evet | Manager | Settings | |
| `slug` | TEXT | Evet | Manager | Settings | |
| `renk` | TEXT | Evet | Manager | Settings | |
| `aciklama` | TEXT | Hayır | Manager | Settings | |
| `sistem` | INTEGER | Evet | Manager | Sistem | Admin/Member/Alumni |
| `atanabilir` | INTEGER | Evet | Manager | Settings | |
| `varsayilan` | INTEGER | Evet | Manager | Settings | Tek default |
| `ikiAdimZorunlu` | INTEGER | Evet | Manager | Settings | |
| `rank` | INTEGER | Evet | Manager | Settings | Yetki yükseltme kontrolü |

### 4.2 İzin

| Alan | Tip | Zorunlu | Not |
|---|---|---|---|
| `roleId` | TEXT | Evet | |
| `appId` | TEXT | Evet | 15+ app |
| `seviye` | TEXT | Evet | `yok` / `kullan` / `yonet` |

### 4.3 Atama

Tek topluluk + tek birincil rol kararı gereği `users.role_id` yeterlidir. Çoklu global rol gerekirse:

| Alan | Tip | Not |
|---|---|---|
| `user_id` | TEXT | |
| `role_id` | TEXT | |
| `scope` | TEXT | `community` / `team` / `committee` |
| `scope_id` | TEXT | Takım/komite |
| `starts_at/ends_at` | BIGINT | Görev süresi |
| `assigned_by` | TEXT | |
| `reason` | TEXT | Audit |

**Kural:** Aynı kişide birden fazla global rol olursa izin birleşimi ve öncelik kuralı açıkça tanımlanır; sessiz birleşim yasak.

---

## 5. Takım (Team)

| Alan | Tip | Zorunlu | Görünürlük | Düzenleyen | Not |
|---|---|---|---|---|---|
| `id` | TEXT (PK) | Evet | Public | — | |
| `type` | TEXT | Evet | Public | Settings/Teams | `working_group` / `committee` |
| `ad` | TEXT | Evet | Public | Teams | |
| `slug` | TEXT (UNIQUE) | Evet | Public | Teams | |
| `kategori` | TEXT | Evet | Public | Teams | `team_categories` FK |
| `aciklama` | TEXT | Evet | Public | Teams | |
| `logo/renk` | TEXT | Hayır | Public | Teams | |
| `liderId` | TEXT | Evet | Public | Teams | Tek kaynak; üyelikle tutarlı |
| `kontenjan` | INTEGER | Evet | Public | Teams | |
| `katilimTuru` | TEXT | Evet | Public | Teams | `acik` / `onayli` / `davet` |
| `status` | TEXT | Evet | Public | Teams | `aktif` / `arsiv` |
| `repoUrl` | TEXT | Hayır | Public | Teams | |
| `created_at` | BIGINT | Evet | Public | Sistem | |

### 5.1 Takım üyeliği

| Alan | Tip | Zorunlu | Görünürlük | Düzenleyen | Not |
|---|---|---|---|---|---|
| `team_id` | TEXT | Evet | Community | Teams | |
| `user_id` | TEXT | Evet | Community | Teams | |
| `team_role_id` | TEXT | Evet | Community | Teams | Kaptan/geliştirici/tasarımcı |
| `status` | TEXT | Evet | Community | Teams | `basvurdu` / `aktif` / `ayrildi` / `reddedildi` |
| `applied_at/joined_at/left_at` | BIGINT | Hayır | Manager | Teams | |
| `approved_by` | TEXT | Hayır | Manager | Sistem | |
| `note` | TEXT | Hayır | Manager | Teams | |

**Kural:** `teams.liderId` ile `team_members.team_role = lead` çelişemez. Tek kaynak seçilir; diğeri türetilir veya transaction içinde senkronlanır.

### 5.2 Takım kategorisi

| Alan | Tip | Zorunlu | Görünürlük | Düzenleyen |
|---|---|---|---|---|
| `id` | TEXT | Evet | Public | Settings |
| `ad` | TEXT | Evet | Public | Settings |
| `slug` | TEXT | Evet | Public | Settings |
| `sira` | INTEGER | Evet | Public | Settings |
| `aktif` | INTEGER | Evet | Public | Settings |

---

## 6. Komite (Committee)

Komite, takımın özel bir türü olarak başlar; karar mercii olduğu için ek alanlar taşır.

| Alan | Tip | Zorunlu | Görünürlük | Düzenleyen | Not |
|---|---|---|---|---|---|
| `team_id` | TEXT | Evet | Manager | — | `teams.type = committee` |
| `kategori` | TEXT | Evet | Manager | Governance app | Şimdilik `Governance` |
| `quorum` | INTEGER | Hayır | Manager | Governance app | |
| `term_start/term_end` | BIGINT | Hayır | Manager | Governance app | Üyelik satırında tutulur |

### 6.1 Komite üyeliği

| Alan | Tip | Not |
|---|---|---|
| `committee_id` | TEXT | |
| `user_id` | TEXT | |
| `committee_role` | TEXT | başkan / üye / raportör |
| `voting_right` | INTEGER | 0/1 |
| `term_start/term_end` | BIGINT | |
| `status` | TEXT | `aktif` / `ayrildi` |

### 6.2 Toplantı

| Alan | Tip | Not |
|---|---|---|
| `id` | TEXT | |
| `committee_id` | TEXT | |
| `date` | BIGINT | |
| `agenda` | TEXT | |
| `minutes` | TEXT | |
| `status` | TEXT | `planned` / `held` / `cancelled` |
| `created_by` | TEXT | |

### 6.3 Karar

Mevcut `decisions` tablosuna eklenecek:

| Alan | Tip | Not |
|---|---|---|
| `body_id` | TEXT | `teams.id` (komite) |
| `decision_type` | TEXT | `resolution` / `motion` / `minutes` / `appointment` / `budget` |
| `quorum_met` | INTEGER | |
| `votes_for/against/abstain` | INTEGER | |
| `published_at` | BIGINT | |

---

## 7. Proje ve etkinlik

### 7.1 Proje

| Alan | Tip | Not |
|---|---|---|
| `owner_team_id` | TEXT | Takım sahibi |
| `owner_user_id` | TEXT | Kişi sahibi |
| `created_by` | TEXT | Oluşturan; sahipten farklı olabilir |
| `contributors` | İlişki | `project_contributors` |
| `status` | TEXT | `oneri` / `yayinda` / `arsiv` |
| `tech_tags` | JSON | |

**Kural:** “Oluşturan” ≠ “sahip”. İkisi ayrı alan.

### 7.2 Etkinlik

| Alan | Tip | Not |
|---|---|---|
| `owner_user_id` | TEXT | Sorumlu kişi |
| `owner_team_id` | TEXT | Sorumlu takım/komite |
| `created_by` | TEXT | Oluşturan; sahipten farklı olabilir |
| `status` | TEXT | `yayinda` / `iptal` / `arsiv` |
| `capacity` | INTEGER | |
| `attendances` | İlişki | |

---

## 8. Rıza ve belge sürümü

### 8.1 Belge

| Alan | Tip | Not |
|---|---|---|
| `id` | TEXT | |
| `doc_type` | TEXT (UNIQUE) | terms/privacy/cookies/kvkk/guidelines/custom |
| `scope` | TEXT | `registration` / `members` / `all` |
| `title_tr/en`, `body_tr/en` | TEXT | Güncel sürüm |
| `required` | INTEGER | |
| `enabled` | INTEGER | |
| `version` | INTEGER | Her içerik değişiminde +1 |
| `updated_at` / `updated_by` | BIGINT / TEXT | Son düzenleme |
| `enabled` | INTEGER | 0 = yayında değil |

### 8.2 Kabul

| Alan | Tip | Not |
|---|---|---|
| `user_id` | TEXT | |
| `document_id` | TEXT | |
| `document_version` | INTEGER | |
| `content_hash` | TEXT | |
| `accepted_at` | BIGINT | |
| `ip`, `user_agent` | TEXT | |
| `source` | TEXT | registration/account/reconsent |

**Kural:** Admin başkası adına rıza veremez. Rıza kaydı silinmez; yeni sürüm gelince yeni kayıt eklenir.

### 8.3 Sürüm arşivi

| Alan | Tip | Not |
|---|---|---|
| `id` | TEXT | |
| `document_id` | TEXT | `legal_documents.id` |
| `doc_type` | TEXT | |
| `version` | INTEGER | Arşivlenen sürüm |
| `scope`, `title_tr/en`, `body_tr/en` | TEXT | Değişmez metin |
| `required` | INTEGER | |
| `content_hash` | TEXT | O sürümün kanıt hash’i |
| `archived_at` / `archived_by` | BIGINT / TEXT | |

İçerik değiştiğinde eski metin `legal_document_versions`'a yazılır; kabul kayıtları bu sürüme ve hash’e bağlı kalır.

---

## 9. Kayıt politikası (Settings)

`system_settings` içinde `membership_policy` JSON:

| Alan | Tip | Varsayılan | Açıklama |
|---|---|---|---|
| `selfRegistration` | `open` / `closed` | `open` | Self başvuru |
| `adminCreate` | boolean | `true` | Admin üye oluşturma |
| `inviteEnabled` | boolean | `true` | Davet |
| `emailVerification` | boolean | `true` | OTP |
| `reapplyCooldownDays` | INTEGER | 30 | Red sonrası |
| `inviteExpiryDays` | INTEGER | 7 | Davet |
| `allowedEmailDomains` | TEXT[] | boş | Boş = tüm domainler |
| `maxOpenApplications` | INTEGER | 1 | Kişi başı |

**Kontrol:** Settings → Üyelik Politikası. Kayıt API'si bu politikayı okur; istemci yalnız gösterir. Onay her zaman manueldir; varsayılan rol Roller ekranından yönetilir.

## 9.1 Posta alıcı grupları

Tek servis (`getMailRecipientGroups`) şu grupları üretir:

| Grup | Kaynak | Kural |
|---|---|---|
| Tüm üyeler | `users` | `status = aktif`, e-posta dolu |
| Rol | `users.role_id` → `roles` | Aktif üyeler |
| Takım | `teams.type = working_group` + `team_members` | Aktif takım/üye |
| Komite | `teams.type = committee` + `team_members` | Aktif komite/üye |

Yalnız e-posta adresleri döner; SMTP katmanına profil verisi taşınmaz. Compose ekranı seçilen grubun adreslerini `To` alanına ekler.

### 9.2 Veri dışa aktarma ve anonimleştirme

- JSON paketi: kullanıcı, takım, üyelik, proje, etkinlik, karar, toplantı, başvuru ve rıza kabul kayıtları.
- CSV: tablo bazlı.
- Parola, oturum token’ı, TOTP secret, IP ve user-agent dışa aktarılmaz.
- Anonimleştirme: ad/e-posta/handle/biyografi/avatar/TOTP/oturum temizlenir; ID ve ilişkiler korunur; rıza kanıtı kalır, IP/UA temizlenir.
- Admin hesapları ve işlemi yapan kendi hesabı korunur.

---

## 10. Görünürlük ve düzenleme matrisi

| Alan grubu | Self | Team lead | Members manager | Settings manager | Admin |
|---|---|---|---|---|---|
| Ad/soyad | Oku | Oku | Düzenle | — | Düzenle |
| E-posta | Düzenle (doğrulamalı) | — | Düzenle | — | Düzenle |
| Handle | Oku | — | Düzenle | — | Düzenle |
| Avatar | Düzenle | — | Düzenle | — | Düzenle |
| Bio | Düzenle | Oku | Düzenle | — | Düzenle |
| Track/seviye | Düzenle* | Oku | Düzenle | Tanımla | Düzenle |
| Rol | Oku | — | Ata** | Tanımla | Ata |
| Üyelik statüsü | Oku | — | Düzenle | — | Düzenle |
| Takım üyeliği | Başvur | Düzenle | Düzenle | — | Düzenle |
| Komite üyeliği | Oku | — | — | Düzenle | Düzenle |
| Custom alan | Politikaya göre | Politikaya göre | Politikaya göre | Tanımla | Düzenle |
| Rıza | Ver | — | Oku | Tanımla | Oku |
| Audit | — | — | Oku | Oku | Oku |

\* Settings → Forms'ta `selfEditable` açıksa.  
\** Kendi yetkisinin üstünde rol atayamaz; son admin korunur.

---

## 11. Kardinalite

| İlişki | Kural |
|---|---|
| Kişi → Hesap | 1 |
| Kişi → Aktif üyelik | 1 |
| Kişi → Birincil global rol | 1 |
| Kişi → Takım üyeliği | 0..n |
| Kişi → Komite üyeliği | 0..n |
| Kişi → Passkey | 0..5 |
| Kişi → TOTP | 1 |
| TOTP → Recovery | 8 |
| Kişi → Rıza | Belge/sürüm başına 1 |
| Kişi → Özel alan değeri | Alan başına 1 |
| Kişi → Başvuru | 0..n (1 açık) |
| Takım → Kategori | 1 |
| Takım → Lider | 1 |
| Takım → Üye | 1..n |
| Takım → Proje | 0..n |
| Rol → İzin | App başına 1 |
| Topluluk → Varsayılan rol | 1 |
| Form → Alan | ≤ 30 (öneri) |
| Alan → Seçenek | ≤ 30 (öneri) |
| Belge → Sürüm | n |

---

## 12. Saklama ve silme

| Veri | Saklama | Silme |
|---|---|---|
| Hesap/üyelik | Üyelik + yasal süre | Anonimleştirme |
| Başvuru | Red + 12 ay (yapılandırılabilir) | Anonimleştirme |
| Rıza | Üyelik + yasal süre | Silinmez |
| Audit | 730 gün | Otomatik temizlik |
| Form değerleri | Üyelik süresi | Üyelik silinince cascade/anonim |
| Takım/komite | Arşiv | Soft archive |
| Proje/etkinlik | Arşiv | Soft archive |

---

## 13. Uygulama notları

- Core alanlar gerçek kolon; topluluğa özel alanlar `form_fields` + `member_field_values`.
- `password` tipi custom field kaldırılır; hassas veri gerekiyorsa ayrı `secret` politikası.
- `scope` yerine `collect_at` / `required_at` / `directory_visibility` / `self_editable` / `admin_editable`.
- Alan silme yerine `archived_at`; değerler korunur.
- Tüm yazmalar `withTransaction` + audit.
- İstemci ve sunucu aynı doğrulama modülünü kullanır.
- Her API yalnız kendi domaininin sahibi; çapraz yazma yok.

---

## 14. İndeksleme ve İlişkisel Performans Kapsamı (Index Coverage)

Migration `2026_31_index_unindexed_foreign_keys` ve `2026_32_index_fk_completeness` ile Orbit PostgreSQL veritabanındaki tüm yabancı anahtarlar (foreign keys) ve kritik ilişkisel filtre kolonları için indeks kapsamı %100'e çıkarılmıştır. Koşullu/kısmi indekslerin (`WHERE` clause) foreign key `ON DELETE CASCADE` ve `JOIN` işlemlerinde sequential scan engellemediği doğrulanmış; lifecycle tablolarındaki (`email_change_requests`, `membership_applications`) kısmi indekslere ek olarak tam B-Tree indeksler oluşturulmuştur. Bu sayede `ON DELETE CASCADE`, `ON DELETE SET NULL` ve `JOIN` işlemlerinde sequential scan (ardışık tablo taraması) ve kilitlenme (lock contention) riskleri tamamen ortadan kaldırılmıştır.

| Tablo | Kolon | Referans Tablosu | İndeks Adı |
|---|---|---|---|
| `attendances` | `kaydedenid`, `userid` | `users` | `idx_attendances_kaydedenid`, `idx_attendances_userid` |
| `budget_records` | `guncelleyenid`, `kaydedenid` | `users` | `idx_budget_records_guncelleyenid`, `idx_budget_records_kaydedenid` |
| `certificates` | `etkinlikid`, `userid` | `events`, `users` | `idx_certificates_etkinlikid`, `idx_certificates_userid` |
| `chat_members` | `userid` | `users` | `idx_chat_members_userid` |
| `chat_messages` | `gonderenid` | `users` | `idx_chat_messages_gonderenid` |
| `chat_poll_votes` | `secenekid` | `chat_poll_options` | `idx_chat_poll_votes_secenekid` |
| `chat_polls` | `olusturanid` | `users` | `idx_chat_polls_olusturanid` |
| `committee_meetings` | `created_by` | `users` | `idx_committee_meetings_created_by` |
| `decisions` | `olusturanid` | `users` | `idx_decisions_olusturanid` |
| `email_change_requests` | `user_id` | `users` | `idx_email_change_requests_user_id` |
| `event_registrations` | `userid` | `users` | `idx_event_registrations_userid` |
| `events` | `created_by`, `olusturanid` | `users` | `idx_events_created_by`, `idx_events_olusturanid` |
| `files` | `yukleyenid` | `users` | `idx_files_yukleyenid` |
| `inventory` | `oduncalanid` | `users` | `idx_inventory_oduncalanid` |
| `inventory_activities` | `aktorid`, `userid` | `users` | `idx_inventory_activities_aktorid`, `idx_inventory_activities_userid` |
| `invitations` | `created_by`, `used_by` | `users` | `idx_invitations_created_by`, `idx_invitations_used_by` |
| `legal_document_versions` | `archived_by` | `users` | `idx_legal_document_versions_archived_by` |
| `mail_messages` | `gonderenid` | `users` | `idx_mail_messages_gonderenid` |
| `mail_outbox` | `approved_by`, `requested_by`, `target_user_id` | `users` | `idx_mail_outbox_approved_by`, `idx_mail_outbox_requested_by`, `idx_mail_outbox_target_user_id` |
| `mail_threads` | `olusturanid` | `users` | `idx_mail_threads_olusturanid` |
| `member_field_values` | `field_id` | `form_fields` | `idx_member_field_values_field_id` |
| `membership_applications` | `reapply_of`, `user_id` | `membership_applications`, `users` | `idx_membership_applications_reapply_of`, `idx_membership_applications_user_id` |
| `news` | `yazarid` | `users` | `idx_news_yazarid` |
| `oauth_auth_codes` | `userid` | `users` | `idx_oauth_auth_codes_userid` |
| `oauth_clients` | `olusturanid` | `users` | `idx_oauth_clients_olusturanid` |
| `oauth_consents` | `clientid` | `oauth_clients` | `idx_oauth_consents_clientid` |
| `project_likes` | `userid` | `users` | `idx_project_likes_userid` |
| `projects` | `created_by`, `olusturanid`, `teamid` | `users`, `teams` | `idx_projects_created_by`, `idx_projects_olusturanid`, `idx_projects_teamid` |
| `team_application_decisions` | `userid` | `users` | `idx_team_application_decisions_userid` |
| `team_members` | `userid` | `users` | `idx_team_members_userid` |
| `team_task_activities` | `aktorid` | `users` | `idx_team_task_activities_aktorid` |
| `team_task_comments` | `userid` | `users` | `idx_team_task_comments_userid` |
| `team_tasks` | `atananuyeid`, `olusturanid`, `teamid` | `users`, `teams` | `idx_team_tasks_atananuyeid`, `idx_team_tasks_olusturanid`, `idx_team_tasks_teamid` |
| `teams` | `liderid` | `users` | `idx_teams_liderid` |
| `users` | `role_id` | `roles` | `idx_users_role_id` |


