'use client';

import React from 'react';
import { Info, ShieldAlert } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useIsMobile } from '@/lib/client/useClientValue';
import { useBudget } from './hooks/useBudget';
import { BudgetSidebar } from './components/BudgetSidebar';
import { KasaPanel } from './components/KasaPanel';
import { BudgetMobileView } from './components/BudgetMobileView';

const shellStyle: React.CSSProperties = {
	height: '100%',
	background: 'var(--window-bg)',
	color: 'var(--text-primary)',
	fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
};

function Locked({ title, body, note }: { title: string; body: string; note?: string }) {
	return (
		<div style={{ ...shellStyle, display: 'grid', placeItems: 'center', padding: '40px', textAlign: 'center' }}>
			<div
				style={{
					maxWidth: '460px',
					background: 'rgba(255, 59, 48, 0.08)',
					border: '1px solid rgba(255, 59, 48, 0.25)',
					borderRadius: '16px',
					padding: '32px 24px',
				}}
			>
				<ShieldAlert size={48} color="#ff453a" style={{ marginBottom: '14px' }} />
				<h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 10px 0' }}>{title}</h3>
				<p style={{ fontSize: '13.5px', opacity: 0.75, lineHeight: 1.5, margin: note ? '0 0 20px 0' : 0 }}>
					{body}
				</p>
				{note && (
					<div
						style={{
							fontSize: '12px',
							background: 'rgba(255, 255, 255, 0.06)',
							padding: '8px 12px',
							borderRadius: '8px',
							opacity: 0.85,
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							textAlign: 'left',
						}}
					>
						<Info size={15} color="#ff9500" style={{ flexShrink: 0 }} />
						<span>{note}</span>
					</div>
				)}
			</div>
		</div>
	);
}

/**
 * The Kasa app: the general kasa and every project's kasa, side by side.
 * Modular entry component (<90 lines).
 */
export function BudgetApp() {
	const { t } = useI18n();
	const isMobile = useIsMobile();
	const {
		allowed,
		httpStatus,
		kasalar,
		active,
		general,
		projects,
		selected,
		setSelected,
		refetch,
	} = useBudget();

	if (!allowed || httpStatus === 403) {
		return (
			<Locked
				title={t('kasaLockedTitle')}
				body={t('kasaLockedBody')}
				note={t('kasaLockedNote')}
			/>
		);
	}

	if (isMobile) {
		return (
			<BudgetMobileView
				kasalar={kasalar}
				active={active}
				general={general}
				projects={projects}
				selected={selected}
				onSelect={setSelected}
				refetch={refetch}
			/>
		);
	}

	return (
		<div className="kasa-app" style={shellStyle}>
			<div className="kasa-shell">
				<BudgetSidebar
					kasalar={kasalar}
					active={active}
					general={general}
					projects={projects}
					onSelect={setSelected}
				/>

				<div className="kasa-main">
					{active && (
						<>
							<div style={{ padding: '18px 24px 0', fontSize: '17px', fontWeight: 750 }}>
								{active.ad}
							</div>
							<KasaPanel
								key={active.teamId ?? 'genel'}
								teamId={active.teamId}
								onChanged={refetch}
								kasalar={kasalar}
							/>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
