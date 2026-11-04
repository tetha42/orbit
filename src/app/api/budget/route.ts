import { NextResponse } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import {
	InsufficientFundsError,
	createBudgetRecord,
	addAllowanceTransfer,
	deleteBudgetRecord,
	getBudgetRecords,
	getBudgetRecordById,
	getTeamById,
	updateBudgetRecord,
	getPgPool,
} from '@/db';
import { publishEventQuiet } from '@/db/events';
import { verifyVaultAccess } from '@/lib/vaultAccess';
import { isValidDate } from '@/lib/budget';
import { BUDGET_CATEGORIES, MAX_AMOUNT_CENTS, normalizeBudgetCategory } from '@/types/budget';
import { withAudit } from '@/lib/audit/withAudit';

/** `?teamId=` selects a project's kasa; missing or `genel` is the general kasa. */
function parseVault(value: unknown): string | null {
	return typeof value === 'string' && value && value !== 'genel' ? value : null;
}

/** Receipts are private uploads; anything else in this field could be a hostile link. */
const RECEIPT_URL = /^\/api\/uploads\/[A-Za-z0-9._-]{1,120}$/;

const formatTL = (minor: number) => `${(minor / 100).toFixed(2)} ₺`;

const bad = (error: string, status = 400, code?: string) => jsonError(error, status, code);

/** An optional transaction date: absent means "now"; otherwise within the accepted range. */
function parseDate(value: unknown): { ok: true; date?: number; error?: undefined } | { ok: false; error: string; date?: undefined } {
	if (value === undefined || value === null || value === '') return { ok: true };
	const date = Number(value);
	if (!isValidDate(date, Date.now())) return { ok: false, error: 'İşlem tarihi gelecekte veya üç yıldan eski olamaz.' };
	return { ok: true, date };
}

/** Allocation between two kasas — Kasa managers only, since it moves the club's money. */
async function transfer(request: Request, body: Record<string, unknown>) {
	const access = await verifyVaultAccess(request, null, 'yaz');
	if (!access.authorized) return access.response;
	if (!access.isManagement) return bad('Kasalar arası aktarım Kasa yönetim yetkisi gerektirir.', 403);

	const source = parseVault(body.source ?? body.sourceTeamId);
	const target = parseVault(body.target ?? body.targetTeamId);
	if (source === target) return bad('Kaynak ve hedef kasa aynı olamaz.');
	for (const id of [source, target]) {
		if (id && !(await getTeamById(id))) return bad('Project bulunamadı.', 404);
	}
	const amountCents = Number(body.amountMinor);
	if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > MAX_AMOUNT_CENTS) {
		return bad(`Tutar 0,01 ₺ ile ${formatTL(MAX_AMOUNT_CENTS)} arasında olmalıdır.`);
	}
	const description = typeof body.description === 'string' ? body.description.trim() : '';
	if (description.length < 3 || description.length > 500) return bad('Açıklama 3-500 karakter olmalıdır.');
	const date = parseDate(body.date);
	if (!date.ok) return bad(date.error);

	try {
		const result = await addAllowanceTransfer({ sourceTeamId: source, targetTeamId: target, amountMinor: amountCents, description: description, recorderId: access.user.id, date: date.date });
		await publishEventQuiet(getPgPool(), { k: 'budget_updated' });
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		if (error instanceof InsufficientFundsError) {
			return NextResponse.json(
				{ error: `Kaynak kasanın bakiyesi (${formatTL(error.netBalanceMinor)}) bu aktarım için yetersiz.`, code: 'INSUFFICIENT_FUNDS', netBalanceMinor: error.netBalanceMinor },
				{ status: 409 }
			);
		}
		throw error;
	}
}

