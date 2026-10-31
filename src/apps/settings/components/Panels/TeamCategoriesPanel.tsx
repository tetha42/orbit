'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Plus, Save, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { errorMessage } from '@/lib/errors';

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 11px',
	borderRadius: '8px',
	border: '1px solid var(--window-border)',
	background: 'rgba(0, 0, 0, 0.22)',
	color: 'inherit',
	fontSize: '12.5px',
	outline: 'none',
	boxSizing: 'border-box',
};

const cardStyle: React.CSSProperties = {
	padding: '16px',
	borderRadius: '10px',
	border: '1px solid var(--window-border)',
	background: 'var(--card-bg, rgba(255,255,255,0.03))',
};

export function TeamCategoriesPanel() {
	const { t } = useI18n();
	const [categories, setCategories] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch('/api/settings/team-categories', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (cancelled || !Array.isArray(data?.categories)) return;
				setCategories(data.categories);
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const updateCategory = (index: number, value: string) => {
		setCategories((previous) =>
			previous.map((category, categoryIndex) => (categoryIndex === index ? value : category))
		);
	};

	const addCategory = () => {
		setCategories((previous) => [...previous, '']);
	};

	const removeCategory = (index: number) => {
		setCategories((previous) => previous.filter((_, categoryIndex) => categoryIndex !== index));
	};

	const save = async () => {
		setStatus(null);
		const cleaned = categories.map((category) => category.trim()).filter(Boolean);
		if (cleaned.length === 0) {
			setStatus({ text: t('teamsCategoryEmptyError'), type: 'err' });
			return;
		}
		const seen = new Set<string>();
		for (const category of cleaned) {
			const key = category.toLocaleLowerCase('tr');
			if (seen.has(key)) {
				setStatus({ text: t('teamsCategoryDuplicateError'), type: 'err' });
				return;
			}
			seen.add(key);
		}
		setIsSaving(true);
		try {
			const res = await fetch('/api/settings/team-categories', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ categories: cleaned }),
			});
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('teamsCategorySaveFailed'));
			setCategories(data.categories);
			window.dispatchEvent(new Event('orbit:team-categories-updated'));
			setStatus({ text: t('teamsCategorySaved'), type: 'ok' });
		} catch (error) {
			setStatus({ text: errorMessage(error) || t('teamsCategorySaveFailed'), type: 'err' });
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={cardStyle}>
				<div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
					<Info size={16} style={{ marginTop: '2px', opacity: 0.65, flexShrink: 0 }} />
					<div>
						<h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{t('teamsCategoriesTitle')}</h3>
						<p style={{ margin: '3px 0 0', fontSize: '11.5px', lineHeight: 1.5, opacity: 0.6 }}>
							{t('teamsCategoriesDesc')}
						</p>
					</div>
				</div>

				{status && (
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '7px',
							padding: '8px 10px',
							borderRadius: '8px',
							marginBottom: '12px',
							fontSize: '11.5px',
							background: status.type === 'ok' ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
							color: status.type === 'ok' ? '#30d158' : '#ff453a',
							border: `1px solid ${status.type === 'ok' ? 'rgba(48,209,88,0.3)' : 'rgba(255,69,58,0.3)'}`,
						}}
					>
						{status.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
						{status.text}
					</div>
				)}

				{isLoading ? (
					<div style={{ padding: '18px', textAlign: 'center', opacity: 0.55 }}>{t('loading')}</div>
				) : (
					<>
						<div
							style={{
								display: 'grid',
								gridTemplateColumns: '1fr auto',
								gap: '8px',
								padding: '0 2px',
								marginBottom: '5px',
								fontSize: '9.5px',
								fontWeight: 700,
								letterSpacing: '0.045em',
								textTransform: 'uppercase',
								opacity: 0.48,
							}}
						>
							<span>{t('teamsCategoryValue')}</span>
							<span />
						</div>
						<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
							{categories.map((category, index) => (
								<div
									key={index}
									style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px', alignItems: 'center' }}
								>
									<input
										style={inputStyle}
										value={category}
										maxLength={60}
										aria-label={`${t('teamsCategoryValue')} ${index + 1}`}
										placeholder={t('teamsCategoryValue')}
										onChange={(event) => updateCategory(index, event.target.value)}
									/>
									<button
										type="button"
										onClick={() => removeCategory(index)}
										disabled={categories.length <= 1}
										title={t('delete')}
										style={{
											width: '27px',
											height: '27px',
											borderRadius: '6px',
											border: '1px solid rgba(239,68,68,0.3)',
											background: 'rgba(239,68,68,0.08)',
											color: '#f87171',
											display: 'grid',
											placeItems: 'center',
											cursor: categories.length <= 1 ? 'not-allowed' : 'pointer',
											opacity: categories.length <= 1 ? 0.4 : 1,
										}}
									>
										<Trash2 size={12} />
									</button>
								</div>
							))}
						</div>

						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '12px' }}>
							<button
								type="button"
								onClick={addCategory}
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '5px',
									padding: '6px 10px',
									borderRadius: '7px',
									border: '1px solid var(--window-border)',
									background: 'var(--fill-soft)',
									color: 'inherit',
									fontSize: '11px',
									fontWeight: 600,
									cursor: 'pointer',
								}}
							>
								<Plus size={11} />
								{t('teamsCategoryAdd')}
							</button>
							<button
								type="button"
								onClick={() => void save()}
								disabled={isSaving}
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '6px',
									padding: '8px 16px',
									borderRadius: '8px',
									border: 'none',
									background: 'var(--accent)',
									color: '#fff',
									fontSize: '12px',
									fontWeight: 600,
									cursor: isSaving ? 'wait' : 'pointer',
									opacity: isSaving ? 0.7 : 1,
								}}
							>
								<Save size={13} />
								{isSaving ? t('saving') : t('teamsCategorySave')}
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
