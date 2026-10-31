import { NextResponse } from 'next/server';
import { getCashTotals } from '@/db';
import { authenticateEnrolled } from '@/lib/auth/access';
import { listAccessibleKasas } from '@/lib/kasaAccess';
import type { VaultSummary } from '@/types/budget';

/**
 * The kasas the caller may open, each with its balance.
 *
 * Kasa readers and managers see the general kasa and every project's; a
 * captain sees their own project's; everyone else gets 403 (see lib/kasaAccess).
 */
export async function GET(request: Request) {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return auth.response;

	try {
		const accessible = await listAccessibleKasas(auth.user);
		if (accessible.length === 0) {
			return NextResponse.json({ error: 'Bu alana erişim yetkiniz yok.' }, { status: 403 });
		}

		const totals = new Map((await getCashTotals()).map((t) => [t.teamId, t]));
		const vaults: VaultSummary[] = accessible.map((kasa) => {
			const t = totals.get(kasa.teamId);
			const gelir = t?.toplamGelirKurus ?? 0;
			const gider = t?.toplamGiderKurus ?? 0;
			return {
				...kasa,
				toplamGelirKurus: gelir,
				toplamGiderKurus: gider,
				netBakiyeKurus: gelir - gider,
				kayitSayisi: t?.kayitSayisi ?? 0,
			};
		});

		return NextResponse.json({ kasalar: vaults });
	} catch (error) {
		console.error('API /api/butce/kasalar GET error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}
