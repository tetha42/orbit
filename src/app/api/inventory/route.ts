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
	const auth = await requireApp(request, 'inventory', 'kullan');
	if (!auth.authorized) return auth.response;

	try {
		// `?gecmis=<id>`: one item's history (who borrowed it, returns, repairs, edits).
		const gecmis = new URL(request.url).searchParams.get('gecmis');
		if (gecmis) {
			if (!(await getInventoryItemById(gecmis))) return bad('Envanter kaydı bulunamadı.', 404);
			return NextResponse.json({ hareketler: await getInventoryActivities(gecmis) });
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
		const auth = await requireApp(request, 'inventory', 'kullan');
		if (!auth.authorized) return auth.response;
		if (auth.user.status === 'mezun') {
			return bad('Mezunlar sadece okuma erişimine sahiptir.', 403);
		}

		const body = (await request.json()) as Record<string, unknown>;
		const { action } = body;
		const envanterId = typeof body.envanterId === 'string' ? body.envanterId : '';
		// Role alone is not enough: management also needs its second factor (production rule).
		const isManager = can(auth.user, 'inventory', 'yonet');
		const now = Date.now();

		if (action === 'create' || action === 'update') {
			if (!isManager) return bad('Donanım ekleme ve düzenleme yetkisi yalnızca yönetimdedir.', 403);
			const fields: {
				kod?: string;
				ad?: string;
				kategori?: string;
				konum?: string;
				aciklama?: string | null;
				seriNo?: string | null;
			} = {};
			if (body.kod !== undefined || action === 'create') {
				const code = normalizeCode(body.kod);
				const err = codeProblem(code);
				if (err) return bad(err);
				fields.kod = code;
			}
			for (const [key, min, max, label] of [
				['ad', 3, 120, 'Ad'],
				['kategori', 2, 60, 'Kategori'],
				['konum', 2, 120, 'Konum'],
			] as const) {
				const v = text(body[key], min, max);
				if (v === null || (v === undefined && action === 'create'))
					return bad(`${label} ${min}-${max} karakter olmalıdır.`);
				if (v !== undefined) fields[key] = v;
			}
			for (const [key, max] of [
				['aciklama', 1000],
				['seriNo', 80],
			] as const) {
				if (body[key] === undefined) continue;
				const v = typeof body[key] === 'string' ? (body[key] as string).trim() : '';
				if (v.length > max)
					return bad(
						`${key === 'seriNo' ? 'Seri no' : 'Açıklama'} en fazla ${max} karakter olabilir.`,
					);
				fields[key] = v || null;
			}

			if (action === 'create') {
				try {
					const item = await createInventoryItem({
						kod: fields.kod!,
						ad: fields.ad!,
						kategori: fields.kategori!,
						konum: fields.konum!,
						aciklama: fields.aciklama,
						seriNo: fields.seriNo,
						// A new item is in service, broken or lost — never "on loan" to nobody.
						status: isInventoryStatus(body.status) && body.status !== 'oduncte' ? body.status : 'saglam',
						aktorId: auth.user.id,
					});
					await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
					return NextResponse.json({ success: true, item }, { status: 201 });
				} catch (err) {
					if (err instanceof InventoryCodeExistsError)
						return bad(`${fields.kod} kodu zaten kullanılıyor.`, 409);
					throw err;
				}
			}
			const r = await updateInventoryItem(envanterId, fields, auth.user.id);
			if (r === 'yok') return bad('Envanter kaydı bulunamadı.', 404);
			if (r === 'kod-var') return bad(`${fields.kod} kodu zaten kullanılıyor.`, 409);
			await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
			return NextResponse.json({ success: true });
		}

		if (!envanterId) return bad('Envanter ID zorunludur.');

		if (action === 'delete') {
			if (!isManager) return bad('Donanım silme yetkisi yalnızca yönetimdedir.', 403);
			const r = await deleteInventoryItem(envanterId);
			if (r === 'yok') return bad('Kayıt bulunamadı veya silinemedi.', 404);
			if (r === 'oduncte') return bad('Ödünçteki eşya silinemez; önce iade alın.', 409);
			await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
			return NextResponse.json({ success: true, message: 'Envanter kaydı silindi.' });
		}

		if (action === 'oduncAl') {
			// Members borrow for themselves; management may lend to someone else.
			let userId = auth.user.id;
			if (
				isManager &&
				typeof body.userId === 'string' &&
				body.userId &&
				body.userId !== auth.user.id
			) {
				const target = await getUserById(body.userId);
				if (!target || target.status !== 'aktif')
					return bad('Ödünç verilecek üye bulunamadı veya aktif değil.', 404);
				userId = target.id;
			}
			const returnDate =
				body.iadeTarihi === undefined ? now + DEFAULT_LOAN_DAYS * DAY : Number(body.iadeTarihi);
			const err = returnDateProblem(returnDate, { now, yonetim: isManager });
			if (err) return bad(err);
			const r = await lendInventoryItem({
				id: envanterId,
				userId,
				iadeTarihi: returnDate,
				aktorId: auth.user.id,
			});
			if (r === 'yok') return bad('Envanter kaydı bulunamadı.', 404);
			if (r === 'musait-degil')
				return bad('Bu eşya şu anda ödünç verilemez: başkasında, arızalı veya kayıp.', 409);
			await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
			return NextResponse.json({ success: true, message: 'Ödünç alma işlemi kaydedildi.' });
		}

		if (action === 'iadeEt') {
			// Only the borrower or management may return an item. Returning never repairs
			// it; a borrower may report it broken, which takes it out of service.
			const not = text(body.not, 0, 500);
			if (not === null) return bad('Not en fazla 500 karakter olabilir.');
			const r = await markReturned({
				id: envanterId,
				aktorId: auth.user.id,
				borrowerOnly: isManager ? undefined : auth.user.id,
				ariza: body.ariza === true,
				not,
			});
			if (r === 'yok') return bad('Envanter kaydı bulunamadı.', 404);
			if (r === 'oduncte-degil') return bad('Bu eşya ödünçte değil.', 409);
			if (r === 'permission')
				return bad('Bu eşyayı yalnızca ödünç alan kişi veya yönetim iade edebilir.', 403);
			await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
			return NextResponse.json({
				success: true,
				message:
					body.ariza === true
						? 'İade alındı; eşya arızalı olarak işaretlendi.'
						: 'Envanter iade edildi.',
			});
		}

		if (action === 'uzat') {
			const item = await getInventoryItemById(envanterId);
			if (!item) return bad('Envanter kaydı bulunamadı.', 404);
			if (item.status !== 'oduncte') return bad('Bu eşya ödünçte değil.', 409);
			if (!isManager && item.oduncAlanId !== auth.user.id)
				return bad('Süreyi yalnızca ödünç alan kişi veya yönetim uzatabilir.', 403);
			const returnDate = Number(body.iadeTarihi);
			const err = returnDateProblem(returnDate, {
				now,
				baslangic: item.oduncTarihi ?? now,
				yonetim: isManager,
			});
			if (err) return bad(err);
			const r = await extendLoan({
				id: envanterId,
				iadeTarihi: returnDate,
				aktorId: auth.user.id,
				borrowerOnly: isManager ? undefined : auth.user.id,
			});
			if (r !== 'ok') return bad('Süre uzatılamadı; eşyanın durumu değişmiş olabilir.', 409);
			await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
			return NextResponse.json({ success: true, message: 'İade tarihi güncellendi.' });
		}

		if (action === 'updateDurum') {
			if (!isManager)
				return bad(
					'Envanter durumu yalnızca topluluk lideri veya yönetim tarafından güncellenebilir.',
					403,
				);
			const status = body.status;
			// Reject unknown values instead of persisting a status nothing can filter on;
			// "on loan" is reached by lending, never set by hand.
			if (!isInventoryStatus(status) || status === 'oduncte') {
				return bad(
					`Geçersiz status. Beklenen: ${INVENTORY_STATUSES.filter((d) => d !== 'oduncte').join(', ')}`,
				);
			}
			const not = text(body.not, 0, 500);
			const r = await setInventoryStatus({
				id: envanterId,
				status,
				aktorId: auth.user.id,
				not: not ?? undefined,
			});
			if (r === 'yok') return bad('Envanter kaydı bulunamadı.', 404);
			if (r === 'oduncte')
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
