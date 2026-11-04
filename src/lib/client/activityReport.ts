'use client';

import { returnStatus } from '@/lib/inventory';
import { formatMinor } from '@/lib/budget';
import { escapeHtml } from '@/core/text/escape';
import { openPrintWindow, writePrintWindow } from '@/core/data/print';

/**
 * "Yönetim Faaliyet Raporu": one printable page with where the club stands —
 * members, the last six months' events and attendance, teams and their tasks,
 * every kasa's balance and the inventory. Built from the same endpoints the
 * apps use, so it shows exactly what management can see, nothing more.
 */

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

export async function openActivityReport(): Promise<'ok' | 'popup' | 'error'> {
	// Open the window first, inside the click: browsers block pop-ups opened after an await.
	const w = openPrintWindow({ title: 'Rapor hazırlanıyor…', body: null, width: 960 });
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
		const events = (eventsRes?.events ?? []).filter((e) => e.status !== 'draft' && e.start >= since && e.start <= now).sort((a, b) => b.start - a.start);
		const reg = events.reduce((a, e) => a + Number(e.registeredCount || 0), 0);
		const att = events.reduce((a, e) => a + Number(e.participantCount || 0), 0);
		const teams = teamsRes ?? [];
		const items = inventoryRes ?? [];
		const overdue = items.filter((i) => i.status === 'on_loan' && returnStatus(i.returnDate, now)?.overdue).length;
		const vaults = vaultsRes;

		const css = `body{font:12px/1.45 system-ui,sans-serif;margin:28px;color:#111}h1{font-size:19px;margin:0}h2{font-size:14px;margin:20px 0 6px;border-bottom:2px solid #0a84ff;padding-bottom:3px}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f2f2f2}.n{text-align:right}
.kpis{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}.kpis div{border:1px solid #ccc;border-radius:6px;padding:6px 10px;min-width:110px}.kpis b{font-size:16px;display:block}
.muted{color:#666}`;
		const html = `
<h1>Yönetim Faaliyet Raporu</h1><div class="muted">${esc(new Date(now).toLocaleString('tr-TR'))} · son 6 ay</div>
<h2>Üyeler</h2><div class="kpis"><div><b>${count((m) => m.status === 'active')}</b>aktif üye</div><div><b>${count((m) => m.status === 'pending')}</b>onay bekleyen</div><div><b>${count((m) => m.status === 'alumni')}</b>mezun</div><div><b>${count((m) => m.status === 'active' && !m.roleId)}</b>roleü atanmamış</div></div>
<h2>Etkinlikler</h2><div class="kpis"><div><b>${events.length}</b>etkinlik</div><div><b>${reg}</b>kayıt</div><div><b>${att}</b>katılım</div><div><b>${reg ? Math.round((att / reg) * 100) : 0}%</b>katılım oranı</div></div>
<table><tr><th>Tarih</th><th>CommunityEvent</th><th class="n">Kayıt</th><th class="n">Katılım</th></tr>${
			events.map((e) => `<tr><td>${esc(new Date(e.start).toLocaleDateString('tr-TR'))}</td><td>${esc(e.title)}${e.status === 'cancelled' ? ' <i>(iptal)</i>' : ''}</td><td class="n">${e.registeredCount}</td><td class="n">${e.participantCount}</td></tr>`).join('') ||
			'<tr><td colspan="4" class="muted">Bu dönemde etkinlik yok.</td></tr>'
		}</table>
<h2>Takımlar</h2><table><tr><th>Takım</th><th>Kaptan</th><th class="n">Üye / kontenjan</th><th class="n">Açık görev</th><th class="n">Tamamlanan</th><th>Durum</th></tr>${teams
			.map((t) => {
				const done = t.tasks.filter((g) => g.status === 'done').length;
				return `<tr><td>${esc(t.name)}</td><td>${esc(t.leaderNameSurname ?? '—')}</td><td class="n">${t.activeMemberCount} / ${t.capacity}</td><td class="n">${t.tasks.length - done}</td><td class="n">${done}</td><td>${esc(t.status)}</td></tr>`;
			})
			.join('')}</table>
${
	vaults
		? `<h2>Kasalar</h2><table><tr><th>Kasa</th><th class="n">Gelir (₺)</th><th class="n">Gider (₺)</th><th class="n">Bakiye (₺)</th></tr>${vaults.vaults
				.map((k) => `<tr><td>${esc(k.name)}</td><td class="n">${formatMinor(k.totalIncomeMinor)}</td><td class="n">${formatMinor(k.totalExpenseMinor)}</td><td class="n"><b>${formatMinor(k.netBalanceMinor)}</b></td></tr>`)
				.join('')}</table>`
		: ''
}
<h2>Envanter</h2><div class="kpis"><div><b>${items.length}</b>eşya</div><div><b>${items.filter((i) => i.status === 'available').length}</b>müsait</div><div><b>${items.filter((i) => i.status === 'on_loan').length}</b>ödünçte</div><div><b>${overdue}</b>gecikmiş iade</div><div><b>${items.filter((i) => i.status === 'faulty').length}</b>arızalı</div><div><b>${items.filter((i) => i.status === 'lost').length}</b>kayıp</div></div>
`;
		writePrintWindow(w, { title: 'Yönetim Faaliyet Raporu', body: html, css });
		return 'ok';
	} catch {
		w.close();
		return 'error';
	}
}
