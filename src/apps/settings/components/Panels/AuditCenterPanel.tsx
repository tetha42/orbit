'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { AuditHistory } from '../Roles/AuditHistory';

export function AuditCenterPanel() {
	const { t } = useI18n();
	const [roles, setRoles] = useState<{ id: string; ad: string }[]>([]);

	useEffect(() => {
		let cancelled = false;
		fetch('/api/roles', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((payload) => {
				if (!cancelled && Array.isArray(payload?.roller)) setRoles(payload.roller);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div data-focus-section="audit" style={{ display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 }}>
			<div>
				<h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
					<History size={18} style={{ opacity: 0.7 }} />
					{t('auditCenterTitle')}
				</h2>
				<p style={{ margin: '3px 0 0', fontSize: '12.5px', opacity: 0.65 }}>{t('auditCenterDesc')}</p>
			</div>
			<AuditHistory roller={roles} />
		</div>
	);
}
