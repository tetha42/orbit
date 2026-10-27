'use client';

import React, { useState } from 'react';
import { X, Shield, FileText, Cookie, Check } from 'lucide-react';
import { useI18n } from '@/core/i18n';

export type LegalTab = 'terms' | 'privacy' | 'cookies';

interface LegalModalProps {
	isOpen: boolean;
	initialTab?: LegalTab;
	onClose: () => void;
	onAccept?: () => void;
}

export function LegalModal({ isOpen, initialTab = 'terms', onClose, onAccept }: LegalModalProps) {
	const { language } = useI18n();
	const isTr = language === 'tr';
	const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

	React.useEffect(() => {
		if (isOpen && initialTab) {
			setActiveTab(initialTab);
		}
	}, [isOpen, initialTab]);

	if (!isOpen) return null;

	const tabs: Array<{ id: LegalTab; label: string; icon: React.ReactNode }> = [
		{
			id: 'terms',
			label: isTr ? 'Kullanım Koşulları' : 'Terms of Service',
			icon: <FileText size={14} />,
		},
		{
			id: 'privacy',
			label: isTr ? 'Gizlilik Politikası (GDPR)' : 'Privacy Policy (GDPR)',
			icon: <Shield size={14} />,
		},
		{
			id: 'cookies',
			label: isTr ? 'Çerez & Oturum Politikası' : 'Cookie & Session Policy',
			icon: <Cookie size={14} />,
		},
	];

	return (
		<div
			role="dialog"
			aria-modal="true"
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 9999,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'rgba(9, 9, 11, 0.85)',
				padding: '16px',
			}}
		>
			<div
				style={{
					width: '100%',
					maxWidth: '640px',
					maxHeight: '85vh',
					background: '#111113',
					border: '1px solid #27272a',
					borderRadius: '10px',
					color: '#fafafa',
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
				}}
			>
				{/* Structural Monochrome Header */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '16px 20px',
						borderBottom: '1px solid #27272a',
						background: '#09090b',
					}}
				>
					<div>
						<div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#a1a1aa', letterSpacing: '0.08em' }}>
							ORBIT // TETHA42 • LEGAL & COMPLIANCE
						</div>
						<h3 style={{ fontSize: '16px', fontWeight: 700, margin: '4px 0 0', color: '#fafafa' }}>
							{isTr ? 'Küresel Yasal Standartlar & Veri Koruma' : 'Global Legal Standards & Data Protection'}
						</h3>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label={isTr ? 'Kapat' : 'Close'}
						style={{
							width: '32px',
							height: '32px',
							borderRadius: '6px',
							border: '1px solid #27272a',
							background: '#111113',
							color: '#a1a1aa',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							cursor: 'pointer',
						}}
					>
						<X size={16} />
					</button>
				</div>

				{/* Tab Bar */}
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(3, 1fr)',
						gap: '6px',
						padding: '10px 20px',
						background: '#09090b',
						borderBottom: '1px solid #27272a',
					}}
				>
					{tabs.map((tab) => {
						const active = activeTab === tab.id;
						return (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: '6px',
									padding: '8px 10px',
									borderRadius: '6px',
									border: active ? '1px solid #fafafa' : '1px solid #27272a',
									background: active ? '#fafafa' : '#111113',
									color: active ? '#09090b' : '#a1a1aa',
									fontSize: '12px',
									fontWeight: 600,
									cursor: 'pointer',
								}}
							>
								{tab.icon}
								<span>{tab.label}</span>
							</button>
						);
					})}
				</div>

				{/* Content Area */}
				<div
					style={{
						padding: '20px',
						overflowY: 'auto',
						fontSize: '13px',
						lineHeight: 1.65,
						color: '#d4d4d8',
						display: 'flex',
						flexDirection: 'column',
						gap: '14px',
					}}
				>
					{activeTab === 'terms' && (
						<>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{isTr ? '1. Hizmet Koşulları ve Topluluk Kuralları' : '1. Terms of Service & Community Guidelines'}
							</h4>
							<p style={{ margin: 0 }}>
								{isTr
									? 'Orbit Community OS ("Platform"), toplulukların iş birliği, proje yönetimi, etkinlik organizasyonu ve güvenli iletişim yürütmesi için tetha42 tarafından geliştirilen bağımsız bir çalışma alanıdır.'
									: 'Orbit Community OS ("the Platform") is a self-hosted digital workspace engineered by tetha42 for engineering teams, open-source collectives, and research communities.'}
							</p>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{isTr ? '2. Kabul Edilebilir Kullanım ve Hesap Güvenliği' : '2. Acceptable Use & Account Security'}
							</h4>
							<p style={{ margin: 0 }}>
								{isTr
									? 'Üyeler, hesap kimlik bilgilerini korumakla, yetkisiz erişim girişimlerinden kaçınmakla ve topluluk çalışma alanlarında saygılı, yapıcı bir iletişim sürdürmekle yükümlüdür. Otomatik tarama, yetkisiz sızma girişimleri veya sistem bütünlüğünü bozmaya yönelik eylemler otonom güvenlik duvarı (SoC/WAF) tarafından engellenir.'
									: 'Members are responsible for safeguarding their credentials (passwords, TOTP authenticators, and WebAuthn passkeys) and maintaining constructive conduct across all shared workspaces. Automated scraping, unauthorized probing, or attempts to compromise system integrity are actively mitigated by the autonomous SoC and WAF engine.'}
							</p>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{isTr ? '3. Fikri Mülkiyet ve Sorumluluk' : '3. Intellectual Property & Liability'}
							</h4>
							<p style={{ margin: 0 }}>
								{isTr
									? 'Platform üzerinde paylaşılan projeler, belgeler ve katkılar ilgili yazarların ve topluluğun belirlediği açık kaynak veya iç lisans koşullarına tabidir. Platform "olduğu gibi" sunulmaktadır.'
									: 'Projects, documents, and technical artifacts published within the workspace remain subject to the licenses designated by their respective authors and community governance. The Platform is provided "as is" without warranty of any kind.'}
							</p>
						</>
					)}

					{activeTab === 'privacy' && (
						<>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{isTr ? '1. Küresel Veri Koruma ve GDPR Uyumluluğu' : '1. GDPR & Global Data Protection Compliance'}
							</h4>
							<p style={{ margin: 0 }}>
								{isTr
									? 'Orbit Community OS, Veri Minimizasyonu (Data Minimization) ve Tasarımdan İtibaren Gizlilik (Privacy by Design) ilkelerine göre çalışır. Yalnızca topluluk üyeliği, yetkilendirme ve çalışma alanı işlevleri için zorunlu olan veriler (ad, e-posta, üye kimliği, çalışma alanı/seviye) işlenir.'
									: 'Orbit Community OS operates under strict Data Minimization and Privacy-by-Design principles aligned with GDPR and global privacy regulations. Only data strictly required for identity verification, role-based access control, and workspace collaboration (name, email, member handle, track, and experience level) is processed.'}
							</p>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{isTr ? '2. Kriptografik Güvenlik ve Saklama' : '2. Cryptographic Security & Self-Hosted Sovereignty'}
							</h4>
							<p style={{ margin: 0 }}>
								{isTr
									? 'Parolalar Bcrypt (maliyet faktörü 12) ile özetlenir, 2FA TOTP sırları AES-256-GCM ile şifrelenir ve tüm veriler yalnızca topluluğun kendi barındırdığı PostgreSQL veritabanında tutulur. Hiçbir veri üçüncü taraf reklam ağlarına veya veri simsarlarına aktarılmaz.'
									: 'Passwords are hashed using Bcrypt (cost factor 12), TOTP secrets are encrypted at rest with AES-256-GCM, and all records reside exclusively within your self-hosted PostgreSQL instance. Zero personal data is sold, shared with data brokers, or transmitted to external telemetry networks.'}
							</p>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{isTr ? '3. Kullanıcı Hakları (Erişim, Düzeltme, Silme ve Taşınabilirlik)' : '3. Your Rights (Access, Erasure & Portability)'}
							</h4>
							<p style={{ margin: 0 }}>
								{isTr
									? 'Üyeler diledikleri zaman kişisel verilerine erişme, profil bilgilerini güncelleme, verilerinin dışa aktarılmasını talep etme ve hesaplarının kalıcı olarak silinmesini (Unutulma Hakkı) isteme hakkına sahiptir.'
									: 'Every member retains the right to inspect their stored profile data, rectify inaccuracies, export their records in machine-readable formats, and request permanent account erasure ("Right to be Forgotten") through the workspace administrators.'}
							</p>
						</>
					)}

					{activeTab === 'cookies' && (
						<>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{isTr ? '1. Zorunlu Oturum Çerezleri (HttpOnly)' : '1. Strictly Necessary Session Cookies (HttpOnly)'}
							</h4>
							<p style={{ margin: 0 }}>
								{isTr
									? 'Orbit Community OS, yalnızca güvenli kimlik doğrulama ve CSRF koruması için криptografik olarak imzalanmış, HttpOnly ve SameSite=Lax bayraklı birinci taraf oturum çerezleri kullanır. Bu çerezler olmadan çalışma alanı oturumu açılamaz.'
									: 'Orbit Community OS uses strictly necessary, cryptographically signed first-party HttpOnly session cookies (SameSite=Lax) solely to maintain authenticated sessions and enforce CSRF protection.'}
							</p>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{isTr ? '2. Yerel Tercih Depolaması (LocalStorage)' : '2. Local Workspace Preferences'}
							</h4>
							<p style={{ margin: 0 }}>
								{isTr
									? 'Arayüz dili (EN/TR), tema, pencere düzeni ve ses düzeyi gibi kullanıcı arayüzü tercihleri yalnızca tarayıcınızın yerel depolama alanında (localStorage) saklanır.'
									: 'User interface preferences such as language selection (EN/TR), theme mode, window geometry, and audio volume are stored locally in your browser via LocalStorage.'}
							</p>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{isTr ? '3. Sıfır Üçüncü Taraf İzleme veya Reklam Çerezi' : '3. Zero Third-Party Advertising or Tracking Cookies'}
							</h4>
							<p style={{ margin: 0 }}>
								{isTr
									? 'Platformda hiçbir üçüncü taraf reklam çerezi, davranışsal profilleme pikseli veya çapraz site izleyici (cross-site tracker) bulunmaz.'
									: 'Orbit Community OS deploys zero third-party advertising cookies, behavioral profiling pixels, or cross-site analytics trackers.'}
							</p>
						</>
					)}
				</div>

				{/* Footer */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'flex-end',
						gap: '10px',
						padding: '14px 20px',
						borderTop: '1px solid #27272a',
						background: '#09090b',
					}}
				>
					<button
						type="button"
						onClick={onClose}
						style={{
							minHeight: '40px',
							padding: '0 16px',
							borderRadius: '6px',
							border: '1px solid #27272a',
							background: '#111113',
							color: '#a1a1aa',
							fontSize: '13px',
							fontWeight: 600,
							cursor: 'pointer',
						}}
					>
						{isTr ? 'Kapat' : 'Close'}
					</button>
					{onAccept && (
						<button
							type="button"
							onClick={onAccept}
							style={{
								minHeight: '40px',
								padding: '0 18px',
								borderRadius: '6px',
								border: '1px solid #fafafa',
								background: '#fafafa',
								color: '#09090b',
								fontSize: '13px',
								fontWeight: 700,
								cursor: 'pointer',
								display: 'inline-flex',
								alignItems: 'center',
								gap: '6px',
							}}
						>
							<Check size={15} />
							<span>{isTr ? 'Okudum ve Kabul Ediyorum' : 'I Acknowledge & Accept'}</span>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
