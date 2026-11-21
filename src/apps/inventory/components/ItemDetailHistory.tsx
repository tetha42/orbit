'use client';

import React from 'react';
import {
	CalendarClock,
	History,
	PackageCheck,
	PackageOpen,
	Pencil,
	PlusCircle,
	Wrench,
} from 'lucide-react';
import ui from '@/core/ui/ui.module.css';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import s from './Inventory.module.css';

export interface Movement {
	id: string;
	type: 'add' | 'loan' | 'return' | 'extend' | 'status' | 'edit';
	actorName: string | null;
	userName: string | null;
	description: string | null;
	date: number;
}

const EVENT_ICONS: Record<Movement['type'], typeof History> = {
	add: PlusCircle,
	loan: PackageOpen,
	return: PackageCheck,
	extend: CalendarClock,
	status: Wrench,
	edit: Pencil,
};

interface ItemDetailHistoryProps {
	itemCode: string;
	history: { movements: Movement[] } | null;
}

export function ItemDetailHistory({ itemCode, history }: ItemDetailHistoryProps) {
	const { t, language } = useI18n();

	const getEventLabel = (h: Movement) => {
		switch (h.type) {
			case 'add':
				return fill(t('invItemAdded'), { code: itemCode });
			case 'loan':
				return fill(t('invActionLoan'), { name: h.userName ?? t('invMemberFallback') });
			case 'return':
				return fill(t('invActionReturned'), { name: h.userName ?? t('invBorrowerFallback') });
			case 'extend':
				return t('invActionExtend');
			case 'status':
				return t('invActionStatus');
			case 'edit':
			default:
				return t('invActionEdit');
		}
	};

	return (
		<section aria-label={t('invHistoryTitle')}>
			<h4 className={ui.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
				<History size={14} /> {t('invHistoryTitle')}
			</h4>
			{!history && <div className={ui.muted}>{t('loading')}</div>}
			{history && history.movements.length === 0 && (
				<div className={ui.muted}>{t('invNoHistory')}</div>
			)}
			<ol className={s.timeline}>
				{history?.movements.map((h) => {
					const Icon = EVENT_ICONS[h.type] ?? Pencil;
					return (
						<li key={h.id} className={s.event}>
							<span className={s.eventIcon}>
								<Icon size={13} />
							</span>
							<div>
								<div className={s.eventTitle}>{getEventLabel(h)}</div>
								{h.description && <div>{h.description}</div>}
								<div className={s.eventMeta}>
									{new Date(h.date).toLocaleString(language, {
										day: '2-digit',
										month: '2-digit',
										year: 'numeric',
										hour: '2-digit',
										minute: '2-digit',
									})}
									{h.actorName ? ` · ${h.actorName}` : ''}
								</div>
							</div>
						</li>
					);
				})}
			</ol>
		</section>
	);
}
