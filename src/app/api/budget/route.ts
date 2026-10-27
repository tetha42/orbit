import { NextResponse } from 'next/server';
import {
	InsufficientFundsError,
	createBudgetRecord,
	addOdenekAktarimi,
	deleteBudgetRecord,
	getBudgetRecords,
	getBudgetRecordById,
	getTeamById,
	updateBudgetRecord,
	getPgPool,
} from '@/db';
import { publishEventQuiet } from '@/db/olaylar';
import { verifyKasaAccess } from '@/lib/kasaAccess';
import { tarihGecerliMi } from '@/lib/budget';
import { BUTCE_KATEGORILERI, MAX_TUTAR_KURUS, isButceKategorisi } from '@/types/budget';

/** `?teamId=` selects a project's kasa; missing or `genel` is the general kasa. */
function parseKasa(value: unknown): string | null {
	return typeof value === 'string' && value && value !== 'genel' ? value : null;
}

/** Receipts are private uploads; anything else in this field could be a hostile link. */
const RECEIPT_URL = /^\/api\/uploads\/[A-Za-z0-9._-]{1,120}$/;

const formatTL = (kurus: number) => `${(kurus / 100).toFixed(2)} ₺`;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** An optional transaction date: absent means "now"; otherwise within the accepted range. */
function parseTarih(value: unknown): { ok: true; date?: number; error?: undefined } | { ok: false; error: string; date?: undefined } {
	if (value === undefined || value === null || value === '') return { ok: true };
	const date = Number(value);
	if (!tarihGecerliMi(date, Date.now())) return { ok: false, error: 'İşlem tarihi gelecekte veya üç yıldan eski olamaz.' };
	return { ok: true, date };
}

/** Allocation between two kasas — Kasa managers only, since it moves the club's money. */
async function transfer(request: Request, body: Record<string, unknown>) {
	const access = await verifyKasaAccess(request, null, 'yaz');
	if (!access.authorized) return access.response;
	if (!access.isManagement) return bad('Kasalar arası aktarım Kasa yönetim yetkisi gerektirir.', 403);

	const kaynak = parseKasa(body.kaynak);
	const hedef = parseKasa(body.hedef);
	if (kaynak === hedef) return bad('Kaynak ve hedef kasa aynı olamaz.');
	for (const id of [kaynak, hedef]) {
		if (id && !(await getTeamById(id))) return bad('Project bulunamadı.', 404);
	}
	const tutarKurus = Number(body.tutarKurus);
	if (!Number.isInteger(tutarKurus) || tutarKurus < 1 || tutarKurus > MAX_TUTAR_KURUS) {
		return bad(`Tutar 0,01 ₺ ile ${formatTL(MAX_TUTAR_KURUS)} arasında olmalıdır.`);
	}
	const aciklama = typeof body.aciklama === 'string' ? body.aciklama.trim() : '';
	if (aciklama.length < 3 || aciklama.length > 500) return bad('Açıklama 3-500 karakter olmalıdır.');
	const date = parseTarih(body.date);
	if (!date.ok) return bad(date.error);

	try {
		const result = await addOdenekAktarimi({ kaynakTakimId: kaynak, hedefTakimId: hedef, tutarKurus, aciklama, kaydedenId: access.user.id, date: date.date });
		await publishEventQuiet(getPgPool(), { k: 'butce_guncellendi' });
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		if (error instanceof InsufficientFundsError) {
			return NextResponse.json(
				{ error: `Kaynak kasanın bakiyesi (${formatTL(error.netBakiyeKurus)}) bu aktarım için yetersiz.`, code: 'INSUFFICIENT_FUNDS', netBakiyeKurus: error.netBakiyeKurus },
				{ status: 409 }
			);
		}
		throw error;
	}
}

