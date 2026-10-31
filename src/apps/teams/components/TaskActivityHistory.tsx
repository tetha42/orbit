'use client';

import React from 'react';
import { Activity } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { columnMeta, type TaskStatus } from '../types';
import type { TeamTaskActivity } from '@/db/schema';
import styles from './Kanban.module.css';
import ui from '@/core/ui/ui.module.css';

interface TaskActivityHistoryProps {
	aktivite: TeamTaskActivity[];
	members: { id: string; name: string }[];
	when: (ts: number) => string;
}

export function TaskActivityHistory({ aktivite, members, when }: TaskActivityHistoryProps) {
	const { t } = useI18n();

	if (!aktivite.length) return null;

	const memberName = (id: unknown) =>
		(typeof id === 'string' && members.find((m) => m.id === id)?.name) || t('kbSomeone');

	const activityText = (a: TeamTaskActivity) => {
		const actor = a.aktorAdSoyad || t('kbSomeone');
		const d = a.detay ?? {};
		switch (a.tur) {
			case 'olusturuldu':
				return fill(t('kbActCreated'), { actor });
			case 'tasindi':
				return fill(t('kbActMoved'), {
					actor,
					from: t(columnMeta(String(d.from) as TaskStatus).key),
					to: t(columnMeta(String(d.to) as TaskStatus).key),
				});
			case 'duzenlendi': {
				const names: Record<string, string> = {
					baslik: t('kbFieldTitle'),
					aciklama: t('kbFieldDesc'),
					oncelik: t('kbFieldPriority'),
					teslimTarihi: t('kbFieldDue'),
					etiketler: t('kbFieldLabels'),
				};
				const fields = String(d.alanlar ?? '')
					.split(',')
					.filter(Boolean)
					.map((f) => names[f] ?? f)
					.join(', ');
				return fill(t('kbActEdited'), { actor, fields });
			}
			case 'atandi':
				return d.to ? fill(t('kbActAssigned'), { actor, to: memberName(d.to) }) : fill(t('kbActUnassigned'), { actor });
			case 'madde_eklendi':
				return fill(t('kbActItemAdded'), { actor, text: String(d.metin ?? '') });
			case 'madde_tamamlandi':
				return fill(t('kbActItemDone'), { actor, text: String(d.metin ?? '') });
			case 'yorum':
				return fill(t('kbActComment'), { actor });
			default:
				return actor;
		}
	};

	return (
		<section>
			<h5 className={ui.sectionTitle}>
				<Activity size={13} />
				{t('kbActivity')}
			</h5>
			<ul className={styles.activity}>
				{aktivite.map((a) => (
					<li key={a.id}>
						<span className={styles.dot} />
						<span>{activityText(a)}</span>
						<time dateTime={new Date(a.olusturma).toISOString()}>{when(a.olusturma)}</time>
					</li>
				))}
			</ul>
		</section>
	);
}
