import { NextResponse } from 'next/server';
import { withTransaction } from '@/db';
import { requireDatabaseAdmin } from '@/lib/server/databaseAccess';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/server/db/domains/logs.repo';

const SENSITIVE_COLUMNS = new Set([
	'sifrehash',
	'totpsecret',
	'aktifoturumtoken',
	'totprecoverycodes',
	'secrethash',
	'smtp_pass',
]);

const PROTECTED_TABLES = new Set(['sistem_loglari', 'denetim_kaydi', 'guvenlik_engelleri']);
const PROTECTED_SETTINGS_KEYS = new Set(['smtp_pass', 'soc_lockdown_mode', 'soc_lockdown_reason']);

interface UpdateItem {
	pk: { col: string; val: unknown };
	changes: Record<string, unknown>;
	previous?: Record<string, unknown>;
}

interface DeleteItem {
	col: string;
	val: unknown;
}

interface MutateBody {
	table?: string;
	updates?: UpdateItem[];
	inserts?: Record<string, unknown>[];
	deletes?: DeleteItem[];
}

export async function POST(request: Request) {
	const auth = await requireDatabaseAdmin(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);
	const body = (await request.json().catch(() => ({}))) as MutateBody;
	const table = String(body.table || '').trim();
	const updates = Array.isArray(body.updates) ? body.updates : [];
	const inserts = Array.isArray(body.inserts) ? body.inserts : [];
	const deletes = Array.isArray(body.deletes) ? body.deletes : [];

	if (!table || !/^[a-zA-Z0-9_]+$/.test(table)) {
		return NextResponse.json({ error: 'Geçersiz tablo adı.' }, { status: 400 });
	}

	const lowerTable = table.toLowerCase();
	if (PROTECTED_TABLES.has(lowerTable)) {
		return NextResponse.json(
			{ error: 'Güvenlik ve denetim tabloları doğrudan düzenlenemez veya silinemez.' },
			{ status: 403 }
		);
	}

	if (updates.length === 0 && inserts.length === 0 && deletes.length === 0) {
		return NextResponse.json({ error: 'İşlenecek değişiklik bulunamadı.' }, { status: 400 });
	}

	try {
		await withTransaction(async (client) => {
			const now = Date.now();
			const actorName = `${auth.user.ad} ${auth.user.soyad}`.trim();

			// 1. Process Updates
			for (const u of updates) {
				const pkCol = String(u.pk.col || '').trim();
				if (!/^[a-zA-Z0-9_]+$/.test(pkCol)) throw new Error('Geçersiz birincil anahtar kolonu.');
				if (lowerTable === 'sistem_ayarlari' && PROTECTED_SETTINGS_KEYS.has(String(u.pk.val ?? '').toLowerCase())) {
					continue;
				}

				const setClauses: string[] = [];
				const setParams: unknown[] = [];

				for (const [key, val] of Object.entries(u.changes)) {
					if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
					if (SENSITIVE_COLUMNS.has(key.toLowerCase())) continue; // Skip sensitive fields
					if (lowerTable === 'sistem_ayarlari' && key.toLowerCase() === 'anahtar' && PROTECTED_SETTINGS_KEYS.has(String(val ?? '').toLowerCase())) {
						continue;
					}
					setParams.push(val);
					setClauses.push(`"${key}" = $${setParams.length}`);
				}

				if (setClauses.length > 0) {
					setParams.push(u.pk.val);
					const sql = `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE "${pkCol}" = $${setParams.length}`;
					await client.query(sql, setParams);

					// Record audit diff in denetim_kaydi if table exists
					try {
						await client.query(
							`INSERT INTO denetim_kaydi (zaman, yapanId, yapanAd, islem, hedefTur, hedefId, hedefAd, onceki, sonraki, ip)
							 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
							[
								now,
								auth.user.id,
								actorName,
								'db_hucre_guncelleme',
								'database_table',
								table,
								String(u.pk.val),
								JSON.stringify({ pkCol: u.pk.col, pkVal: u.pk.val, ...(u.previous || {}) }),
								JSON.stringify({ pkCol: u.pk.col, pkVal: u.pk.val, ...u.changes }),
								ip,
							]
						);
					} catch {
						// Fail gracefully if audit schema is not initialized yet
					}
				}
			}

			// 2. Process Inserts
			for (const row of inserts) {
				if (lowerTable === 'sistem_ayarlari' && PROTECTED_SETTINGS_KEYS.has(String(row.anahtar ?? '').toLowerCase())) {
					continue;
				}
				const cols: string[] = [];
				const placeholders: string[] = [];
				const params: unknown[] = [];

				for (const [key, val] of Object.entries(row)) {
					if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
					if (SENSITIVE_COLUMNS.has(key.toLowerCase())) continue; // Skip sensitive fields
					if (val === undefined) continue;
					cols.push(`"${key}"`);
					params.push(val);
					placeholders.push(`$${params.length}`);
				}

				if (cols.length > 0) {
					const sql = `INSERT INTO "${table}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;
					await client.query(sql, params);
				}
			}

			// 3. Process Deletes
			for (const d of deletes) {
				const pkCol = String(d.col || '').trim();
				if (!/^[a-zA-Z0-9_]+$/.test(pkCol)) throw new Error('Geçersiz silme hedefi.');
				if (lowerTable === 'sistem_ayarlari' && PROTECTED_SETTINGS_KEYS.has(String(d.val ?? '').toLowerCase())) {
					continue;
				}

				const sql = `DELETE FROM "${table}" WHERE "${pkCol}" = $1`;
				await client.query(sql, [d.val]);
			}
		});

		// 4. Log the mutation to audit trail
		await logSystemEvent({
			servis: 'database',
			seviye: 'WARN',
			mesaj: `"${table}" tablosunda toplu veri değişikliği yapıldı`,
			detay: {
				tablo: table,
				guncellenenSayisi: updates.length,
				eklenenSayisi: inserts.length,
				silinenSayisi: deletes.length,
			},
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json({
			success: true,
			message: `${updates.length} güncelleme, ${inserts.length} ekleme ve ${deletes.length} silme işlemi başarıyla kaydedildi.`,
		});
	} catch (error) {
		console.error(`API /api/database/mutate error on "${table}":`, error);
		const err = error as Error;
		return NextResponse.json(
			{ error: `Veritabanı işlemi başarısız: ${err?.message || 'Bilinmeyen hata'}` },
			{ status: 500 }
		);
	}
}
