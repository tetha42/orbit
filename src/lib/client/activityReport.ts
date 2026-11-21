'use client';

import { returnStatus } from '@/lib/inventory';
import { formatMinor } from '@/lib/budget';
import { escapeHtml } from '@/core/text/escape';
import { openPrintWindow, writePrintWindow } from '@/core/data/print';
import { translate, type Language } from '@/lib/i18n';
import { DEFAULT_LOCALE, getLocaleDefinition, isSupportedLocale } from '@/locales/registry';

interface Member {
	roleId?: string | null;
	status: string;
}
interface EventRow {
	title: string;
	start: number;
	status: string;
	registeredCount: number;
	participantCount: number;
}
interface Team {
	name: string;
	status: string;
	activeMemberCount: number;
	capacity: number;
	leaderNameSurname: string | null;
	tasks: { status: string }[];
}
interface Vault {
	name: string;
	totalIncomeMinor: number;
	totalExpenseMinor: number;
	netBalanceMinor: number;
}
interface Item {
	status: string;
	returnDate: number | null;
}

const esc = escapeHtml;
const get = async <T,>(url: string): Promise<T | null> => {
	const res = await fetch(url);
	return res.ok ? ((await res.json()) as T) : null;
};

function resolveClientLocale(override?: Language): Language {
	if (override && isSupportedLocale(override)) return override;
	try {
		const stored = typeof window !== 'undefined' ? localStorage.getItem('orbit_locale') : null;
		if (isSupportedLocale(stored)) return stored;
	} catch {
		// Ignore private storage restrictions
	}
	return DEFAULT_LOCALE;
}

const REPORT_CSS = [
	'body{font:12px/1.45 system-ui,sans-serif;margin:28px;color:#111}',
	'h1{font-size:19px;margin:0}',
	'h2{font-size:14px;margin:20px 0 6px;border-bottom:2px solid #0a84ff;padding-bottom:3px}',
	'table{width:100%;border-collapse:collapse}',
	'td,th{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}',
	'th{background:#f2f2f2}.n{text-align:right}',
	'.kpis{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}',
	'.kpis div{border:1px solid #ccc;border-radius:6px;padding:6px 10px;min-width:110px}',
	'.kpis b{font-size:16px;display:block}.muted{color:#666}',
].join('');

