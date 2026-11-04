import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { getUserById, getPgPool } from '@/db';
import { publishEventQuiet } from '@/db/events';
import {
	InventoryCodeExistsError,
	createInventoryItem,
	deleteInventoryItem,
	getInventoryItems,
	getInventoryItemById,
	getInventoryActivities,
	markReturned,
	extendLoan,
	lendInventoryItem,
	setInventoryStatus,
	updateInventoryItem,
} from '@/db/repositories/inventory.repo';
import { can, requireApp } from '@/lib/auth/access';
import { DEFAULT_LOAN_DAYS, returnDateProblem, codeProblem, normalizeCode } from '@/lib/inventory';
import { INVENTORY_STATUSES, isInventoryStatus } from '@/types/inventory';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const DAY = 86_400_000;

/** A trimmed string field within limits; `undefined` when absent, `null` when it fails. */
function text(value: unknown, min: number, max: number): string | undefined | null {
	if (value === undefined) return undefined;
	const s = typeof value === 'string' ? value.trim() : '';
	return s.length >= min && s.length <= max ? s : null;
}

export async function GET(request: Request) {
	// Inventory is visible to members, but the custody columns (who holds what)
	// must not be readable anonymously.
	const auth = await requireApp(request, 'inventory', 'use');
	if (!auth.authorized) return auth.response;

	try {
		// `?gecmis=<id>`: one item's history (who borrowed it, returns, repairs, edits).
		const history = new URL(request.url).searchParams.get('history');
		if (history) {
			if (!(await getInventoryItemById(history))) return bad('Envanter kaydı bulunamadı.', 404);
			return NextResponse.json({ movements: await getInventoryActivities(history) });
		}
		const items = await getInventoryItems();
		return NextResponse.json(items);
	} catch (error) {
		console.error('API /api/envanter GET error:', error);
		return bad('Envanter okunamadı.', 500);
	}
}

