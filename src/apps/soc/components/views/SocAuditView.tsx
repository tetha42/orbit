'use client';

import { useEffect, useState } from 'react';
import { AuditHistory } from '@/apps/settings/components/Roles/AuditHistory';

/**
 * Administrative change history lives in SoC Studio: it is a security/forensics
 * view, not a personal or community setting.
 */
export function SocAuditView() {
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
		<div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, padding: '4px 2px 12px' }}>
			<AuditHistory roller={roles} variant="soc" />
		</div>
	);
}
