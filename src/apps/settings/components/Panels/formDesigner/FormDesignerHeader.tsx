'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Eye, Layers, Plus, Settings2, Sliders } from 'lucide-react';
import { RegistrationCoreFieldsPanel } from '../RegistrationCoreFieldsPanel';

interface FormDesignerHeaderProps {
	isCoreExpanded: boolean;
	setIsCoreExpanded: React.Dispatch<React.SetStateAction<boolean>>;
	status: { type: 'ok' | 'err'; text: string } | null;
	isMobile: boolean;
	mobileTab: 'fields' | 'edit' | 'preview';
	setMobileTab: (tab: 'fields' | 'edit' | 'preview') => void;
	startNew: () => void;
	t: (key: string, fallback?: string) => string;
}

export function FormDesignerHeader({
	isCoreExpanded,
	setIsCoreExpanded,
	status,
	isMobile,
	mobileTab,
	setMobileTab,
	startNew,
	t,
}: FormDesignerHeaderProps) {
	return (
		<>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
				<div>
					<h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
						<Layers size={18} style={{ color: 'var(--accent)' }} />
						{t('formTitle')}
					</h2>
					<p style={{ margin: '4px 0 0 0', fontSize: '12.5px', opacity: 0.65 }}>{t('formDesc')}</p>
				</div>
				<button
					type="button"
					onClick={startNew}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						padding: '8px 14px',
						borderRadius: '8px',
						border: '1px solid var(--accent)',
						background: 'var(--accent)',
						color: '#fff',
						fontSize: '12px',
						fontWeight: 600,
						cursor: 'pointer',
						boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
					}}
				>
					<Plus size={14} />
					{t('formAdd')}
				</button>
			</div>

			<div style={{ borderRadius: '10px', border: '1px solid var(--window-border)', background: 'var(--card-bg, rgba(255,255,255,0.03))', overflow: 'hidden' }}>
				<button
					type="button"
					onClick={() => setIsCoreExpanded((prev) => !prev)}
					style={{
						width: '100%',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '11px 14px',
						border: 'none',
						background: 'transparent',
						color: 'inherit',
						cursor: 'pointer',
						fontSize: '12.5px',
						fontWeight: 600,
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<Settings2 size={15} style={{ opacity: 0.7 }} />
						<span>{t('formSectionCore')}</span>
						<span style={{ fontSize: '10.5px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', opacity: 0.7 }}>
							{t('formSectionCoreSummary')}
						</span>
					</div>
					{isCoreExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
				</button>
				{isCoreExpanded && (
					<div style={{ padding: '14px', borderTop: '1px solid var(--window-border)', background: 'rgba(0,0,0,0.12)' }}>
						<RegistrationCoreFieldsPanel />
					</div>
				)}
			</div>

			{status && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						padding: '10px 14px',
						borderRadius: '8px',
						fontSize: '12px',
						background: status.type === 'ok' ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'color-mix(in srgb, var(--danger) 12%, transparent)',
						color: status.type === 'ok' ? 'var(--success)' : 'var(--danger)',
						border: `1px solid ${status.type === 'ok' ? 'color-mix(in srgb, var(--success) 30%, transparent)' : 'color-mix(in srgb, var(--danger) 30%, transparent)'}`,
					}}
				>
					{status.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
					<span>{status.text}</span>
				</div>
			)}

			{isMobile && (
				<div
					style={{
						display: 'flex',
						background: 'var(--fill-soft, rgba(255,255,255,0.06))',
						borderRadius: '10px',
						padding: '4px',
						gap: '4px',
						marginBottom: '14px',
						border: '1px solid var(--window-border)',
					}}
				>
					{(
						[
							['fields', Layers, t('formTabFields')],
							['edit', Sliders, t('formTabEdit')],
							['preview', Eye, t('formTabPreview')],
						] as const
					).map(([tabId, Icon, label]) => (
						<button
							key={tabId}
							type="button"
							onClick={() => setMobileTab(tabId)}
							style={{
								flex: 1,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								gap: '6px',
								padding: '8px 12px',
								borderRadius: '7px',
								border: 'none',
								fontSize: '12.5px',
								fontWeight: mobileTab === tabId ? 650 : 500,
								background: mobileTab === tabId ? 'var(--card-bg, #222)' : 'transparent',
								color: mobileTab === tabId ? 'var(--text-primary)' : 'var(--text-secondary)',
								boxShadow: mobileTab === tabId ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
								cursor: 'pointer',
								minHeight: '38px',
							}}
						>
							<Icon size={14} />
							<span>{label}</span>
						</button>
					))}
				</div>
			)}
		</>
	);
}