export async function GET(request: Request) {
	const teamId = parseKasa(new URL(request.url).searchParams.get('teamId'));

	// Kasa readers and managers see every kasa; a captain sees their project's.
	const access = await verifyKasaAccess(request, teamId, 'oku');
	if (!access.authorized) return access.response;

	try {
		let ad = 'Genel Kasa';
		if (teamId) {
			const team = await getTeamById(teamId);
			if (!team) return NextResponse.json({ error: 'Project bulunamadı.' }, { status: 404 });
			ad = team.ad;
		}

		const records = await getBudgetRecords(teamId);

		let toplamGelirKurus = 0;
		let toplamGiderKurus = 0;
		for (const r of records) {
			if (r.tur === 'gelir') toplamGelirKurus += r.tutarKurus;
			else toplamGiderKurus += r.tutarKurus;
		}
		const netBakiyeKurus = toplamGelirKurus - toplamGiderKurus;

		return NextResponse.json({
			kasa: { teamId, ad, kind: teamId ? 'proje' : 'genel' },
			// What the caller may do here — the panel hides what the server would refuse.
			izin: { yaz: access.erisim === 'yaz' && access.user.status !== 'mezun', yonet: access.isManagement },
			kayitlar: records,
			// Amounts travel as integer kuruş only; each client formats them for its language.
			ozet: {
				toplamGelirKurus,
				toplamGiderKurus,
				netBakiyeKurus,
				kayitSayisi: records.length,
			},
		});
	} catch (error) {
		console.error('API /api/butce GET error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		if (body?.action === 'aktar') return await transfer(request, body);
		const teamId = parseKasa(body?.teamId);

		const access = await verifyKasaAccess(request, teamId, 'yaz');
		if (!access.authorized) return access.response;

		const { tur, kategori, fisFotoUrl } = body;
		const aciklama = typeof body.aciklama === 'string' ? body.aciklama.trim() : '';
		const tutarKurus = Number(body.tutarKurus);

		if (!tur || !kategori || !aciklama) {
			return NextResponse.json({ error: 'Tür, kategori, tutar ve açıklama zorunludur.' }, { status: 400 });
		}

		if (tur !== 'gelir' && tur !== 'gider') {
			return NextResponse.json({ error: "Tür 'gelir' veya 'gider' olmalıdır." }, { status: 400 });
		}

		// Reject unknown categories instead of storing free text the summaries
		// cannot group — the form offers a fixed set for exactly that reason.
		if (!isButceKategorisi(kategori)) {
			return NextResponse.json(
				{ error: `Geçersiz kategori. Beklenen: ${BUTCE_KATEGORILERI.join(', ')}` },
				{ status: 400 }
			);
		}

		// `!tutarKurus` used to be the only check, which let negatives and NaN
		// through, and the column is a 32-bit INTEGER.
		if (!Number.isInteger(tutarKurus) || tutarKurus < 1 || tutarKurus > MAX_TUTAR_KURUS) {
			return NextResponse.json(
				{ error: `Tutar 0,01 ₺ ile ${formatTL(MAX_TUTAR_KURUS)} arasında olmalıdır.` },
				{ status: 400 }
			);
		}

		if (aciklama.length > 500) {
			return NextResponse.json({ error: 'Açıklama en fazla 500 karakter olabilir.' }, { status: 400 });
		}

		if (fisFotoUrl && !RECEIPT_URL.test(String(fisFotoUrl))) {
			return NextResponse.json({ error: 'Geçersiz fiş dosyası.' }, { status: 400 });
		}

		const date = parseTarih(body.date);
		if (!date.ok) return bad(date.error);

		if (teamId && !(await getTeamById(teamId))) {
			return NextResponse.json({ error: 'Project bulunamadı.' }, { status: 404 });
		}

		try {
			const result = await createBudgetRecord({
				tur,
				kategori,
				tutarKurus,
				aciklama,
				fisFotoUrl: fisFotoUrl || undefined,
				kaydedenId: access.user.id,
				teamId,
				date: date.date,
			});
			await publishEventQuiet(getPgPool(), { k: 'butce_guncellendi' });
			return NextResponse.json(result);
		} catch (error) {
			// Kasa bakiyesi eksiye düşme engeli (Senaryo 175 & 300), now per kasa.
			if (error instanceof InsufficientFundsError) {
				return NextResponse.json(
					{
						error: `Yetersiz bakiye! Bu kasanın mevcut bakiyesi (${formatTL(error.netBakiyeKurus)}) aşılacağından kasa eksiye düşemez.`,
						code: 'INSUFFICIENT_FUNDS',
						netBakiyeKurus: error.netBakiyeKurus,
					},
					{ status: 409 }
				);
			}
			throw error;
		}
	} catch (error) {
		console.error('API /api/butce POST error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}

/** Corrects the description, category, date or receipt of an entry; never its type or amount. */
export async function PATCH(request: Request) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const id = typeof body.id === 'string' ? body.id : '';
		// As with DELETE, the kasa comes from the stored row, not from the request.
		const registration = id ? await getBudgetRecordById(id) : null;
		const access = await verifyKasaAccess(request, registration?.teamId ?? null, 'yaz');
		if (!access.authorized) return access.response;
		if (!registration) return bad('Kayıt bulunamadı.', 404);
		// An allocation also touches the general kasa, which only Kasa managers may change.
		if (registration.aktarimId && !access.isManagement) return bad('Ödenek aktarımlarını yalnızca Kasa yöneticileri değiştirebilir.', 403);
		if (body.tutarKurus !== undefined || body.tur !== undefined) {
			return bad('Tutar ve tür değiştirilemez; kaydı silip doğrusunu girin.');
		}

		const changes: { aciklama?: string; kategori?: (typeof BUTCE_KATEGORILERI)[number]; date?: number; fisFotoUrl?: string | null } = {};
		if (body.aciklama !== undefined) {
			const aciklama = typeof body.aciklama === 'string' ? body.aciklama.trim() : '';
			if (!aciklama || aciklama.length > 500) return bad('Açıklama 1-500 karakter olmalıdır.');
			changes.aciklama = aciklama;
		}
		if (body.kategori !== undefined) {
			if (!isButceKategorisi(body.kategori)) return bad(`Geçersiz kategori. Beklenen: ${BUTCE_KATEGORILERI.join(', ')}`);
			changes.kategori = body.kategori;
		}
		if (body.date !== undefined) {
			const date = parseTarih(body.date);
			if (!date.ok || date.date === undefined) return bad(date.error ?? 'Geçersiz date.');
			changes.date = date.date;
		}
		if (body.fisFotoUrl !== undefined) {
			if (body.fisFotoUrl !== null && !RECEIPT_URL.test(String(body.fisFotoUrl))) return bad('Geçersiz fiş dosyası.');
			changes.fisFotoUrl = (body.fisFotoUrl as string | null) || null;
		}

		const r = await updateBudgetRecord(id, changes, access.user.id);
		if (r === 'yok') return bad('Kayıt bulunamadı.', 404);
		if (r === 'aktarim') return bad('Ödenek aktarımının kategorisi ve fişi değiştirilemez.', 409);
		await publishEventQuiet(getPgPool(), { k: 'butce_guncellendi' });
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('API /api/butce PATCH error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}

export async function DELETE(request: Request) {
	try {
		const id = new URL(request.url).searchParams.get('id');
		if (!id) {
			return NextResponse.json({ error: 'Kayıt ID zorunludur.' }, { status: 400 });
		}

		// Which kasa the entry belongs to comes from the stored row, never from the
		// request — otherwise the leader of one project could delete another's entries.
		const registration = await getBudgetRecordById(id);
		const access = await verifyKasaAccess(request, registration?.teamId ?? null, 'yaz');
		if (!access.authorized) return access.response;

		if (!registration) {
			return NextResponse.json({ error: 'Kayıt bulunamadı veya silinemedi.' }, { status: 404 });
		}
		// Deleting one side of an allocation deletes both, the general kasa's included.
		if (registration.aktarimId && !access.isManagement) {
			return bad('Ödenek aktarımlarını yalnızca Kasa yöneticileri geri alabilir.', 403);
		}

		try {
			const deleted = await deleteBudgetRecord(id);
			if (!deleted) {
				return NextResponse.json({ error: 'Kayıt bulunamadı veya silinemedi.' }, { status: 404 });
			}
			await publishEventQuiet(getPgPool(), { k: 'butce_guncellendi' });
		} catch (error) {
			if (error instanceof InsufficientFundsError) {
				return NextResponse.json(
					{
						error: 'Bu gelir kaydı silinirse kasa bakiyesi eksiye düşer; önce buna bağlı giderleri silin.',
						code: 'INSUFFICIENT_FUNDS',
						netBakiyeKurus: error.netBakiyeKurus,
					},
					{ status: 409 }
				);
			}
			throw error;
		}

		return NextResponse.json({ success: true, message: 'Bütçe kaydı silindi.' });
	} catch (error) {
		console.error('API /api/butce DELETE error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}
