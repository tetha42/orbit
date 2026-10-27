'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/core/i18n';
import { Building2, CheckCircle2, AlertCircle, Shield, Globe, Award, Sparkles } from 'lucide-react';
import { useSound } from '@/core/sound';
import { errorMessage } from '@/lib/errors';

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 12px',
	borderRadius: '8px',
	background: 'rgba(0, 0, 0, 0.25)',
	border: '1px solid var(--window-border)',
	color: 'inherit',
	fontSize: '13px',
	outline: 'none',
	boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
	fontSize: '12px',
	opacity: 0.85,
	display: 'block',
	marginBottom: '6px',
	fontWeight: 600,
};

export function CommunitySettingsPanel() {
	const { language } = useI18n();
	const { playSystemSound } = useSound();

	const [kulupAdi, setKulupAdi] = useState('');
	const [universite, setUniversite] = useState('');
	const [kulupDomain, setKulupDomain] = useState('');
	const [imza1Ad, setImza1Ad] = useState('');
	const [imza1Unvan, setImza1Unvan] = useState('');
	const [imza2Ad, setImza2Ad] = useState('');
	const [imza2Unvan, setImza2Unvan] = useState('');

	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
	const statusRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		statusRef.current?.scrollIntoView({ block: 'nearest' });
	}, [status]);

	useEffect(() => {
		const loadCommunitySettings = async () => {
			try {
				const res = await fetch('/api/settings/community');
				if (res.ok) {
					const data = await res.json();
					setKulupAdi(data.kulupAdi || '');
					setUniversite(data.universite || '');
					setKulupDomain(data.kulupDomain || '');
					setImza1Ad(data.imza1Ad || '');
					setImza1Unvan(data.imza1Unvan || '');
					setImza2Ad(data.imza2Ad || '');
					setImza2Unvan(data.imza2Unvan || '');
				}
			} catch (e) {
				console.error('Failed to load community settings:', e);
			} finally {
				setIsLoading(false);
			}
		};

		void loadCommunitySettings();
	}, []);

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			setIsSaving(true);
			setStatus(null);

			const res = await fetch('/api/settings/community', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kulupAdi,
					universite,
					kulupDomain,
					imza1Ad,
					imza1Unvan,
					imza2Ad,
					imza2Unvan,
				}),
			});

			const data = await res.json();
			if (res.ok && data.ok) {
				playSystemSound();
				setStatus({
					text: language === 'en' ? 'Community settings successfully saved.' : 'Topluluk ayarları başarıyla kaydedildi.',
					type: 'success',
				});
			} else {
				setStatus({
					text: data.error || (language === 'en' ? 'Failed to save settings.' : 'Ayarlar kaydedilemedi.'),
					type: 'error',
				});
			}
		} catch (err) {
			setStatus({
				text: errorMessage(err) || (language === 'en' ? 'Connection error.' : 'Bağlantı hatası.'),
				type: 'error',
			});
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
			{/* Header */}
			<div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--window-border)' }}>
				<div
					style={{
						width: '40px',
						height: '40px',
						borderRadius: '10px',
						background: 'linear-gradient(135deg, #6366f1, #4338ca)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						color: '#fff',
						flexShrink: 0,
					}}
				>
					<Building2 size={22} />
				</div>
				<div>
					<h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
						{language === 'en' ? 'Community & Studio Identity' : 'Topluluk & Stüdyo Kimliği'}
					</h2>
					<p style={{ fontSize: '13px', opacity: 0.6, margin: '2px 0 0 0' }}>
						{language === 'en'
							? 'Configure your community name, governing studio, domain, and document signatories.'
							: 'Topluluğunuzun adını, bağlı olduğu stüdyoyu, alan adını ve resmi evrak imzacılarınızı yönetin.'}
					</p>
				</div>
			</div>

			{/* Info Card */}
			<div
				style={{
					padding: '14px 16px',
					borderRadius: '10px',
					background: 'rgba(99, 102, 241, 0.08)',
					border: '1px solid rgba(99, 102, 241, 0.25)',
					display: 'flex',
					gap: '12px',
					fontSize: '12px',
					lineHeight: 1.5,
				}}
			>
				<Sparkles size={18} style={{ color: '#818cf8', flexShrink: 0, marginTop: '2px' }} />
				<div style={{ opacity: 0.9 }}>
					<strong>Orbit White-Label Architecture:</strong>{' '}
					{language === 'en'
						? 'These variables are dynamically reflected across certificates, official resolutions, authentication headers, and footer branding.'
						: 'Bu değişkenler sertifikalar, resmi yönetim kararları, kimlik doğrulama başlıkları ve alt bilgi etiketlerine anında yansıtılır.'}
				</div>
			</div>

			{/* Status Message */}
			{status && (
				<div
					ref={statusRef}
					style={{
						padding: '12px 14px',
						borderRadius: '8px',
						fontSize: '13px',
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						background: status.type === 'success' ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)',
						color: status.type === 'success' ? '#34c759' : '#ff3b30',
						border: `1px solid ${status.type === 'success' ? 'rgba(52, 199, 89, 0.3)' : 'rgba(255, 59, 48, 0.3)'}`,
					}}
				>
					{status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
					<span>{status.text}</span>
				</div>
			)}

			{isLoading ? (
				<div style={{ padding: '30px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>
					{language === 'en' ? 'Loading community configuration...' : 'Topluluk ayarları yükleniyor...'}
				</div>
			) : (
				<form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
					{/* Section 1: Core Organization Identity */}
					<div
						style={{
							padding: '16px',
							borderRadius: '10px',
							background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
							border: '1px solid var(--window-border)',
							display: 'flex',
							flexDirection: 'column',
							gap: '14px',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
							<Globe size={16} style={{ opacity: 0.7 }} />
							<span style={{ fontSize: '13px', fontWeight: 600 }}>
								{language === 'en' ? 'Core Identity & Domain' : 'Temel Kimlik ve Alan Adı'}
							</span>
						</div>

						<div>
							<label style={labelStyle}>
								{language === 'en' ? 'Community Name' : 'Topluluk Adı'}
							</label>
							<input
								type="text"
								style={inputStyle}
								value={kulupAdi}
								onChange={(e) => setKulupAdi(e.target.value)}
								placeholder="Orbit Community"
								required
								disabled={isSaving}
							/>
						</div>

						<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
							<div>
								<label style={labelStyle}>
									{language === 'en' ? 'Studio / Entity' : 'Stüdyo / Üst Kuruluş'}
								</label>
								<input
									type="text"
									style={inputStyle}
									value={universite}
									onChange={(e) => setUniversite(e.target.value)}
									placeholder="tetha42"
									required
									disabled={isSaving}
								/>
							</div>

							<div>
								<label style={labelStyle}>
									{language === 'en' ? 'Primary Domain' : 'Birincil Alan Adı'}
								</label>
								<input
									type="text"
									style={inputStyle}
									value={kulupDomain}
									onChange={(e) => setKulupDomain(e.target.value)}
									placeholder="orbit.local"
									required
									disabled={isSaving}
								/>
							</div>
						</div>
					</div>

					{/* Section 2: Official Signatories */}
					<div
						style={{
							padding: '16px',
							borderRadius: '10px',
							background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
							border: '1px solid var(--window-border)',
							display: 'flex',
							flexDirection: 'column',
							gap: '14px',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
							<Award size={16} style={{ opacity: 0.7 }} />
							<span style={{ fontSize: '13px', fontWeight: 600 }}>
								{language === 'en' ? 'Certificate & Document Signatories' : 'Certificate ve Evrak İmzacıları'}
							</span>
						</div>

						{/* Signatory 1 */}
						<div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.15)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
							<span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>
								{language === 'en' ? 'Primary Signatory (Lead / President)' : '1. İmzacı (Topluluk Lideri)'}
							</span>
							<div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
								<div>
									<label style={labelStyle}>{language === 'en' ? 'Full Name' : 'Ad Soyad'}</label>
									<input
										type="text"
										style={inputStyle}
										value={imza1Ad}
										onChange={(e) => setImza1Ad(e.target.value)}
										placeholder={language === 'en' ? 'Alex Mercer' : 'Ahmet Yılmaz'}
										disabled={isSaving}
									/>
								</div>
								<div>
									<label style={labelStyle}>{language === 'en' ? 'Title' : 'Unvan'}</label>
									<input
										type="text"
										style={inputStyle}
										value={imza1Unvan}
										onChange={(e) => setImza1Unvan(e.target.value)}
										placeholder="Topluluk Lideri"
										disabled={isSaving}
									/>
								</div>
							</div>
						</div>

						{/* Signatory 2 */}
						<div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.15)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
							<span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>
								{language === 'en' ? 'Secondary Signatory (Studio Coordinator / Advisor)' : '2. İmzacı (Stüdyo Temsilcisi / Danışman)'}
							</span>
							<div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
								<div>
									<label style={labelStyle}>{language === 'en' ? 'Full Name' : 'Ad Soyad'}</label>
									<input
										type="text"
										style={inputStyle}
										value={imza2Ad}
										onChange={(e) => setImza2Ad(e.target.value)}
										placeholder={language === 'en' ? 'Dr. Sarah Connor' : 'Mehmet Demir'}
										disabled={isSaving}
									/>
								</div>
								<div>
									<label style={labelStyle}>{language === 'en' ? 'Title' : 'Unvan'}</label>
									<input
										type="text"
										style={inputStyle}
										value={imza2Unvan}
										onChange={(e) => setImza2Unvan(e.target.value)}
										placeholder="Stüdyo Koordinatörü"
										disabled={isSaving}
									/>
								</div>
							</div>
						</div>
					</div>

					{/* Save Actions */}
					<div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
						<button
							type="submit"
							disabled={isSaving}
							style={{
								padding: '9px 24px',
								borderRadius: '8px',
								background: 'var(--accent, #6366f1)',
								color: '#fff',
								border: 'none',
								fontWeight: 600,
								fontSize: '13px',
								cursor: isSaving ? 'not-allowed' : 'pointer',
								opacity: isSaving ? 0.7 : 1,
								display: 'inline-flex',
								alignItems: 'center',
								gap: '8px',
								boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
							}}
						>
							<Shield size={15} />
							{isSaving
								? (language === 'en' ? 'Saving...' : 'Kaydediliyor...')
								: (language === 'en' ? 'Save Community Identity' : 'Topluluk Kimliğini Kaydet')}
						</button>
					</div>
				</form>
			)}
		</div>
	);
}
