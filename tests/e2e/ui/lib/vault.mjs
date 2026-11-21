// Vault helpers for suites that write to a ledger and must leave it as they found it.

/** A vault's net balance in minor units (the lira's hundredth; `teamId` null = the general vault). */
export async function vaultBalance(api, teamId = null) {
	const r = await api.get(teamId ? `/api/budget?teamId=${encodeURIComponent(teamId)}` : '/api/budget');
	return r.json?.summary?.netBalanceMinor ?? NaN;
}

/** A vault's entries, newest first. */
export async function vaultRecords(api, teamId = null) {
	const r = await api.get(teamId ? `/api/budget?teamId=${encodeURIComponent(teamId)}` : '/api/budget');
	return r.json?.records ?? [];
}

/**
 * Deletes every entry of a project's vault (expenses first, so no income is removed from under
 * them; an allocation takes its general-vault side with it). Needs a vault manager's client.
 */
export async function vaultClear(admin, teamId) {
	const rows = await vaultRecords(admin, teamId);
	const order = [...rows.filter((r) => r.type === 'expense' && !r.transferId), ...rows.filter((r) => r.type === 'expense'), ...rows];
	for (const r of order) await admin.del(`/api/budget?id=${encodeURIComponent(r.id)}`);
}
