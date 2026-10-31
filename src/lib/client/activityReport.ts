'use client';

import { returnStatus } from '@/lib/inventory';
import { formatKurus } from '@/lib/budget';
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
	baslik: string;
	baslangic: number;
	status: string;
	kayitliSayisi: number;
	katilimciSayisi: number;
}
interface Team {
	ad: string;
	status: string;
	aktifUyeSayisi: number;
	kontenjan: number;
	liderAdSoyad: string | null;
	gorevler: { status: string }[];
}
interface Vault {
	ad: string;
	toplamGelirKurus: number;
	toplamGiderKurus: number;
	netBakiyeKurus: number;
}
interface Item {
	status: string;
	iadeTarihi: number | null;
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
		const [uyeler, etkinlik, takimlar, kasalar, envanter] = await Promise.all([
			get<{ members: Member[] }>('/api/uyeler'),
			get<{ etkinlikler: EventRow[] }>('/api/etkinlikler'),
			get<Team[]>('/api/takimlar'),
			get<{ kasalar: Vault[] }>('/api/butce/kasalar'),
			get<Item[]>('/api/envanter'),
		]);
		const now = Date.now();
		const members = uyeler?.members ?? [];
		const count = (pred: (m: Member) => boolean) => members.filter(pred).length;
		const since = now - 183 * 86_400_000;
		const events = (etkinlik?.etkinlikler ?? []).filter((e) => e.status !== 'taslak' && e.baslangic >= since && e.baslangic <= now).sort((a, b) => b.baslangic - a.baslangic);
		const reg = events.reduce((a, e) => a + Number(e.kayitliSayisi || 0), 0);
		const att = events.reduce((a, e) => a + Number(e.katilimciSayisi || 0), 0);
		const teams = takimlar ?? [];
		const items = envanter ?? [];
		const overdue = items.filter((i) => i.status === 'oduncte' && returnStatus(i.iadeTarihi, now)?.gecikti).length;

		const css = `body{font:12px/1.45 system-ui,sans-serif;margin:28px;color:#111}h1{font-size:19px;margin:0}h2{font-size:14px;margin:20px 0 6px;border-bottom:2px solid #0a84ff;padding-bottom:3px}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f2f2f2}.n{text-align:right}
.kpis{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}.kpis div{border:1px solid #ccc;border-radius:6px;padding:6px 10px;min-width:110px}.kpis b{font-size:16px;display:block}
.muted{color:#666}`;
		const html = `
<h1>Yönetim Faaliyet Raporu</h1><div class="muted">${esc(new Date(now).toLocaleString('tr-TR'))} · son 6 ay</div>
<h2>Üyeler</h2><div class="kpis"><div><b>${count((m) => m.status === 'aktif')}</b>aktif üye</div><div><b>${count((m) => m.status === 'beklemede')}</b>onay bekleyen</div><div><b>${count((m) => m.status === 'mezun')}</b>mezun</div><div><b>${count((m) => m.status === 'aktif' && !m.roleId)}</b>roleü atanmamış</div></div>
<h2>Etkinlikler</h2><div class="kpis"><div><b>${events.length}</b>etkinlik</div><div><b>${reg}</b>kayıt</div><div><b>${att}</b>katılım</div><div><b>${reg ? Math.round((att / reg) * 100) : 0}%</b>katılım oranı</div></div>
<table><tr><th>Tarih</th><th>CommunityEvent</th><th class="n">Kayıt</th><th class="n">Katılım</th></tr>${
			events.map((e) => `<tr><td>${esc(new Date(e.baslangic).toLocaleDateString('tr-TR'))}</td><td>${esc(e.baslik)}${e.status === 'iptal' ? ' <i>(iptal)</i>' : ''}</td><td class="n">${e.kayitliSayisi}</td><td class="n">${e.katilimciSayisi}</td></tr>`).join('') ||
			'<tr><td colspan="4" class="muted">Bu dönemde etkinlik yok.</td></tr>'
		}</table>
<h2>Takımlar</h2><table><tr><th>Takım</th><th>Kaptan</th><th class="n">Üye / kontenjan</th><th class="n">Açık görev</th><th class="n">Tamamlanan</th><th>Durum</th></tr>${teams
			.map((t) => {
				const done = t.gorevler.filter((g) => g.status === 'tamamlandi').length;
				return `<tr><td>${esc(t.ad)}</td><td>${esc(t.liderAdSoyad ?? '—')}</td><td class="n">${t.aktifUyeSayisi} / ${t.kontenjan}</td><td class="n">${t.gorevler.length - done}</td><td class="n">${done}</td><td>${esc(t.status)}</td></tr>`;
			})
			.join('')}</table>
${
	kasalar
		? `<h2>Kasalar</h2><table><tr><th>Kasa</th><th class="n">Gelir (₺)</th><th class="n">Gider (₺)</th><th class="n">Bakiye (₺)</th></tr>${kasalar.kasalar
				.map((k) => `<tr><td>${esc(k.ad)}</td><td class="n">${formatKurus(k.toplamGelirKurus)}</td><td class="n">${formatKurus(k.toplamGiderKurus)}</td><td class="n"><b>${formatKurus(k.netBakiyeKurus)}</b></td></tr>`)
				.join('')}</table>`
		: ''
}
<h2>Envanter</h2><div class="kpis"><div><b>${items.length}</b>eşya</div><div><b>${items.filter((i) => i.status === 'saglam').length}</b>müsait</div><div><b>${items.filter((i) => i.status === 'oduncte').length}</b>ödünçte</div><div><b>${overdue}</b>gecikmiş iade</div><div><b>${items.filter((i) => i.status === 'arizali').length}</b>arızalı</div><div><b>${items.filter((i) => i.status === 'kayip').length}</b>kayıp</div></div>
`;
		writePrintWindow(w, { title: 'Yönetim Faaliyet Raporu', body: html, css });
		return 'ok';
	} catch {
		w.close();
		return 'error';
	}
}
