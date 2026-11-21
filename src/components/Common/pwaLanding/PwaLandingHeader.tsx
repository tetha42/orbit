'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { LOCALE_REGISTRY, useI18n } from '@/core/i18n';
import { ALLOW_BROWSER_LOGIN, enableDevBypass } from '@/lib/client/pwa';

export function PwaLandingHeader() {
	const { language, setLanguage, t } = useI18n();

	return (
		<header
			style={{
				position: 'relative',
				zIndex: 20,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				padding: '20px 32px',
				maxWidth: '1120px',
				width: '100%',
				margin: '0 auto',
				borderBottom: '1px solid #18181b',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src="/assets/img/logo-orbit.svg"
					alt="Orbit Community OS"
					style={{ width: '28px', height: '28px' }}
				/>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<span
						style={{
							fontSize: '13px',
							fontWeight: 700,
							letterSpacing: '0.04em',
							lineHeight: 1.1,
							color: '#fafafa',
						}}
					>
						ORBIT COMMUNITY OS
					</span>
					<span
						style={{
							fontSize: '10px',
							color: '#a1a1aa',
							letterSpacing: '0.1em',
							fontFamily: 'var(--font-mono)',
						}}
					>
						BY TETHA42
					</span>
				</div>
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						backgroundColor: '#111113',
						borderRadius: '6px',
						padding: '2px',
						border: '1px solid #27272a',
					}}
				>
					{LOCALE_REGISTRY.map((loc) => {
						const active = language === loc.code;
						return (
							<button
								key={loc.code}
								type="button"
								onClick={() => setLanguage(loc.code as typeof language)}
								style={{
									padding: '4px 10px',
									borderRadius: '4px',
									border: 'none',
									backgroundColor: active ? '#fafafa' : 'transparent',
									color: active ? '#09090b' : '#a1a1aa',
									fontSize: '11px',
									fontWeight: 600,
									cursor: 'pointer',
								}}
							>
								{loc.code.toUpperCase()}
							</button>
						);
					})}
				</div>

				{ALLOW_BROWSER_LOGIN && (
					<button
						type="button"
						onClick={enableDevBypass}
						title={t('pwaDevBypassBtn')}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '6px',
							padding: '6px 12px',
							borderRadius: '6px',
							border: '1px solid #27272a',
							backgroundColor: '#18181b',
							color: '#fafafa',
							fontSize: '12px',
							fontWeight: 500,
							cursor: 'pointer',
						}}
					>
						<Globe size={13} />
						<span>{t('pwaDevBypassBtn')}</span>
					</button>
				)}
			</div>
		</header>
	);
}