async function handlePOST(request: Request) {
	try {
		const auth = await requireApp(request, 'inventory', 'use');
		if (!auth.authorized) return auth.response;
		if (auth.user.status === 'alumni') {
			return bad('Mezunlar sadece okuma erişimine sahiptir.', 403);
		}

		const body = (await request.json()) as Record<string, unknown>;
		const { action } = body;
		const inventoryId = typeof body.inventoryId === 'string' ? body.inventoryId : '';
		// Role alone is not enough: management also needs its second factor (production rule).
		const isManager = can(auth.user, 'inventory', 'manage');
		const now = Date.now();

		if (action === 'create' || action === 'update') {
			if (!isManager) return bad('Donanım ekleme ve düzenleme yetkisi yalnızca yönetimdedir.', 403);
			const fields: {
				code?: string;
				name?: string;
				category?: string;
				location?: string;
				description?: string | null;
				seriesNo?: string | null;
			} = {};
			if (body.code !== undefined || action === 'create') {
				const code = normalizeCode(body.code);
				const err = codeProblem(code);
				if (err) return bad(err);
				fields.code = code;
			}
			for (const [key, min, max, label] of [
				['name', 3, 120, 'Ad'],
				['category', 2, 60, 'Kategori'],
				['location', 2, 120, 'Konum'],
			] as const) {
				const v = text(body[key], min, max);
				if (v === null || (v === undefined && action === 'create'))
					return bad(`${label} ${min}-${max} karakter olmalıdır.`);
				if (v !== undefined) fields[key] = v;
			}
			for (const [key, max] of [
				['description', 1000],
				['seriesNo', 80],
			] as const) {
				if (body[key] === undefined) continue;
				const v = typeof body[key] === 'string' ? (body[key] as string).trim() : '';
				if (v.length > max)
					return bad(
						`${key === 'seriesNo' ? 'Seri no' : 'Açıklama'} en fazla ${max} karakter olabilir.`,
					);
				fields[key] = v || null;
			}

			if (action === 'create') {
				try {
					const item = await createInventoryItem({
						code: fields.code!,
						name: fields.name!,
						category: fields.category!,
						location: fields.location!,
						description: fields.description,
						seriesNo: fields.seriesNo,
						// A new item is in service, broken or lost — never "on loan" to nobody.
						status: isInventoryStatus(body.status) && body.status !== 'on_loan' ? body.status : 'available',
						actorId: auth.user.id,
					});
					await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
					return NextResponse.json({ success: true, item }, { status: 201 });
				} catch (err) {
					if (err instanceof InventoryCodeExistsError)
						return bad(`${fields.code} kodu zaten kullanılıyor.`, 409);
					throw err;
				}
			}
			const r = await updateInventoryItem(inventoryId, fields, auth.user.id);
			if (r === 'none') return bad('Envanter kaydı bulunamadı.', 404);
			if (r === 'code_exists') return bad(`${fields.code} kodu zaten kullanılıyor.`, 409);
			await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
			return NextResponse.json({ success: true });
		}

		if (!inventoryId) return bad('Envanter ID zorunludur.');

		if (action === 'delete') {
			if (!isManager) return bad('Donanım silme yetkisi yalnızca yönetimdedir.', 403);
			const r = await deleteInventoryItem(inventoryId);
			if (r === 'none') return bad('Kayıt bulunamadı veya silinemedi.', 404);
			if (r === 'on_loan') return bad('Ödünçteki eşya silinemez; önce iade alın.', 409);
			await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
			return NextResponse.json({ success: true, message: 'Envanter kaydı silindi.' });
		}

		if (action === 'borrow') {
			// Members borrow for themselves; management may lend to someone else.
			let userId = auth.user.id;
			if (
				isManager &&
				typeof body.userId === 'string' &&
				body.userId &&
				body.userId !== auth.user.id
			) {
				const target = await getUserById(body.userId);
				if (!target || target.status !== 'active')
					return bad('Ödünç verilecek üye bulunamadı veya aktif değil.', 404);
				userId = target.id;
			}
			const returnDate =
				body.returnDate === undefined ? now + DEFAULT_LOAN_DAYS * DAY : Number(body.returnDate);
			const err = returnDateProblem(returnDate, { now, management: isManager });
			if (err) return bad(err);
			const r = await lendInventoryItem({
				id: inventoryId,
				userId,
				returnDate: returnDate,
				actorId: auth.user.id,
			});
			if (r === 'none') return bad('Envanter kaydı bulunamadı.', 404);
			if (r === 'unavailable')
				return bad('Bu eşya şu anda ödünç verilemez: başkasında, arızalı veya kayıp.', 409);
			await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
			return NextResponse.json({ success: true, message: 'Ödünç alma işlemi kaydedildi.' });
		}

		if (action === 'return') {
			// Only the borrower or management may return an item. Returning never repairs
			// it; a borrower may report it broken, which takes it out of service.
			const not = text(body.not, 0, 500);
			if (not === null) return bad('Not en fazla 500 karakter olabilir.');
			const r = await markReturned({
				id: inventoryId,
				actorId: auth.user.id,
				borrowerOnly: isManager ? undefined : auth.user.id,
				failure: body.failure === true,
				not,
			});
			if (r === 'none') return bad('Envanter kaydı bulunamadı.', 404);
			if (r === 'not_on_loan') return bad('Bu eşya ödünçte değil.', 409);
			if (r === 'permission')
				return bad('Bu eşyayı yalnızca ödünç alan kişi veya yönetim iade edebilir.', 403);
			await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
			return NextResponse.json({
				success: true,
				message:
					body.failure === true
						? 'İade alındı; eşya arızalı olarak işaretlendi.'
						: 'Envanter iade edildi.',
			});
		}

		if (action === 'extend') {
			const item = await getInventoryItemById(inventoryId);
			if (!item) return bad('Envanter kaydı bulunamadı.', 404);
			if (item.status !== 'on_loan') return bad('Bu eşya ödünçte değil.', 409);
			if (!isManager && item.loanFieldId !== auth.user.id)
				return bad('Süreyi yalnızca ödünç alan kişi veya yönetim uzatabilir.', 403);
			const returnDate = Number(body.returnDate);
			const err = returnDateProblem(returnDate, {
				now,
				start: item.loanDate ?? now,
				management: isManager,
			});
			if (err) return bad(err);
			const r = await extendLoan({
				id: inventoryId,
				returnDate: returnDate,
				actorId: auth.user.id,
				borrowerOnly: isManager ? undefined : auth.user.id,
			});
			if (r !== 'ok') return bad('Süre uzatılamadı; eşyanın durumu değişmiş olabilir.', 409);
			await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
			return NextResponse.json({ success: true, message: 'İade tarihi güncellendi.' });
		}

		if (action === 'updateStatus') {
			if (!isManager)
				return bad(
					'Envanter durumu yalnızca topluluk lideri veya yönetim tarafından güncellenebilir.',
					403,
				);
			const status = body.status;
			// Reject unknown values instead of persisting a status nothing can filter on;
			// "on loan" is reached by lending, never set by hand.
			if (!isInventoryStatus(status) || status === 'on_loan') {
				return bad(
					`Geçersiz status. Beklenen: ${INVENTORY_STATUSES.filter((d) => d !== 'on_loan').join(', ')}`,
				);
			}
			const not = text(body.not, 0, 500);
			const r = await setInventoryStatus({
				id: inventoryId,
				status,
				actorId: auth.user.id,
				not: not ?? undefined,
			});
			if (r === 'none') return bad('Envanter kaydı bulunamadı.', 404);
			if (r === 'on_loan')
				return bad('Eşya ödünçte; önce iade alın (kaybolduysa "Kayıp" seçebilirsiniz).', 409);
			await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
			return NextResponse.json({ success: true, message: 'Envanter durumu güncellendi.', status });
		}

		return bad('Geçersiz işlem.');
	} catch (error) {
		console.error('API /api/envanter error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}

export const POST = withAudit(handlePOST, { action: 'inventory.create', target: 'inventory' });
