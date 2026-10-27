/**
 * Normalizes and localizes SoC alert and SIEM security messages
 * ensuring full bilingual (EN/TR) support even for historical logs.
 */
export function formatSocAlertMessage(message: string, isEn: boolean): string {
	if (!message || typeof message !== 'string') return '';
	const trimmed = message.trim();

	// 1. Unauthorized app access attempt
	const mApp = trimmed.match(/^Yetkisiz uygulama erişim denemesi \(([^)]+)\): (.+)$/i);
	if (mApp) {
		return isEn
			? `Unauthorized app access attempt (${mApp[1]}): ${mApp[2]}`
			: `Yetkisiz uygulama erişim denemesi (${mApp[1]}): ${mApp[2]}`;
	}
	const mAppEn = trimmed.match(/^Unauthorized app access attempt \(([^)]+)\): (.+)$/i);
	if (mAppEn) {
		return isEn
			? trimmed
			: `Yetkisiz uygulama erişim denemesi (${mAppEn[1]}): ${mAppEn[2]}`;
	}

	// 2. Unauthorized specific endpoint attempt blocked
	const mEndp = trimmed.match(/^Yetkisiz (\S+) erişim denemesi engellendi$/i);
	if (mEndp) {
		return isEn
			? `Unauthorized ${mEndp[1]} access attempt blocked`
			: `Yetkisiz ${mEndp[1]} erişim denemesi engellendi`;
	}
	const mEndpEn = trimmed.match(/^Unauthorized (\S+) access attempt blocked$/i);
	if (mEndpEn) {
		return isEn
			? trimmed
			: `Yetkisiz ${mEndpEn[1]} erişim denemesi engellendi`;
	}

	// 3. Unauthorized admin endpoint
	const mAdmin = trimmed.match(/^Yetkisiz yönetici \(admin\) uç noktası erişim denemesi \(([^)]+)\): (.+)$/i);
	if (mAdmin) {
		return isEn
			? `Unauthorized admin endpoint access attempt (${mAdmin[1]}): ${mAdmin[2]}`
			: `Yetkisiz yönetici (admin) uç noktası erişim denemesi (${mAdmin[1]}): ${mAdmin[2]}`;
	}
	const mAdminEn = trimmed.match(/^Unauthorized admin endpoint access attempt \(([^)]+)\): (.+)$/i);
	if (mAdminEn) {
		return isEn
			? trimmed
			: `Yetkisiz yönetici (admin) uç noktası erişim denemesi (${mAdminEn[1]}): ${mAdminEn[2]}`;
	}

	// 4. IPS Auto-ban
	const mIps = trimmed.match(/^\[IPS AUTO-BAN\] Saldırgan IP otomatik karantinaya alındı: (\S+)(?: \(Tehdit Puanı: (\d+)\))?/i);
	if (mIps) {
		const scorePart = mIps[2] ? (isEn ? ` (Threat Score: ${mIps[2]})` : ` (Tehdit Puanı: ${mIps[2]})`) : '';
		return isEn
			? `[IPS AUTO-BAN] Hostile IP auto-quarantined: ${mIps[1]}${scorePart}`
			: `[IPS AUTO-BAN] Saldırgan IP otomatik karantinaya alındı: ${mIps[1]}${scorePart}`;
	}
	const mIpsEn = trimmed.match(/^\[IPS AUTO-BAN\] Hostile IP auto-quarantined: (\S+)(?: \(Threat Score: (\d+)\))?/i);
	if (mIpsEn) {
		const scorePart = mIpsEn[2] ? (isEn ? ` (Threat Score: ${mIpsEn[2]})` : ` (Tehdit Puanı: ${mIpsEn[2]})`) : '';
		return isEn
			? trimmed
			: `[IPS AUTO-BAN] Saldırgan IP otomatik karantinaya alındı: ${mIpsEn[1]}${scorePart}`;
	}

	// 5. WAF attack signature blocked
	const mWafPub = trimmed.match(/^\[WAF\] Genel API saldırı imzası engellendi \(([^)]+)\): (.+)$/i);
	if (mWafPub) {
		return isEn
			? `[WAF] Public API attack signature blocked (${mWafPub[1]}): ${mWafPub[2]}`
			: `[WAF] Genel API saldırı imzası engellendi (${mWafPub[1]}): ${mWafPub[2]}`;
	}
	const mWafPubEn = trimmed.match(/^\[WAF\] Public API attack signature blocked \(([^)]+)\): (.+)$/i);
	if (mWafPubEn) {
		return isEn
			? trimmed
			: `[WAF] Genel API saldırı imzası engellendi (${mWafPubEn[1]}): ${mWafPubEn[2]}`;
	}

	const mWaf = trimmed.match(/^\[WAF\] Saldırı imzası engellendi \(([^)]+)\): (.+)$/i);
	if (mWaf) {
		return isEn
			? `[WAF] Attack signature blocked (${mWaf[1]}): ${mWaf[2]}`
			: `[WAF] Saldırı imzası engellendi (${mWaf[1]}): ${mWaf[2]}`;
	}
	const mWafEn = trimmed.match(/^\[WAF\] Attack signature blocked \(([^)]+)\): (.+)$/i);
	if (mWafEn) {
		return isEn
			? trimmed
			: `[WAF] Saldırı imzası engellendi (${mWafEn[1]}): ${mWafEn[2]}`;
	}

	// 6. Failed login attempt
	const mFailEmail = trimmed.match(/^Failed login attempt \(unregistered email\): (.+)$/i);
	if (mFailEmail) {
		return isEn
			? trimmed
			: `Başarısız giriş denemesi (kayıtsız e-posta): ${mFailEmail[1]}`;
	}
	const mFailEmailTr = trimmed.match(/^Başarısız giriş denemesi \(kayıtsız e-posta\): (.+)$/i);
	if (mFailEmailTr) {
		return isEn
			? `Failed login attempt (unregistered email): ${mFailEmailTr[1]}`
			: trimmed;
	}

	const mFailPass = trimmed.match(/^Failed login attempt \(invalid password\): (.+)$/i);
	if (mFailPass) {
		return isEn
			? trimmed
			: `Başarısız giriş denemesi (hatalı parola): ${mFailPass[1]}`;
	}
	const mFailPassTr = trimmed.match(/^Başarısız giriş denemesi \(hatalı parola\): (.+)$/i);
	if (mFailPassTr) {
		return isEn
			? `Failed login attempt (invalid password): ${mFailPassTr[1]}`
			: trimmed;
	}

	// 7. Honeypot
	const mHoney = trimmed.match(/^\[Honeypot\] Automated bot registration attempt blocked: (.+)$/i);
	if (mHoney) {
		return isEn
			? trimmed
			: `[Honeypot] Otomatik bot kayıt denemesi engellendi: ${mHoney[1]}`;
	}
	const mHoneyTr = trimmed.match(/^\[Honeypot\] Otomatik bot kayıt denemesi engellendi: (.+)$/i);
	if (mHoneyTr) {
		return isEn
			? `[Honeypot] Automated bot registration attempt blocked: ${mHoneyTr[1]}`
			: trimmed;
	}

	// 8. Session IP mismatch
	if (trimmed.includes('Oturum IP uyuşmazlığı')) {
		return isEn ? trimmed.replace('Oturum IP uyuşmazlığı', 'Session IP mismatch anomaly') : trimmed;
	}

	// 9. Unauthorized write / admin reason
	if (trimmed.startsWith('Yetkisiz yazma denemesi')) {
		return isEn ? trimmed.replace('Yetkisiz yazma denemesi', 'Unauthorized write attempt') : trimmed;
	}
	if (trimmed.startsWith('Yetkisiz admin uç noktası denemesi')) {
		return isEn ? trimmed.replace('Yetkisiz admin uç noktası denemesi', 'Unauthorized admin endpoint attempt') : trimmed;
	}

	// 10. Rate limits
	if (trimmed.includes('2FA doğrulama IP hız sınırı aşıldı')) {
		return isEn ? '2FA verification IP rate limit exceeded' : '2FA doğrulama IP hız sınırı aşıldı';
	}
	if (trimmed.includes('2FA doğrulama kullanıcı hız sınırı aşıldı')) {
		return isEn ? '2FA verification user rate limit exceeded' : '2FA doğrulama kullanıcı hız sınırı aşıldı';
	}
	if (trimmed.includes('Şifre değiştirme hatalı mevcut şifre denemesi')) {
		return isEn ? trimmed.replace('Şifre değiştirme hatalı mevcut şifre denemesi', 'Password change failed (invalid current password)') : trimmed;
	}

	// 11. IPS Auto-Quarantine prefix
	if (trimmed.startsWith('[IPS Otomatik Karantina]')) {
		return isEn ? trimmed.replace('[IPS Otomatik Karantina]', '[IPS Auto-Quarantine]') : trimmed;
	}

	// 12. IDOR attempts
	const mIdorRead = trimmed.match(/^Yetkisiz sohbet odası mesajlarını okuma denemesi \(IDOR: ([^)]+)\): (.+)$/i);
	if (mIdorRead) {
		return isEn
			? `Unauthorized chat room read attempt (IDOR: ${mIdorRead[1]}): ${mIdorRead[2]}`
			: trimmed;
	}
	const mIdorSend = trimmed.match(/^Yetkisiz sohbet odasına mesaj gönderme denemesi \(IDOR: ([^)]+)\): (.+)$/i);
	if (mIdorSend) {
		return isEn
			? `Unauthorized chat room send attempt (IDOR: ${mIdorSend[1]}): ${mIdorSend[2]}`
			: trimmed;
	}
	if (trimmed.startsWith('Özel sohbet IDOR')) {
		return isEn ? trimmed.replace('Özel sohbet IDOR okuma denemesi', 'Private chat IDOR read attempt').replace('Özel sohbet IDOR yazma denemesi', 'Private chat IDOR write attempt') : trimmed;
	}

	// 13. CSRF & Session Security
	if (trimmed.includes('CSRF / Cross-Origin istek engellendi')) {
		return isEn ? trimmed.replace('CSRF / Cross-Origin istek engellendi', 'CSRF / Cross-Origin request blocked') : trimmed;
	}
	if (trimmed.includes('Oturum IP değişimi (Session Hijack şüphesi)')) {
		return isEn ? trimmed.replace('Oturum IP değişimi (Session Hijack şüphesi)', 'Session IP change anomaly (Session Hijack suspicion)') : trimmed;
	}
	if (trimmed.includes('Geçersiz veya süresi dolmuş oturum jetonu ile işlem denemesi')) {
		return isEn ? trimmed.replace('Geçersiz veya süresi dolmuş oturum jetonu ile işlem denemesi', 'Operation attempt with invalid or expired session token') : trimmed;
	}
	if (trimmed.startsWith('SoC tarafından kullanıcı oturumu zorla sonlandırıldı:')) {
		return isEn ? trimmed.replace('SoC tarafından kullanıcı oturumu zorla sonlandırıldı:', 'User session forcibly terminated by SoC:') : trimmed;
	}
	if (trimmed.includes('SoC Acil Durum Kill-Switch:')) {
		return isEn ? trimmed.replace('SoC Acil Durum Kill-Switch:', 'SoC Emergency Kill-Switch:').replace('aktif kullanıcı oturumu sıfırlandı', 'active user sessions reset') : trimmed;
	}
	if (trimmed.includes('SoC Toplu Oturum Feshi:')) {
		return isEn ? trimmed.replace('SoC Toplu Oturum Feshi:', 'SoC Mass Session Termination:').replace('IP anomalisi tespit edilen', 'anomalous IP detected for').replace('oturum sonlandırıldı', 'sessions terminated') : trimmed;
	}

	return trimmed;
}
