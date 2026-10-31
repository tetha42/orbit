# Kullanıcı Verisi, Davet ve Oturum Güvenliği

Bu belge mevcut şemayı ve çalışma akışlarını özetler. Hedef veri modeli için
[`DATA_MODEL_ROADMAP.md`](./DATA_MODEL_ROADMAP.md) ve
[`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md) esas alınır.

## 1. `users` tablosunda hangi veri türleri var?

Mevcut şema 30 kolondan oluşur. Kategoriler:

### Kimlik ve iletişim
- `id`, `first_name`, `last_name`
- `email`, `email_verified_at`
- `handle`

### Topluluk profili
- `department` (track)
- `grade` (seviye)
- `avatar_url`
- `bio`
- `xp`
- `status` (`beklemede`, `aktif`, `reddedildi`, `mezun`)
- `role_id`
- `created_at`

### Kimlik doğrulama
- `password_hash` — bcrypt, asla düz metin değil
- `auth_method` (`password`, `totp`, `passkey`)
- `session_token`, `session_expires_at`
- `totp_secret`, `totp_enabled`, `totp_recovery_codes`, `totp_confirmed_at`, `totp_last_step`

### Güvenlik telemetrisi
- `last_login_at`, `last_login_ip`, `last_login_user_agent`
- `last_active_at`, `last_active_ip`
- `mail_notifications_enabled`

### İlişkili tablolar
- `webauthn_credentials` — passkey public key, sayaç, cihaz tipi; **private key cihazda kalır**
- `legal_acceptances` — belge sürümü, content hash, IP/UA, kaynak
- `membership_applications` — başvuru snapshot’ı, onay/red, yeniden başvuru bağlantısı
- `team_members` — takım/komite üyeliği, rol, oy hakkı, dönem
- `role_permissions` — rolün uygulama yetkileri
- `audit_logs` (`denetim_kaydi`) — yönetimsel değişiklik kaydı
- `email_change_requests` — doğrulamalı e-posta değişimi
- `email_verifications` — kayıt/şifre sıfırlama OTP’leri (hash’li)
- `mail_outbox` — SMTP yokken onay bekleyen işlem e-postaları (şifreli payload)

### Saklanmayanlar
- Düz metin parola
- Passkey private key
- Ham OTP kodu
- E-posta içeriği (mail IMAP sunucusunda; uygulama DB’sinde değil)

> Ekteki `readable_schema.sql` eski `kullanicilar` şemasını gösterir (`eposta`,
> `sifrehash`, `rolid` gibi). Uygulama artık `users` tablosunu ve yukarıdaki
> İngilizce kolon adlarını kullanır; eski dump tek başına güncel şema değildir.

## 2. Davet akışı

1. Settings → **Üyelik Politikası**’nda davet sistemi açık olmalıdır.
2. Yönetici e-posta (opsiyonel), rol (opsiyonel), not ve geçerlilik süresiyle davet oluşturur.
3. Sunucu 24 byte rastgele token üretir. Ham token yalnızca o yanıtta gösterilir; DB’de SHA-256 hash’i saklanır.
4. Bağlantı: `/?invite=<token>`.
5. Kayıt formu token’ı gönderir; sunucu hash’i, süreyi, kullanılmamış olmasını ve varsa e-posta eşleşmesini doğrular.
6. Kullanıcı `beklemede` olarak açılır; davet rolü önceden atanır; davet tek kullanımlık olarak tüketilir.
7. Başvuru `pending_review` açılır. **Davet manuel onayı atlamaz.**
8. E-posta doğrulama politikası açıksa OTP akışı yine uygulanır.

Sınırlar:
- Ham token tekrar görüntülenemez; kaybolursa yeni davet gerekir.
- Davet süresi dolduysa/ kullanıldıysa reddedilir.
- `invitations.team_id` alanı şemada ve API’de var; davet UI’ında takım seçici ve kayıt sırasında otomatik takım üyeliği henüz bağlı değildir.

## 3. Şifre sıfırlama

### Self-servis
`/api/auth/reset-password` iki adımlıdır:
1. `request_code` — e-posta kayıtlıysa 6 haneli kod gönderilir (enumeration önleme).
2. `verify_and_reset` — kod doğrulanınca yeni parola yazılır, tüm oturumlar düşürülür.

### SMTP yokken / geçici hatada
Kayıt doğrulama kodu e-postası gönderilemezse:
- `mail_outbox` tablosuna `pending` olarak alınır; kod AES-GCM ile şifreli payload’da tutulur.
- Kullanıcıya “doğrulama kodunuz yönetici onayına alındı” mesajı gösterilir.
- OTP süresi 24 saate uzatılır.
- Admin, Posta uygulamasındaki **Gönderim Onayı** panelinden onaylar; onay yeniden gönderir.
- Gönderim hâlâ başarısızsa kayıt `failed` olur ve hata panelde görünür; SMTP düzeltilince tekrar onaylanabilir.

### Yönetici tetiklemeli
`POST /api/members/:id/password-reset`:
- `members:yonet` gerektirir.
- Hedefin e-postasına yeni 6 haneli kod gönderir; kod istemciye dönmez.
- Admin hesapları için kapalıdır.
- Aktör başına 15 dakikada 3 istek sınırı vardır.
- `uye.sifre_sifirlama` audit kaydı üretir.

Üye, gelen kodu mevcut “Şifremi unuttum” ekranında e-posta + kod + yeni parola ile kullanır.

## 4. Passkey ve 2FA

- WebAuthn passkey kaydı: Settings → Güvenlik.
- Giriş ekranında tarayıcı `PublicKeyCredential` destekliyorsa **Passkey ile giriş** görünür.
- Passkey oturumu çok faktörlü sayılır; rolün 2FA zorunluluğunu karşılar.
- Terminal: passkey oturumunda TOTP sormadan kabuk açılır.
- Veritabanı: passkey oturumunda `method: "passkey"` ile kısa ömürlü DB token alınır.
- Proton Pass gibi tarayıcı eklentileri standart WebAuthn sanal authenticator sunuyorsa çalışabilir; bu, eklentinin ve tarayıcının WebAuthn desteğine bağlıdır. Bu projede Proton Pass ile canlı test yapılmadı.

## 5. PWA fullscreen

- Manifest `display: fullscreen` ve `display_override: [fullscreen, window-controls-overlay, standalone, minimal-ui]`.
- Kurulu PWA’da ilk pointer/keyboard etkileşiminde bir kez `requestFullscreen()` denenir.
- Tarayıcı reddederse uygulama normal pencerede çalışmaya devam eder.
- iOS/Safari ve bazı tarayıcılar Fullscreen API’yi kısıtlayabilir.

## 6. Denetim kaydı

- Yönetimsel değişiklik geçmişi artık **SoC Studio → Forensics & Audit → Change History** altındadır.
- Settings’teki ayrı Audit sekmesi kaldırıldı; Roller ekranındaki gömülü geçmiş de kaldırıldı.
- `/api/audit` GET: admin **veya** `soc:yonet`.
- `/api/audit` DELETE (temizleme) yalnızca admin.
