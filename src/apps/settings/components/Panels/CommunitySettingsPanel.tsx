'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
	AlertCircle,
	Award,
	Building2,
	CheckCircle2,
	Globe,
	Image as ImageIcon,
	Lock,
	Shield,
	Sparkles,
	Trash2,
	Upload,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useIdentity } from '@/core/identity';
import { useSound } from '@/core/sound';
import { errorMessage } from '@/lib/errors';
import {
	ARCHETYPE_PRESETS,
	DEFAULT_ARCHETYPE,
	ORGANIZATION_ARCHETYPES,
	isOrganizationArchetype,
	type OrganizationArchetype,
} from '@/lib/archetypes';

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

const cardStyle: React.CSSProperties = {
	padding: '16px',
	borderRadius: '10px',
	background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
	border: '1px solid var(--window-border)',
	display: 'flex',
	flexDirection: 'column',
	gap: '14px',
};

const sectionTitleStyle: React.CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: '8px',
	fontSize: '13px',
	fontWeight: 600,
};

export function CommunitySettingsPanel() {
	const { t, language } = useI18n();
	const { identity, refreshIdentity } = useIdentity();
	const { playSystemSound } = useSound();

	const [siteName, setSiteName] = useState('');
	const [shortName, setShortName] = useState('');
	const [descriptionTr, setDescriptionTr] = useState('');
	const [descriptionEn, setDescriptionEn] = useState('');
	const [domain, setDomain] = useState('');
	const [archetype, setArchetype] = useState<OrganizationArchetype>(DEFAULT_ARCHETYPE);
	const [signature1Name, setSignature1Name] = useState('');
	const [signature1Rank, setSignature1Rank] = useState('');
	const [signature2Name, setSignature2Name] = useState('');
	const [signature2Rank, setSignature2Rank] = useState('');
	const [iconUrl, setIconUrl] = useState<string | null>(identity.iconUrl);
	const [iconBusy, setIconBusy] = useState(false);
	const iconInputRef = useRef<HTMLInputElement>(null);

	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
	const statusRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		statusRef.current?.scrollIntoView({ block: 'nearest' });
	}, [status]);

	useEffect(() => {
		let cancelled = false;
		Promise.all([
			fetch('/api/settings/identity', { cache: 'no-store' }).then((res) =>
				res.ok ? res.json() : null
			),
			fetch('/api/settings/community', { cache: 'no-store' }).then((res) =>
				res.ok ? res.json() : null
			),
		])
			.then(([identityData, communityData]) => {
				if (cancelled) return;
				const site = identityData?.identity;
				if (site) {
					setSiteName(site.siteName || '');
					setShortName(site.siteShortName || '');
					setDescriptionTr(site.descriptionTr || '');
					setDescriptionEn(site.descriptionEn || '');
					setIconUrl(site.iconUrl || null);
				}
				if (communityData) {
					setDomain(communityData.clubDomain || '');
					if (isOrganizationArchetype(communityData.archetype)) {
						setArchetype(communityData.archetype);
					}
					setSignature1Name(communityData.signature1Name || '');
					setSignature1Rank(communityData.signature1Rank || '');
					setSignature2Name(communityData.signature2Name || '');
					setSignature2Rank(communityData.signature2Rank || '');
				}
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const uploadIcon = async (file: File) => {
		setIconBusy(true);
		setStatus(null);
		try {
			const formData = new FormData();
			formData.set('file', file);
			const res = await fetch('/api/settings/identity/icon', {
				method: 'POST',
				body: formData,
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || t('identityIconUploadFailed'));
			setIconUrl(data.iconUrl);
			await refreshIdentity();
			playSystemSound();
			setStatus({ text: t('identityIconSaved'), type: 'success' });
		} catch (error) {
			setStatus({ text: errorMessage(error) || t('identityIconUploadFailed'), type: 'error' });
		} finally {
			setIconBusy(false);
			if (iconInputRef.current) iconInputRef.current.value = '';
		}
	};

	const removeIcon = async () => {
		setIconBusy(true);
		try {
			const res = await fetch('/api/settings/identity/icon', { method: 'DELETE' });
			if (!res.ok) throw new Error(t('identityIconRemoveFailed'));
			setIconUrl(null);
			await refreshIdentity();
			playSystemSound();
			setStatus({ text: t('identityIconRemoved'), type: 'success' });
		} catch (error) {
			setStatus({ text: errorMessage(error) || t('identityIconRemoveFailed'), type: 'error' });
		} finally {
			setIconBusy(false);
		}
	};

	const handleSave = async (event: React.FormEvent) => {
		event.preventDefault();
		setIsSaving(true);
		setStatus(null);
		try {
			const identityRes = await fetch('/api/settings/identity', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ siteName, shortName, descriptionTr, descriptionEn }),
			});
			const identityData = await identityRes.json();
			if (!identityRes.ok) throw new Error(identityData.error || t('identitySaveFailed'));

			const communityRes = await fetch('/api/settings/community', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					clubDomain: domain,
					archetype,
					signature1Name,
					signature1Rank,
					signature2Name,
					signature2Rank,
				}),
			});
			const communityData = await communityRes.json();
			if (!communityRes.ok) throw new Error(communityData.error || t('identitySaveFailed'));

			await refreshIdentity();
			playSystemSound();
			setStatus({ text: t('identitySaveSuccess'), type: 'success' });
		} catch (error) {
			setStatus({ text: errorMessage(error) || t('identitySaveFailed'), type: 'error' });
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '12px',
					paddingBottom: '16px',
					borderBottom: '1px solid var(--window-border)',
				}}
			>
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
					<h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{t('identityTitle')}</h2>
					<p style={{ fontSize: '13px', opacity: 0.6, margin: '2px 0 0 0' }}>{t('identityDesc')}</p>
				</div>
			</div>

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
				<div style={{ opacity: 0.9 }}>{t('identityInfo')}</div>
			</div>

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
						background:
							status.type === 'success'
								? 'rgba(52, 199, 89, 0.15)'
								: 'rgba(255, 59, 48, 0.15)',
						color: status.type === 'success' ? '#34c759' : '#ff3b30',
						border: `1px solid ${
							status.type === 'success'
								? 'rgba(52, 199, 89, 0.3)'
								: 'rgba(255, 59, 48, 0.3)'
						}`,
					}}
				>
					{status.type === 'success' ? (
						<CheckCircle2 size={16} />
					) : (
						<AlertCircle size={16} />
					)}
					<span>{status.text}</span>
				</div>
			)}

			{isLoading ? (
				<div style={{ padding: '30px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>
					{t('loading')}
				</div>
			) : (
				<form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
					<div style={cardStyle}>
						<div style={sectionTitleStyle}>
							<ImageIcon size={16} style={{ opacity: 0.7 }} />
							<span>{t('identityBrandingSection')}</span>
						</div>

						<div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
							<div
								style={{
									width: '64px',
									height: '64px',
									borderRadius: '16px',
									border: '1px solid var(--window-border)',
									background: 'var(--fill-soft)',
									display: 'grid',
									placeItems: 'center',
									overflow: 'hidden',
									flexShrink: 0,
								}}
							>
								{iconUrl ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={iconUrl}
										alt={siteName}
										style={{ width: '100%', height: '100%', objectFit: 'cover' }}
									/>
								) : (
									<ImageIcon size={24} style={{ opacity: 0.45 }} />
								)}
							</div>
							<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
								<input
									ref={iconInputRef}
									type="file"
									accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
									hidden
									onChange={(event) => {
										const file = event.target.files?.[0];
										if (file) void uploadIcon(file);
									}}
								/>
								<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
									<button
										type="button"
										onClick={() => iconInputRef.current?.click()}
										disabled={iconBusy || isSaving}
										style={{
											display: 'inline-flex',
											alignItems: 'center',
											gap: '6px',
											padding: '7px 12px',
											borderRadius: '8px',
											border: '1px solid var(--window-border)',
											background: 'var(--fill-soft)',
											color: 'inherit',
											fontSize: '12px',
											fontWeight: 600,
											cursor: iconBusy ? 'wait' : 'pointer',
										}}
									>
										<Upload size={13} />
										{t('identityIconUpload')}
									</button>
									{iconUrl && (
										<button
											type="button"
											onClick={() => void removeIcon()}
											disabled={iconBusy || isSaving}
											style={{
												display: 'inline-flex',
												alignItems: 'center',
												gap: '6px',
												padding: '7px 12px',
												borderRadius: '8px',
												border: '1px solid rgba(239, 68, 68, 0.3)',
												background: 'rgba(239, 68, 68, 0.08)',
												color: '#f87171',
												fontSize: '12px',
												fontWeight: 600,
												cursor: iconBusy ? 'wait' : 'pointer',
											}}
										>
											<Trash2 size={13} />
											{t('identityIconRemove')}
										</button>
									)}
								</div>
								<div style={{ fontSize: '11px', opacity: 0.55 }}>{t('identityIconHint')}</div>
								<div style={{ fontSize: '10.5px', lineHeight: 1.5, opacity: 0.55 }}>{t('identityIconPwaHint')}</div>
							</div>
						</div>

						<div>
							<label style={labelStyle}>{t('identitySiteName')}</label>
							<input
								type="text"
								style={inputStyle}
								value={siteName}
								onChange={(event) => setSiteName(event.target.value)}
								placeholder="Orbit Community"
								required
								maxLength={120}
								disabled={isSaving}
							/>
						</div>

						<div>
							<label style={labelStyle}>{t('identityShortName')}</label>
							<input
								type="text"
								style={inputStyle}
								value={shortName}
								onChange={(event) => setShortName(event.target.value)}
								placeholder="Orbit"
								maxLength={32}
								disabled={isSaving}
							/>
						</div>

						<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
							<div>
								<label style={labelStyle}>{t('identityDescriptionTr')}</label>
								<textarea
									style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }}
									value={descriptionTr}
									onChange={(event) => setDescriptionTr(event.target.value)}
									maxLength={400}
									disabled={isSaving}
								/>
							</div>
							<div>
								<label style={labelStyle}>{t('identityDescriptionEn')}</label>
								<textarea
									style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }}
									value={descriptionEn}
									onChange={(event) => setDescriptionEn(event.target.value)}
									maxLength={400}
									disabled={isSaving}
								/>
							</div>
						</div>

						<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
							<div>
								<label style={labelStyle}>
									<span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
										<Lock size={11} /> {t('identityStudio')}
									</span>
								</label>
								<input
									type="text"
									style={{ ...inputStyle, opacity: 0.7 }}
									value="tetha42"
									readOnly
									disabled
								/>
							</div>
							<div>
								<label style={labelStyle}>
									<span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
										<Lock size={11} /> {t('identityAppName')}
									</span>
								</label>
								<input
									type="text"
									style={{ ...inputStyle, opacity: 0.7 }}
									value={identity.appName}
									readOnly
									disabled
								/>
							</div>
						</div>
						<div
							style={{
								fontSize: '11px',
								opacity: 0.55,
								display: 'flex',
								alignItems: 'center',
								gap: '6px',
							}}
						>
							<Lock size={11} />
							{t('identityImmutableHint')}
						</div>
					</div>

					<div style={cardStyle}>
						<div style={sectionTitleStyle}>
							<Building2 size={16} style={{ opacity: 0.7 }} />
							<span>{t('organizationArchetypeTitle', 'Organization Archetype')}</span>
						</div>
						<div style={{ fontSize: '12px', opacity: 0.7, lineHeight: 1.5 }}>
							{t(
								'organizationArchetypeDesc',
								'Defines the structural vocabulary of your workspace across member tracks, seniority tiers, working-group categories, and governance records.'
							)}
						</div>
						<div
							style={{
								display: 'grid',
								gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
								gap: '10px',
							}}
						>
							{ORGANIZATION_ARCHETYPES.map((archId) => {
								const preset = ARCHETYPE_PRESETS[archId];
								const isSelected = archetype === archId;
								const localizedName = preset.name[language] ?? preset.name.en;
								const localizedDesc = preset.description[language] ?? preset.description.en;
								const localizedUnit = preset.unitLabel[language] ?? preset.unitLabel.en;
								const localizedTrack = preset.trackLabel[language] ?? preset.trackLabel.en;

								return (
									<button
										key={archId}
										type="button"
										disabled={isSaving}
										onClick={() => setArchetype(archId)}
										style={{
											textAlign: 'left',
											padding: '12px 14px',
											borderRadius: '10px',
											border: isSelected
												? '1px solid var(--accent, #6366f1)'
												: '1px solid var(--window-border)',
											background: isSelected
												? 'rgba(99, 102, 241, 0.14)'
												: 'rgba(0, 0, 0, 0.18)',
											color: 'inherit',
											cursor: isSaving ? 'not-allowed' : 'pointer',
											display: 'flex',
											flexDirection: 'column',
											gap: '6px',
											transition: 'border-color 0.15s ease, background 0.15s ease',
										}}
									>
										<div
											style={{
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'space-between',
												gap: '8px',
											}}
										>
											<span style={{ fontSize: '12.5px', fontWeight: 600 }}>
												{localizedName}
											</span>
											{isSelected && (
												<CheckCircle2
													size={15}
													style={{ color: '#818cf8', flexShrink: 0 }}
												/>
											)}
										</div>
										<span style={{ fontSize: '11.5px', opacity: 0.72, lineHeight: 1.45 }}>
											{localizedDesc}
										</span>
										<div
											style={{
												display: 'flex',
												flexWrap: 'wrap',
												gap: '4px',
												marginTop: '2px',
												fontSize: '10.5px',
												opacity: 0.85,
												color: '#a5b4fc',
											}}
										>
											<span>{localizedUnit}</span>
											<span>·</span>
											<span>{localizedTrack}</span>
										</div>
									</button>
								);
							})}
						</div>
					</div>

					<div style={cardStyle}>
						<div style={sectionTitleStyle}>
							<Globe size={16} style={{ opacity: 0.7 }} />
							<span>{t('identityDomainSection')}</span>
						</div>

						<div>
							<label style={labelStyle}>{t('identityDomain')}</label>
							<input
								type="text"
								style={inputStyle}
								value={domain}
								onChange={(event) => setDomain(event.target.value)}
								placeholder="orbit.local"
								required
								disabled={isSaving}
							/>
						</div>

						<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
							<Award size={15} style={{ opacity: 0.6 }} />
							<span style={{ fontSize: '12.5px', fontWeight: 600 }}>
								{t('identitySignatories')}
							</span>
						</div>

						<div
							style={{
								padding: '12px',
								borderRadius: '8px',
								background: 'rgba(0, 0, 0, 0.15)',
								display: 'flex',
								flexDirection: 'column',
								gap: '10px',
							}}
						>
							<div
								style={{
									fontSize: '11px',
									fontWeight: 700,
									textTransform: 'uppercase',
									opacity: 0.6,
								}}
							>
								{t('identitySignatoryPrimary')}
							</div>
							<div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
								<div>
									<label style={labelStyle}>{t('identityFullName')}</label>
									<input
										type="text"
										style={inputStyle}
										value={signature1Name}
										onChange={(event) => setSignature1Name(event.target.value)}
										disabled={isSaving}
									/>
								</div>
								<div>
									<label style={labelStyle}>{t('identityTitleLabel')}</label>
									<input
										type="text"
										style={inputStyle}
										value={signature1Rank}
										onChange={(event) => setSignature1Rank(event.target.value)}
										disabled={isSaving}
									/>
								</div>
							</div>
						</div>

						<div
							style={{
								padding: '12px',
								borderRadius: '8px',
								background: 'rgba(0, 0, 0, 0.15)',
								display: 'flex',
								flexDirection: 'column',
								gap: '10px',
							}}
						>
							<div
								style={{
									fontSize: '11px',
									fontWeight: 700,
									textTransform: 'uppercase',
									opacity: 0.6,
								}}
							>
								{t('identitySignatorySecondary')}
							</div>
							<div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
								<div>
									<label style={labelStyle}>{t('identityFullName')}</label>
									<input
										type="text"
										style={inputStyle}
										value={signature2Name}
										onChange={(event) => setSignature2Name(event.target.value)}
										disabled={isSaving}
									/>
								</div>
								<div>
									<label style={labelStyle}>{t('identityTitleLabel')}</label>
									<input
										type="text"
										style={inputStyle}
										value={signature2Rank}
										onChange={(event) => setSignature2Rank(event.target.value)}
										disabled={isSaving}
									/>
								</div>
							</div>
						</div>
					</div>

					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'flex-end',
							gap: '12px',
							paddingTop: '4px',
						}}
					>
						<span style={{ fontSize: '11px', opacity: 0.5, marginRight: 'auto' }}>
							{t('identityChangesImmediateHint', 'Changes apply across all pages immediately.')}
						</span>
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
							{isSaving ? t('saving') : t('identitySave')}
						</button>
					</div>
				</form>
			)}
		</div>
	);
}
