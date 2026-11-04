import { NextResponse } from 'next/server';
import { getCashTotals } from '@/db';
import { authenticateEnrolled } from '@/lib/auth/access';
import { listAccessibleVaults } from '@/lib/vaultAccess';
import type { VaultSummary } from '@/types/budget';

/**
 * The vaults the caller may open, each with its balance.
 *
 * Vault readers and managers see the general vault and every project's; a
 * captain sees their own project's; everyone else gets 403 (see lib/vaultAccess).
 */
export async function GET(request: Request) {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return auth.response;

	try {
		const accessible = await listAccessibleVaults(auth.user);
		if (accessible.length === 0) {
			return NextResponse.json({ error: 'Bu alana erişim yetkiniz yok.' }, { status: 403 });
		}

		const totals = new Map((await getCashTotals()).map((t) => [t.teamId, t]));
		const vaults: VaultSummary[] = accessible.map((vault) => {
			const t = totals.get(vault.teamId);
			const income = t?.totalIncomeMinor ?? 0;
			const expense = t?.totalExpenseMinor ?? 0;
			return {
				...vault,
				teamId: vault.teamId,
				totalIncomeMinor: income,
				totalExpenseMinor: expense,
				netBalanceMinor: income - expense,
				recordCount: t?.recordCount ?? 0,
			};
		});

		return NextResponse.json({ vaults,});
	} catch (error) {
		console.error('API /api/budget/vaults GET error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}
