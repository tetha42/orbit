'use client';

import React, { useState } from 'react';
import { useSession } from '@/core/session/SessionProvider';
import { useI18n } from '@/core/i18n';
import { InboxMailView } from './inbox/InboxMailView';
import { ImapMailView } from './ImapMailView';

/**
 * Mail has two mailboxes: the portal's internal messages (every member whose role opens
 * Mail) and the community e-mail account (administrators only, shown on request).
 */
export const MailApp: React.FC = () => {
	const { isAdmin } = useSession();
	const { t } = useI18n();
	const [serverView, setServerView] = useState(false);

	if (serverView && isAdmin) return <ImapMailView />;

	return (
		<div data-mail-section="portal" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
			{isAdmin && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 6,
						padding: '5px 12px',
						borderBottom: '1px solid var(--window-border)',
						fontSize: 11,
					}}
				>
					<span style={{ opacity: 0.55, fontWeight: 700, letterSpacing: '0.03em' }}>{t('mailSectionPortal')}</span>
					<button
						type="button"
						onClick={() => setServerView(true)}
						style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 11 }}
					>
						{t('mailServerView')}
					</button>
				</div>
			)}
			<div style={{ flex: 1, minHeight: 0 }}>
				<InboxMailView />
			</div>
		</div>
	);
};

export default MailApp;
