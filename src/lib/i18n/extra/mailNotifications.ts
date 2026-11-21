export const mailNotificationsExtraStrings = {
	tr: {
		mailGreeting: 'Merhaba {first} {last},',
		mailRegReceivedSubject: 'Başvurunuz alındı — {clubName}',
		mailRegReceivedBodyFallback:
			'Topluluk üyelik başvurunuz alındı. Yönetim incelemesinin ardından hesabınız aktifleştirilecek ve bu adrese bilgi verilecektir.',
		mailRegReceivedHold: 'Başvurunuz onaylanana kadar panele giriş yapamazsınız.',
		mailVerifySubject: 'E-posta Doğrulama Kodunuz: {code} — {clubName}',
		mailVerifyBody:
			'Topluluk üyelik başvurunuzu tamamlamak için lütfen aşağıdaki 6 haneli doğrulama kodunu kullanın:',
		mailVerifyExpiry:
			'Bu kod 15 dakika boyunca geçerlidir. Başvuru talebini siz başlatmadıysanız bu e-postayı dikkate almayınız.',
		mailEmailChangeSubject: 'E-posta Değişikliği Doğrulama Kodunuz: {code} — {clubName}',
		mailEmailChangeBody:
			'Hesabınızın e-posta adresini bu adrese taşımak için aşağıdaki 6 haneli kodu kullanın:',
		mailEmailChangeExpiry:
			'Bu kod 15 dakika boyunca geçerlidir. Talebi siz başlatmadıysanız bu e-postayı dikkate almayınız.',
		mailEmailChangedSubject: 'E-posta adresiniz değişti — {clubName}',
		mailEmailChangedBody:
			'Hesabınızın e-posta adresi <strong>{newEmail}</strong> olarak güncellendi. ' +
			'Bu değişikliği siz yapmadıysanız derhal topluluk yönetimine başvurun.',
		mailApprovedSubject: 'Üyeliğiniz onaylandı — {clubName}',
		mailApprovedBody:
			'Topluluk üyelik başvurunuz onaylandı. Artık panelinize kayıt sırasında belirlediğiniz şifreyle giriş yapabilirsiniz.',
		mailApproved2faHint:
			'Girişlerinizi iki adımlı doğrulama ile korumanızı öneririz: Ayarlar → Güvenlik & 2FA.',
		mailAdminCreatedSubject: 'Topluluk Hesabınız Oluşturuldu — {clubName}',
		mailAdminCreatedBody:
			'Topluluk yönetimi tarafından hesabınız oluşturuldu. Sisteme giriş yapmak için geçici şifreniz: {passHtml}',
		mailAdminCreatedSecurityHint:
			'Güvenliğiniz için ilk girişinizin ardından Ayarlar → Güvenlik & 2FA bölümünden ' +
			'şifrenizi güncellemenizi ve iki adımlı doğrulamayı etkinleştirmenizi öneririz.',
		mailRejectedSubject: 'Başvurunuz hakkında — {clubName}',
		mailRejectedBody:
			'Topluluk üyelik başvurunuz bu dönem için onaylanmadı. ' +
			'Sorularınız için topluluk yönetimiyle iletişime geçebilirsiniz.',
		mailPwResetCodeSubject: 'Şifre Sıfırlama Kodunuz: {code} — {clubName}',
		mailPwResetCodeBody:
			'Hesap şifrenizi sıfırlamak için talepte bulundunuz. Yeni şifrenizi belirlemek için aşağıdaki 6 haneli kodu girin:',
		mailPwResetCodeExpiry:
			'Bu kod 15 dakika boyunca geçerlidir. Talebi siz yapmadıysanız şifreniz değişmemiştir, ' +
			'güvenliğiniz için topluluk yönetimine bilgi veriniz.',
		mailPortalMessageSubject: 'Yeni mesaj: {subject} — {clubName}',
		mailPortalMessageBody:
			'{fromName} size portalda bir mesaj gönderdi: <strong>{subject}</strong>',
		mailPortalMessageHint:
			'Mesajı okumak ve yanıtlamak için portaldaki Posta uygulamasını açın.',
		mailPwResetTempSubject: 'Hesap Şifreniz Sıfırlandı — {clubName}',
		mailPwResetTempBody:
			'Hesap şifreniz topluluk yönetimi tarafından sıfırlandı. Yeni geçici şifreniz: {passHtml}',
		mailPwResetDoneBody: 'Hesabınız için şifre sıfırlama işlemi gerçekleştirildi.',
		mailPwResetAdvice:
			'Güvenliğiniz için sisteme giriş yaptıktan sonra Ayarlar panelinden şifrenizi güncellemenizi rica ederiz.',
		mail2faCodeSubject: 'İki Aşamalı Doğrulama (2FA) Kodunuz: {code} — {clubName}',
		mail2faCodeBody: 'Giriş doğrulama kodunuz: {codeHtml}',
		mail2faCodeExpiry:
			'Bu kod 10 dakika boyunca geçerlidir. Giriş talebinde siz bulunmadıysanız bu e-postayı dikkate almayınız.',
	},
	en: {
		mailGreeting: 'Hello {first} {last},',
		mailRegReceivedSubject: 'Application received — {clubName}',
		mailRegReceivedBodyFallback:
			'Your community membership application has been received. Following review by community ' +
			'managers, your account will be activated and you will be informed.',
		mailRegReceivedHold: 'You will not be able to sign in until your application is approved.',
		mailVerifySubject: 'Your Email Verification Code: {code} — {clubName}',
		mailVerifyBody:
			'Please enter the 6-digit verification code below to complete your community membership registration:',
		mailVerifyExpiry:
			'This code is valid for 15 minutes. If you did not initiate this request, you can safely ignore this email.',
		mailEmailChangeSubject: 'Email Change Verification Code: {code} — {clubName}',
		mailEmailChangeBody: 'Enter the 6-digit code below to move your account email to this address:',
		mailEmailChangeExpiry:
			'This code is valid for 15 minutes. If you did not initiate this change, ignore this email.',
		mailEmailChangedSubject: 'Your email address has been changed — {clubName}',
		mailEmailChangedBody:
			'Your account email address has been updated to <strong>{newEmail}</strong>. ' +
			'If you did not perform this change, contact community management immediately.',
		mailApprovedSubject: 'Membership approved — Welcome to {clubName}',
		mailApprovedBody:
			'Your community membership application has been approved! You can now sign in to your ' +
			'workspace using the password you set during registration.',
		mailApproved2faHint:
			'We recommend protecting your account with two-factor authentication: Settings → Security & 2FA.',
		mailAdminCreatedSubject: 'Your Community Account Has Been Created — {clubName}',
		mailAdminCreatedBody:
			'Your account was created by community managers. Your temporary password to sign in is: {passHtml}',
		mailAdminCreatedSecurityHint:
			'For security, please change your password and enable 2FA under Settings → Security & 2FA ' +
			'upon your first login.',
		mailRejectedSubject: 'Regarding your membership application — {clubName}',
		mailRejectedBody:
			'Your community membership application could not be approved for this term. ' +
			'For further inquiries, please contact community management.',
		mailPwResetCodeSubject: 'Password Reset Code: {code} — {clubName}',
		mailPwResetCodeBody:
			'You requested to reset your password. Enter the 6-digit code below to set a new password:',
		mailPwResetCodeExpiry:
			'This code is valid for 15 minutes. If you did not make this request, your password remains unchanged.',
		mailPortalMessageSubject: 'New message: {subject} — {clubName}',
		mailPortalMessageBody:
			'{fromName} sent you a message on the portal: <strong>{subject}</strong>',
		mailPortalMessageHint: 'Open the Mail app in the workspace to read and reply.',
		mailPwResetTempSubject: 'Your Password Has Been Reset — {clubName}',
		mailPwResetTempBody:
			'Your account password was reset by community managers. Your new temporary password: {passHtml}',
		mailPwResetDoneBody: 'A password reset was performed for your account.',
		mailPwResetAdvice:
			'For security, please update your password after logging in from the Settings panel.',
		mail2faCodeSubject: 'Your Two-Factor Authentication (2FA) Code: {code} — {clubName}',
		mail2faCodeBody: 'Your login verification code: {codeHtml}',
		mail2faCodeExpiry:
			'This code is valid for 10 minutes. If you did not attempt to sign in, ignore this email.',
	},
};