export async function openActivityReport(language?: Language): Promise<'ok' | 'popup' | 'error'> {
	const lang = resolveClientLocale(language);
	const t = (key: string) => translate(lang, key);
	const dateLocale = getLocaleDefinition(lang).dateLocale;

	const w = openPrintWindow({ title: t('reportPreparingTitle'), body: null, width: 960 });
	if (!w) return 'popup';
	try {
		const [membersRes, eventsRes, teamsRes, vaultsRes, inventoryRes] = await Promise.all([
			get<{ members: Member[] }>('/api/members'),
			get<{ events: EventRow[] }>('/api/events'),
			get<Team[]>('/api/teams'),
			get<{ vaults: Vault[] }>('/api/budget/vaults'),
			get<Item[]>('/api/inventory'),
		]);
		const now = Date.now();
		const members = membersRes?.members ?? [];
		const count = (pred: (m: Member) => boolean) => members.filter(pred).length;
		const since = now - 183 * 86_400_000;
		const events = (eventsRes?.events ?? [])
			.filter((e) => e.status !== 'draft' && e.start >= since && e.start <= now)
			.sort((a, b) => b.start - a.start);
		const reg = events.reduce((a, e) => a + Number(e.registeredCount || 0), 0);
		const att = events.reduce((a, e) => a + Number(e.participantCount || 0), 0);
		const teams = teamsRes ?? [];
		const items = inventoryRes ?? [];
		const overdue = items.filter((i) => i.status === 'on_loan' && returnStatus(i.returnDate, now)?.overdue).length;
		const rate = reg ? Math.round((att / reg) * 100) : 0;

		const eventsRows =
			events
				.map((e) => {
					const dt = esc(new Date(e.start).toLocaleDateString(dateLocale));
					const cancel = e.status === 'cancelled' ? ` <i>${esc(t('reportCancelledTag'))}</i>` : '';
					return `<tr><td>${dt}</td><td>${esc(e.title)}${cancel}</td><td class="n">${e.registeredCount}</td><td class="n">${e.participantCount}</td></tr>`;
				})
				.join('') || `<tr><td colspan="4" class="muted">${esc(t('reportNoEventsPeriod'))}</td></tr>`;

		const teamsRows = teams
			.map((tm) => {
				const done = tm.tasks.filter((g) => g.status === 'done').length;
				const lead = esc(tm.leaderNameSurname ?? '—');
				return (
					`<tr><td>${esc(tm.name)}</td><td>${lead}</td>` +
					`<td class="n">${tm.activeMemberCount} / ${tm.capacity}</td>` +
					`<td class="n">${tm.tasks.length - done}</td><td class="n">${done}</td>` +
					`<td>${esc(tm.status)}</td></tr>`
				);
			})
			.join('');

		const vaultsSection = vaultsRes
			? [
					`<h2>${esc(t('reportVaultsHeading'))}</h2>`,
					`<table><tr><th>${esc(t('reportColVault'))}</th>`,
					`<th class="n">${esc(t('reportColIncome'))}</th>`,
					`<th class="n">${esc(t('reportColExpense'))}</th>`,
					`<th class="n">${esc(t('reportColBalance'))}</th></tr>`,
					vaultsRes.vaults
						.map(
							(v) =>
								`<tr><td>${esc(v.name)}</td>` +
								`<td class="n">${formatMinor(v.totalIncomeMinor)}</td>` +
								`<td class="n">${formatMinor(v.totalExpenseMinor)}</td>` +
								`<td class="n"><b>${formatMinor(v.netBalanceMinor)}</b></td></tr>`
						)
						.join(''),
					'</table>',
				].join('')
			: '';

		const html = [
			`<h1>${esc(t('reportTitle'))}</h1>`,
			`<div class="muted">${esc(new Date(now).toLocaleString(dateLocale))} · ${esc(t('reportLastSixMonths'))}</div>`,
			`<h2>${esc(t('reportMembersHeading'))}</h2><div class="kpis">`,
			`<div><b>${count((m) => m.status === 'active')}</b>${esc(t('reportActiveMembers'))}</div>`,
			`<div><b>${count((m) => m.status === 'pending')}</b>${esc(t('reportPendingApproval'))}</div>`,
			`<div><b>${count((m) => m.status === 'alumni')}</b>${esc(t('reportAlumni'))}</div>`,
			`<div><b>${count((m) => m.status === 'active' && !m.roleId)}</b>${esc(t('reportUnassignedRole'))}</div></div>`,
			`<h2>${esc(t('reportEventsHeading'))}</h2><div class="kpis">`,
			`<div><b>${events.length}</b>${esc(t('reportEventCount'))}</div>`,
			`<div><b>${reg}</b>${esc(t('reportRegistrations'))}</div>`,
			`<div><b>${att}</b>${esc(t('reportAttendance'))}</div>`,
			`<div><b>${rate}%</b>${esc(t('reportAttendanceRate'))}</div></div>`,
			`<table><tr><th>${esc(t('reportColDate'))}</th><th>${esc(t('reportColEvent'))}</th>`,
			`<th class="n">${esc(t('reportColReg'))}</th><th class="n">${esc(t('reportColAtt'))}</th></tr>${eventsRows}</table>`,
			`<h2>${esc(t('reportTeamsHeading'))}</h2>`,
			`<table><tr><th>${esc(t('reportColTeam'))}</th><th>${esc(t('reportColCaptain'))}</th>`,
			`<th class="n">${esc(t('reportColCapacity'))}</th><th class="n">${esc(t('reportColOpenTasks'))}</th>`,
			`<th class="n">${esc(t('reportColCompleted'))}</th><th>${esc(t('reportColStatus'))}</th></tr>${teamsRows}</table>`,
			vaultsSection,
			`<h2>${esc(t('reportInventoryHeading'))}</h2><div class="kpis">`,
			`<div><b>${items.length}</b>${esc(t('reportInvItems'))}</div>`,
			`<div><b>${items.filter((i) => i.status === 'available').length}</b>${esc(t('reportInvAvailable'))}</div>`,
			`<div><b>${items.filter((i) => i.status === 'on_loan').length}</b>${esc(t('reportInvOnLoan'))}</div>`,
			`<div><b>${overdue}</b>${esc(t('reportInvOverdue'))}</div>`,
			`<div><b>${items.filter((i) => i.status === 'faulty').length}</b>${esc(t('reportInvFaulty'))}</div>`,
			`<div><b>${items.filter((i) => i.status === 'lost').length}</b>${esc(t('reportInvLost'))}</div></div>`,
		].join('');

		writePrintWindow(w, { title: t('reportTitle'), body: html, css: REPORT_CSS });
		return 'ok';
	} catch {
		w.close();
		return 'error';
	}
}
