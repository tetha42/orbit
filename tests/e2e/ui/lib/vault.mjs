// Kasa helpers for suites that write to a ledger and must leave it as they found it.

/** A kasa's net balance in kuruş (`teamId` null = the general kasa). */
export async function vaultBalance(api, teamId = null) {
	const r = await api.get(teamId ? `/api/butce?teamId=${encodeURIComponent(teamId)}` : '/api/butce');
	return r.json?.summary?.netBalanceMinor ?? NaN;
}

/** A kasa's entries, newest first. */
export async function vaultRecords(api, teamId = null) {
	const r = await api.get(teamId ? `/api/butce?teamId=${encodeURIComponent(teamId)}` : '/api/butce');
	return r.json?.records ?? [];
}

/**
 * Deletes every entry of a project's kasa (expenses first, so no income is removed from under
 * them; an allocation takes its general-kasa side with it). Needs a Kasa manager's client.
 */
export async function vaultClear(admin, teamId) {
	const rows = await vaultRecords(admin, teamId);
	const order = [...rows.filter((r) => r.typeValue === 'expense' && !r.transferId), ...rows.filter((r) => r.typeValue === 'expense'), ...rows];
	for (const r of order) await admin.del(`/api/butce?id=${encodeURIComponent(r.id)}`);
}
