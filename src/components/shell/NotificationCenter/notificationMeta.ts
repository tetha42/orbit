import {
	Award,
	CalendarCheck,
	ClipboardList,
	FolderGit2,
	QrCode,
	Users,
	Cpu,
	ListChecks,
	Mail,
	Newspaper,
	UserPlus,
	type LucideIcon,
} from 'lucide-react';
import { dayOffset, relativeTime } from '@/core/data/format';
import { fill } from '@/lib/text';
import type { NotificationItem, NotificationKind } from '@/types/notifications';

export const KIND_STYLE: Record<NotificationKind, { Icon: LucideIcon; color: string }> = {
	approval: { Icon: UserPlus, color: 'var(--info)' },
	news: { Icon: Newspaper, color: 'var(--warning)' },
	event: { Icon: CalendarCheck, color: 'var(--danger)' },
	task: { Icon: ListChecks, color: 'var(--indigo)' },
	loan: { Icon: Cpu, color: 'var(--cyan)' },
	certificate: { Icon: Award, color: 'var(--warning)' },
	teamApplication: { Icon: Users, color: 'var(--info)' },
	teamDecision: { Icon: Users, color: 'var(--success)' },
	projectProposal: { Icon: FolderGit2, color: 'var(--indigo)' },
	assigned: { Icon: ClipboardList, color: 'var(--indigo)' },
	checkin: { Icon: QrCode, color: 'var(--success)' },
	message: { Icon: Mail, color: 'var(--info)' },
};

type Translate = (key: string, fallback?: string) => string;

function dueLabel(dueAt: number, now: number, t: Translate): string {
	const days = dayOffset(dueAt, now);
	if (days < -1) return fill(t('ncDueOverdue'), { n: -days });
	if (days === -1) return t('ncDueOverdueOne');
	if (days === 0) return t('ncDueToday');
	if (days === 1) return t('ncDueTomorrow');
	return fill(t('ncDueInDays'), { n: days });
}

/** The second line of a row. Wording lives here, in the member's language; the API only sends facts. */
export function metaFor(item: NotificationItem, now: number, t: Translate, locale: string): string[] {
	const d = item.data;
	switch (item.kind) {
		case 'approval':
			return [
				t('ncApprovalMeta'),
				d.department ? String(d.department) : '',
				d.year ? fill(t('ncYear'), { n: Number(d.year) }) : '',
			].filter(Boolean);
		case 'news':
			return [d.category ? String(d.category) : '', relativeTime(item.at, now, locale)].filter(Boolean);
		case 'event': {
			const when = item.dueAt
				? new Intl.DateTimeFormat(locale, {
						weekday: 'short',
						day: 'numeric',
						month: 'short',
						hour: '2-digit',
						minute: '2-digit',
					}).format(item.dueAt)
				: '';
			return [d.ongoing ? t('ncEventOngoing') : when, d.location ? String(d.location) : ''].filter(Boolean);
		}
		case 'task':
			return [
				fill(t('ncTaskMeta'), { team: String(d.teamName ?? ''), when: dueLabel(item.dueAt ?? item.at, now, t) }),
			];
		case 'loan':
			return [fill(t('ncLoanMeta'), { when: dueLabel(item.dueAt ?? item.at, now, t) })];
		case 'certificate':
			return [t('ncCertificateMeta'), relativeTime(item.at, now, locale)];
		case 'teamApplication':
			return [fill(t('ncTeamApplicationMeta'), { team: String(d.teamName ?? '') }), relativeTime(item.at, now, locale)];
		case 'teamDecision':
			return [t(d.accepted ? 'ncTeamDecisionAccepted' : 'ncTeamDecisionRejected'), relativeTime(item.at, now, locale)];
		case 'projectProposal':
			return [t('ncProjectProposalMeta'), d.author ? String(d.author) : '', relativeTime(item.at, now, locale)].filter(Boolean);
		case 'assigned':
			return [
				d.by ? fill(t('ncAssignedBy'), { name: String(d.by) }) : t('ncAssignedMeta'),
				String(d.teamName ?? ''),
				relativeTime(item.at, now, locale),
			].filter(Boolean);
		case 'checkin':
			return [t('ncCheckinMeta'), d.location ? String(d.location) : ''].filter(Boolean);
		case 'message':
			return [fill(t('ncMessageMeta'), { name: String(d.from ?? '') }), relativeTime(item.at, now, locale)];
	}
}