export async function GET(request: Request) {
	const url = new URL(request.url);
	const teamId = parseVault(url.searchParams.get('teamId'));

	// Kasa readers and managers see every kasa; a captain sees their project's.
	const access = await verifyVaultAccess(request, teamId, 'oku');
	if (!access.authorized) return access.response;

	try {
		let name = 'Genel Kasa';
		if (teamId) {
			const team = await getTeamById(teamId);
			if (!team) return NextResponse.json({ error: 'Project bulunamadı.' }, { status: 404 });
			name = team.name;
		}

		const records = await getBudgetRecords(teamId);

		let totalIncomeMinor = 0;
		let totalExpenseMinor = 0;
		for (const r of records) {
			if (r.typeValue === 'gelir') totalIncomeMinor += r.amountMinor;
			else totalExpenseMinor += r.amountMinor;
		}
		const netBalanceCents = totalIncomeMinor - totalExpenseMinor;

		return NextResponse.json({
			vault: { teamId, name, kind: teamId ? 'proje' : 'genel' },
			// What the caller may do here — the panel hides what the server would refuse.
			permission: { yaz: access.access === 'yaz' && access.user.status !== 'mezun', yonet: access.isManagement },
			records: records,
			// Amounts travel as integer kuruş only; each client formats them for its language.
			summary: {
				totalIncomeMinor,
				totalExpenseMinor,
				netBalanceMinor: netBalanceCents,
				recordCount: records.length,
			},
		});
	} catch (error) {
		console.error('API /api/butce GET error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}

export const POST = withAudit(async function POST(request: Request) {
	try {
		const body = await request.json();
		if (body?.action === 'aktar') return await transfer(request, body);
		const teamId = parseVault(body?.teamId);

		const access = await verifyVaultAccess(request, teamId, 'yaz');
		if (!access.authorized) return access.response;

		const { typeValue, category, receiptPhotoUrl } = body;
		const description = typeof body.description === 'string' ? body.description.trim() : '';
		const amountCents = Number(body.amountMinor);

		if (!typeValue || !category || !description) {
			return NextResponse.json({ error: 'Tür, kategori, tutar ve açıklama zorunludur.' }, { status: 400 });
		}

		if (typeValue !== 'gelir' && typeValue !== 'gider') {
			return NextResponse.json({ error: "Tür 'gelir' veya 'gider' olmalıdır." }, { status: 400 });
		}

		// Reject unknown categories instead of storing free text the summaries
		// cannot group — the form offers a fixed set for exactly that reason.
		const resolvedCategory = normalizeBudgetCategory(category);
		if (!resolvedCategory) {
			return NextResponse.json(
				{ error: `Geçersiz kategori. Beklenen: ${BUDGET_CATEGORIES.join(', ')}` },
				{ status: 400 }
			);
		}

		// `!amountMinor` used to be the only check, which let negatives and NaN
		// through, and the column is a 32-bit INTEGER.
		if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > MAX_AMOUNT_CENTS) {
			return NextResponse.json(
				{ error: `Tutar 0,01 ₺ ile ${formatTL(MAX_AMOUNT_CENTS)} arasında olmalıdır.` },
				{ status: 400 }
			);
		}

		if (description.length > 500) {
			return NextResponse.json({ error: 'Açıklama en fazla 500 karakter olabilir.' }, { status: 400 });
		}

		if (receiptPhotoUrl && !RECEIPT_URL.test(String(receiptPhotoUrl))) {
			return NextResponse.json({ error: 'Geçersiz fiş dosyası.' }, { status: 400 });
		}

		const date = parseDate(body.date);
		if (!date.ok) return bad(date.error);

		if (teamId && !(await getTeamById(teamId))) {
			return NextResponse.json({ error: 'Project bulunamadı.' }, { status: 404 });
		}

		try {
			const result = await createBudgetRecord({
				typeValue,
				category: resolvedCategory,
				amountMinor: amountCents,
				description: description,
				receiptPhotoUrl: receiptPhotoUrl || undefined,
				recorderId: access.user.id,
				teamId,
				date: date.date,
			});
			await publishEventQuiet(getPgPool(), { k: 'budget_updated' });
			return jsonSuccess(result);
		} catch (error) {
			// Kasa bakiyesi eksiye düşme engeli (Senaryo 175 & 300), now per kasa.
			if (error instanceof InsufficientFundsError) {
				return NextResponse.json(
					{
						error: `Yetersiz bakiye! Bu kasanın mevcut bakiyesi (${formatTL(error.netBalanceMinor)}) aşılacağından kasa eksiye düşemez.`,
						code: 'INSUFFICIENT_FUNDS',
						netBalanceMinor: error.netBalanceMinor,
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
}, { action: 'budget.create', target: 'budget' });

/** Corrects the description, category, date or receipt of an entry; never its type or amount. */
export const PATCH = withAudit(async function PATCH(request: Request) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const id = typeof body.id === 'string' ? body.id : '';
		// As with DELETE, the kasa comes from the stored row, not from the request.
		const registration = id ? await getBudgetRecordById(id) : null;
		const access = await verifyVaultAccess(request, registration?.teamId ?? null, 'yaz');
		if (!access.authorized) return access.response;
		if (!registration) return bad('Kayıt bulunamadı.', 404);
		// An allocation also touches the general kasa, which only Kasa managers may change.
		if (registration.transferId && !access.isManagement) return bad('Ödenek aktarımlarını yalnızca Kasa yöneticileri değiştirebilir.', 403);
		if (body.amountMinor !== undefined || body.typeValue !== undefined) {
			return bad('Tutar ve tür değiştirilemez; kaydı silip doğrusunu girin.');
		}

		const changes: { description?: string; category?: (typeof BUDGET_CATEGORIES)[number]; date?: number; receiptPhotoUrl?: string | null } = {};
		if (body.description !== undefined) {
			const description = typeof body.description === 'string' ? body.description.trim() : '';
			if (!description || description.length > 500) return bad('Açıklama 1-500 karakter olmalıdır.');
			changes.description = description;
		}
		if (body.category !== undefined) {
			const resolvedCategory = normalizeBudgetCategory(body.category);
			if (!resolvedCategory) return bad(`Geçersiz kategori. Beklenen: ${BUDGET_CATEGORIES.join(', ')}`);
			changes.category = resolvedCategory;
		}
		if (body.date !== undefined) {
			const date = parseDate(body.date);
			if (!date.ok || date.date === undefined) return bad(date.error ?? 'Geçersiz date.');
			changes.date = date.date;
		}
		if (body.receiptPhotoUrl !== undefined) {
			if (body.receiptPhotoUrl !== null && !RECEIPT_URL.test(String(body.receiptPhotoUrl))) return bad('Geçersiz fiş dosyası.');
			changes.receiptPhotoUrl = (body.receiptPhotoUrl as string | null) || null;
		}

		const r = await updateBudgetRecord(id, changes, access.user.id);
		if (r === 'yok') return bad('Kayıt bulunamadı.', 404);
		if (r === 'aktarim') return bad('Ödenek aktarımının kategorisi ve fişi değiştirilemez.', 409);
		await publishEventQuiet(getPgPool(), { k: 'budget_updated' });
		return jsonSuccess({ success: true });
	} catch (error) {
		console.error('API /api/butce PATCH error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}, { action: 'budget.update', target: 'budget' });

export const DELETE = withAudit(async function DELETE(request: Request) {
	try {
		const id = new URL(request.url).searchParams.get('id');
		if (!id) {
			return NextResponse.json({ error: 'Kayıt ID zorunludur.' }, { status: 400 });
		}

		// Which kasa the entry belongs to comes from the stored row, never from the
		// request — otherwise the leader of one project could delete another's entries.
		const registration = await getBudgetRecordById(id);
		const access = await verifyVaultAccess(request, registration?.teamId ?? null, 'yaz');
		if (!access.authorized) return access.response;

		if (!registration) {
			return NextResponse.json({ error: 'Kayıt bulunamadı veya silinemedi.' }, { status: 404 });
		}
		// Deleting one side of an allocation deletes both, the general kasa's included.
		if (registration.transferId && !access.isManagement) {
			return bad('Ödenek aktarımlarını yalnızca Kasa yöneticileri geri alabilir.', 403);
		}

		try {
			const deleted = await deleteBudgetRecord(id);
			if (!deleted) {
				return NextResponse.json({ error: 'Kayıt bulunamadı veya silinemedi.' }, { status: 404 });
			}
			await publishEventQuiet(getPgPool(), { k: 'budget_updated' });
		} catch (error) {
			if (error instanceof InsufficientFundsError) {
				return NextResponse.json(
					{
						error: 'Bu gelir kaydı silinirse kasa bakiyesi eksiye düşer; önce buna bağlı giderleri silin.',
						code: 'INSUFFICIENT_FUNDS',
						netBalanceMinor: error.netBalanceMinor,
					},
					{ status: 409 }
				);
			}
			throw error;
		}

		return jsonSuccess({ success: true, message: 'Bütçe kaydı silindi.' });
	} catch (error) {
		console.error('API /api/butce DELETE error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}, {
	action: 'budget.delete',
	target: 'budget',
	getTargetId: (req) => new URL(req.url).searchParams.get('id'),
});
