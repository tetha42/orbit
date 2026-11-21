'use client';

import { useI18n } from '@/core/i18n';
import { ModernAppIcon } from '@/components/Common/ModernAppIcon';
import { prefetchApp } from '@/core/apps/registry';
import type { AppID } from '@/types/workspace';

interface MobileAppsGridProps {
	appKeys: AppID[];
	onOpenApp: (appId: AppID) => void;
}

export function MobileAppsGrid({ appKeys, onOpenApp }: MobileAppsGridProps) {
	const { t, getAppMeta } = useI18n();

	return (
		<>
			<div style={{ textAlign: 'center' }}>
				<h1 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>
					Orbit Community OS
				</h1>
				<p style={{ margin: 0, fontSize: '12.5px', opacity: 0.65 }}>{t('mobAppsHint')}</p>
			</div>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))',
					gap: '12px',
				}}
			>
				{appKeys.map((appId) => {
					const meta = getAppMeta(appId);

					return (
						<button
							key={appId}
							data-launcher-app={appId}
							onClick={() => onOpenApp(appId)}
							onTouchStart={() => prefetchApp(appId)}
							onPointerEnter={() => prefetchApp(appId)}
							style={{
								background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))',
								border: '1px solid rgba(255, 255, 255, 0.1)',
								borderRadius: '20px',
								padding: '20px 14px',
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
								gap: '12px',
								color: '#fff',
								cursor: 'pointer',
								boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
								position: 'relative',
								textAlign: 'center',
								touchAction: 'manipulation',
								WebkitTapHighlightColor: 'transparent',
								transition: 'transform 100ms ease, background 120ms ease',
							}}
						>
							<div
								style={{
									width: '56px',
									height: '56px',
									position: 'relative',
									display: 'grid',
									placeItems: 'center',
								}}
							>
								<ModernAppIcon appId={appId} size={56} />
							</div>

							<div>
								<div style={{ fontSize: '14px', fontWeight: 700 }}>{meta.shortTitle}</div>
							</div>
						</button>
					);
				})}
			</div>
		</>
	);
}
